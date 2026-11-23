// Calculs des rapports (fonctions pures, testées) : à partir des ventes, petites ventes,
// paiements et dépenses d'une période, produit indicateurs, séries et classements.
import { PAYMENT_METHOD_LABELS, displayName } from '../lib/constants'

const num = (v) => Number(v || 0)

/** Bornes [from, to[ d'une période prédéfinie, en heure locale */
export function periodRange(preset, custom = {}) {
  const now = new Date()
  const start = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const today = start(now)
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
  switch (preset) {
    case 'today':
      return { from: today, to: addDays(today, 1) }
    case 'week':
      return { from: addDays(today, -6), to: addDays(today, 1) }
    case 'lastMonth':
      return { from: new Date(now.getFullYear(), now.getMonth() - 1, 1), to: new Date(now.getFullYear(), now.getMonth(), 1) }
    case 'year':
      return { from: new Date(now.getFullYear(), 0, 1), to: addDays(today, 1) }
    case 'custom': {
      const from = custom.from ? start(new Date(`${custom.from}T00:00:00`)) : today
      const to = custom.to ? addDays(start(new Date(`${custom.to}T00:00:00`)), 1) : addDays(today, 1)
      return { from, to: to > from ? to : addDays(from, 1) }
    }
    case 'month':
    default:
      return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: addDays(today, 1) }
  }
}

const dayKey = (d) => {
  const x = new Date(d)
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
}
const monthKey = (d) => {
  const x = new Date(d)
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`
}

/** Série du chiffre d'affaires : par jour (≤ 62 jours), sinon par mois */
function buildSeries(from, to, sales, smallSales) {
  const days = Math.round((to - from) / 86400000)
  const byMonth = days > 62
  const buckets = new Map()
  if (byMonth) {
    for (let d = new Date(from.getFullYear(), from.getMonth(), 1); d < to; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
      buckets.set(monthKey(d), { label: d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }), factures: 0, caisse: 0 })
    }
  } else {
    for (let d = new Date(from); d < to; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
      buckets.set(dayKey(d), { label: d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }), factures: 0, caisse: 0 })
    }
  }
  const keyOf = byMonth ? monthKey : dayKey
  sales.forEach((s) => {
    const b = buckets.get(keyOf(s.created_at))
    if (b) b.factures += num(s.total)
  })
  smallSales.forEach((s) => {
    const b = buckets.get(keyOf(s.created_at))
    if (b) b.caisse += num(s.total)
  })
  return { series: [...buckets.values()], granularity: byMonth ? 'month' : 'day' }
}

/**
 * @param {object} data { sales, smallSales, payments, expenses, products, categories, users, from, to }
 *   sales      : factures comptées (confirmées, non annulées) avec sale_items et clients
 *   smallSales : petites ventes non annulées avec small_sale_items
 */
export function computeReport({ sales = [], smallSales = [], payments = [], expenses = [], products = [], categories = [], users = [], from, to }) {
  const categoryOfProduct = new Map(products.map((p) => [p.id, p.category_id]))
  const categoryName = new Map(categories.map((c) => [c.id, c.name]))
  const userName = new Map(users.map((u) => [u.id, displayName(u.full_name)]))

  const invoicesRevenue = sales.reduce((s, x) => s + num(x.total), 0)
  const cashRevenue = smallSales.reduce((s, x) => s + num(x.total), 0)
  const discounts = sales.reduce((s, x) => s + num(x.discount), 0) + smallSales.reduce((s, x) => s + num(x.discount), 0)
  const collectedInvoices = payments.reduce((s, p) => s + num(p.amount), 0)
  const totalExpenses = expenses.reduce((s, e) => s + num(e.amount), 0)

  const productStats = new Map()
  const categoryStats = new Map()
  let itemsMargin = 0
  const addLine = (item) => {
    const qty = num(item.quantity)
    const revenue = num(item.line_total) || qty * num(item.unit_price)
    const margin = (num(item.unit_price) - num(item.purchase_price)) * qty
    itemsMargin += margin
    const key = item.product_id || item.product_name
    const p = productStats.get(key) || { name: item.product_name, quantity: 0, revenue: 0, margin: 0 }
    p.quantity += qty
    p.revenue += revenue
    p.margin += margin
    productStats.set(key, p)
    const catId = item.product_id ? categoryOfProduct.get(item.product_id) : null
    const catName = (catId && categoryName.get(catId)) || 'Sans catégorie'
    const c = categoryStats.get(catName) || { name: catName, revenue: 0, margin: 0 }
    c.revenue += revenue
    c.margin += margin
    categoryStats.set(catName, c)
  }
  sales.forEach((s) => (s.sale_items || []).forEach(addLine))
  smallSales.forEach((s) => (s.small_sale_items || []).forEach(addLine))
  const grossMargin = itemsMargin - discounts

  const clients = new Map()
  sales.forEach((s) => {
    const key = s.client_id || 'comptoir'
    const c = clients.get(key) || { name: s.clients?.name || 'Client comptoir', revenue: 0, count: 0, due: 0 }
    c.revenue += num(s.total)
    c.count += 1
    c.due += Math.max(0, num(s.total) - num(s.amount_paid))
    clients.set(key, c)
  })

  const sellers = new Map()
  const addSeller = (userId, amount) => {
    const key = userId || 'inconnu'
    const s = sellers.get(key) || { name: userName.get(userId) || 'Non renseigné', revenue: 0, count: 0 }
    s.revenue += amount
    s.count += 1
    sellers.set(key, s)
  }
  sales.forEach((s) => addSeller(s.user_id, num(s.total)))
  smallSales.forEach((s) => addSeller(s.user_id, num(s.total)))

  // Encaissements par mode : paiements de factures (remboursements inclus) + caisse rapide (espèces)
  const methods = new Map()
  payments.forEach((p) => methods.set(p.method || 'especes', (methods.get(p.method || 'especes') || 0) + num(p.amount)))
  if (cashRevenue) methods.set('especes', (methods.get('especes') || 0) + cashRevenue)

  const expenseCats = new Map()
  expenses.forEach((e) => {
    const k = e.category || 'Autres'
    expenseCats.set(k, (expenseCats.get(k) || 0) + num(e.amount))
  })

  const revenue = invoicesRevenue + cashRevenue
  const count = sales.length + smallSales.length
  const byRevenue = (a, b) => b.revenue - a.revenue

  return {
    kpis: {
      revenue,
      invoicesRevenue,
      cashRevenue,
      collected: collectedInvoices + cashRevenue,
      grossMargin,
      marginRate: revenue ? grossMargin / revenue : 0,
      expenses: totalExpenses,
      profit: grossMargin - totalExpenses,
      count,
      invoicesCount: sales.length,
      cashCount: smallSales.length,
      avgBasket: count ? revenue / count : 0,
      discounts,
    },
    ...buildSeries(from, to, sales, smallSales),
    topProducts: [...productStats.values()].sort(byRevenue),
    byCategory: [...categoryStats.values()].sort(byRevenue).map((c) => ({ ...c, share: revenue ? c.revenue / revenue : 0 })),
    topClients: [...clients.values()].sort(byRevenue),
    bySeller: [...sellers.values()].sort(byRevenue),
    byMethod: [...methods.entries()]
      .map(([method, amount]) => ({ method, label: PAYMENT_METHOD_LABELS[method] || method, amount }))
      .filter((m) => m.amount !== 0)
      .sort((a, b) => b.amount - a.amount),
    expensesByCategory: [...expenseCats.entries()].map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount),
  }
}
