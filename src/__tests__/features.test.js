import { describe, it, expect } from 'vitest'
import { formatQty, parseQty, roundQty, isDecimalUnit, qtyStep } from '../utils/quantity'
import { analyzeImport, mapColumns, parseNumber, normalize } from '../utils/productImport'
import { computeReport, periodRange } from '../utils/reports'

describe('quantités décimales', () => {
  it('reconnaît les unités de mesure', () => {
    expect(isDecimalUnit('m')).toBe(true)
    expect(isDecimalUnit('Kg')).toBe(true)
    expect(isDecimalUnit('sac')).toBe(false)
    expect(qtyStep('L')).toBe(0.5)
    expect(qtyStep('unité')).toBe(1)
  })
  it('affiche sans décimales inutiles', () => {
    expect(formatQty(2)).toBe('2')
    expect(formatQty(2.5, 'm')).toBe('2,5 m')
    expect(formatQty(1.25, 'unité')).toBe('1,25')
  })
  it('lit la virgule et le point, et arrondit à 3 décimales', () => {
    expect(parseQty('1,5')).toBe(1.5)
    expect(parseQty('2.25')).toBe(2.25)
    expect(Number.isNaN(parseQty('abc'))).toBe(true)
    expect(roundQty(0.1 + 0.2)).toBe(0.3)
  })
})

describe('import du catalogue', () => {
  it('reconnaît des intitulés variés', () => {
    const m = mapColumns(['Désignation', "Prix d'achat", 'PU vente', 'Qté', 'Seuil alerte', 'Famille'])
    expect(m).toEqual({ name: 'Désignation', purchase_price: "Prix d'achat", sale_price: 'PU vente', stock: 'Qté', alert_threshold: 'Seuil alerte', category: 'Famille' })
  })
  it('lit les montants saisis à la main', () => {
    expect(parseNumber('1 500 F')).toBe(1500)
    expect(parseNumber('2,5')).toBe(2.5)
    expect(parseNumber('')).toBeNull()
  })
  it('distingue création, mise à jour et erreurs', () => {
    const products = [{ id: 'p1', name: 'Ciment CPJ 45' }]
    const { rows, missingColumns } = analyzeImport(
      [
        { Nom: 'ciment cpj 45', 'Prix vente': 4800 },
        { Nom: 'Fer 10', 'Prix vente': 3600, Stock: 20 },
        { Nom: 'Fer 10', 'Prix vente': 3600 },
        { Nom: 'Pointes', 'Prix vente': 'gratuit' },
        { Nom: '', 'Prix vente': '' },
      ],
      products
    )
    expect(missingColumns).toEqual([])
    expect(rows.map((r) => r.action)).toEqual(['update', 'create', 'error', 'error'])
    expect(rows[0].existing.id).toBe('p1')
    expect(rows[2].errors).toContain('produit en double dans le fichier')
    expect(normalize('Électricité')).toBe('electricite')
  })
  it('signale les colonnes obligatoires absentes', () => {
    expect(analyzeImport([{ Produit: 'X' }], []).missingColumns).toEqual(['sale_price'])
  })
})

describe('rapports', () => {
  const from = new Date(2026, 9, 1)
  const to = new Date(2026, 9, 31)
  const report = computeReport({
    from,
    to,
    sales: [
      { id: 's1', created_at: '2026-10-05T10:00:00', total: 9000, discount: 1000, amount_paid: 5000, client_id: 'c1', user_id: 'u1', clients: { name: 'Awa' },
        sale_items: [{ product_id: 'p1', product_name: 'Ciment', quantity: 2, unit_price: 5000, purchase_price: 4000, line_total: 10000 }] },
    ],
    smallSales: [
      { id: 'ss1', created_at: '2026-10-06T10:00:00', total: 1250, discount: 0, user_id: 'u2',
        small_sale_items: [{ product_id: 'p2', product_name: 'Câble', quantity: 2.5, unit_price: 500, purchase_price: 300, line_total: 1250 }] },
    ],
    payments: [{ amount: 5000, method: 'wave' }],
    expenses: [{ amount: 1500, category: 'Transport' }],
    products: [{ id: 'p1', category_id: 'k1' }, { id: 'p2', category_id: 'k2' }],
    categories: [{ id: 'k1', name: 'Ciment' }, { id: 'k2', name: 'Électricité' }],
    users: [{ id: 'u1', full_name: 'Momo' }, { id: 'u2', full_name: 'Fallou' }],
  })
  it('calcule CA, encaissé, marge et bénéfice', () => {
    expect(report.kpis.revenue).toBe(10250)
    expect(report.kpis.collected).toBe(6250)
    // marge lignes : 2×1000 + 2,5×200 = 2500, moins 1000 de remise
    expect(report.kpis.grossMargin).toBe(1500)
    expect(report.kpis.profit).toBe(0)
    expect(report.kpis.count).toBe(2)
  })
  it('classe produits, catégories, clients et modes de paiement', () => {
    expect(report.topProducts[0].name).toBe('Ciment')
    expect(report.byCategory.map((c) => c.name)).toEqual(['Ciment', 'Électricité'])
    expect(report.topClients[0]).toMatchObject({ name: 'Awa', due: 4000 })
    expect(report.byMethod.find((m) => m.method === 'wave').label).toBe('Wave')
    expect(report.series).toHaveLength(30)
  })
  it('calcule les bornes de période', () => {
    const { from: f, to: t } = periodRange('custom', { from: '2026-10-01', to: '2026-10-31' })
    expect(f.getDate()).toBe(1)
    expect(t.getMonth()).toBe(10) // 1er novembre exclu
  })
})
