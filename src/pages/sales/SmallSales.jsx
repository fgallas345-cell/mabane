import { useEffect, useState, useMemo, useRef } from 'react'
import { Plus, Trash2, Search, Zap, Receipt, Minus, ShoppingBag, TrendingUp, CheckCircle2, PackageX } from 'lucide-react'
import { useProducts } from '../../hooks/useProducts'
import { useSmallSales, useCreateSmallSale } from '../../hooks/useSmallSales'
import { useAuth } from '../../context/AuthContext'
import Pagination from '../../components/Pagination'
import { currency } from '../../lib/constants'
import SearchableSelect from '../../components/SearchableSelect'



// Petit composant de quantité avec boutons − / +
function QtyStepper({ value, onChange, max }) {
  return (
    <div className="inline-flex items-center rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
      <button
        type="button"
        className="px-2 py-1.5 text-gray-500 hover:text-brand-600 disabled:opacity-30"
        disabled={value <= 1}
        onClick={() => onChange(Math.max(1, value - 1))}
        aria-label="Diminuer la quantité"
      >
        <Minus size={14} />
      </button>
      <input
        type="number"
        min="1"
        max={max}
        className="w-12 bg-transparent text-center text-sm font-medium outline-none"
        value={value}
        onChange={(e) => onChange(Math.max(1, Number(e.target.value)))}
      />
      <button
        type="button"
        className="px-2 py-1.5 text-gray-500 hover:text-brand-600 disabled:opacity-30"
        disabled={max != null && value >= max}
        onClick={() => onChange(value + 1)}
        aria-label="Augmenter la quantité"
      >
        <Plus size={14} />
      </button>
    </div>
  )
}

export default function SmallSales() {
  const { user } = useAuth()
  const { data: products = [] } = useProducts()
  const { data: smallSales = [] } = useSmallSales()
  const createSmallSale = useCreateSmallSale()

  const [cart, setCart] = useState([]) // {product_id, product_name, quantity, unit_price}
  const [productToAdd, setProductToAdd] = useState('')
  const [notes, setNotes] = useState('')
  const [discount, setDiscount] = useState(0)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 10

  const resetForm = () => {
    setCart([])
    setProductToAdd('')
    setNotes('')
    setDiscount(0)
    setError('')
  }

  const addProduct = (id) => {
    const product = products.find((p) => p.id === id)
    if (!product) return
    const stock = Number(product.stock || 0)
    if (stock <= 0) {
      setError(`Stock insuffisant pour "${product.name}"`)
      setSuccess('')
      return
    }
    setCart((c) => {
      const existing = c.find((item) => item.product_id === product.id)
      if (existing) {
        if (existing.quantity + 1 > stock) {
          setError(`Stock insuffisant pour "${product.name}" (disponible: ${stock})`)
          setSuccess('')
          return c
        }
        return c.map((item) => (item.product_id === product.id ? { ...item, quantity: item.quantity + 1 } : item))
      }
      return [...c, { product_id: product.id, product_name: product.name, quantity: 1, unit_price: Number(product.sale_price) || 0, stock }]
    })
    setProductToAdd('')
    setError('')
  }

  const updateQuantity = (productId, qty) => {
    setCart((c) => c.map((item) => (item.product_id === productId ? { ...item, quantity: Math.max(1, qty) } : item)))
  }

  const updatePrice = (productId, price) => {
    setCart((c) => c.map((item) => (item.product_id === productId ? { ...item, unit_price: Math.max(0, Number(price) || 0) } : item)))
  }

  const removeFromCart = (productId) => {
    setCart((c) => c.filter((item) => item.product_id !== productId))
  }

  const subtotal = useMemo(() => cart.reduce((sum, item) => sum + item.quantity * item.unit_price, 0), [cart])
  const total = Math.max(0, subtotal - Number(discount || 0))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (cart.length === 0) {
      setError('Ajoutez au moins un produit à la vente.')
      return
    }
    const overStock = cart.find((item) => item.quantity > item.stock)
    if (overStock) {
      setError(`Stock insuffisant pour "${overStock.product_name}" (disponible: ${overStock.stock})`)
      return
    }
    if (Number(discount || 0) > subtotal) {
      setError('La remise ne peut pas dépasser le sous-total.')
      return
    }
    try {
      await createSmallSale.mutateAsync({
        userId: user?.id,
        notes,
        discount: Number(discount) || 0,
        items: cart.map((c) => ({
          product_id: c.product_id,
          product_name: c.product_name,
          quantity: c.quantity,
          unit_price: c.unit_price,
        })),
      })
      setSuccess(`Vente de ${currency(total)} enregistrée ✅`)
      resetForm()
    } catch (err) {
      setError(err.message)
    }
  }

  const filteredSales = smallSales.filter(
    (s) =>
      (s.users?.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (s.small_sale_items || []).some((it) => it.product_name.toLowerCase().includes(search.toLowerCase()))
  )

  const totalPages = Math.max(1, Math.ceil(filteredSales.length / pageSize))

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const paginatedSales = filteredSales.slice((page - 1) * pageSize, page * pageSize)

  const todaySales = smallSales.filter((s) => {
    const d = new Date(s.created_at)
    const now = new Date()
    return d.toDateString() === now.toDateString()
  })
  const todayTotal = todaySales.reduce((sum, s) => sum + Number(s.total || 0), 0)
  const todayCount = todaySales.length
  const todayAvg = todayCount > 0 ? todayTotal / todayCount : 0

  const productOptions = useMemo(
    () =>
      products.map((product) => ({
        value: product.id,
        label: `${product.name} - ${currency(product.sale_price)} (stock: ${product.stock})`,
        searchText: `${product.name || ''} ${product.sale_price || ''} ${product.stock || ''}`,
        disabled: Number(product.stock) <= 0,
        content: (
          <span className="flex min-w-0 flex-1 items-start justify-between gap-3">
            <span className="min-w-0">
              <span className="block truncate font-medium">{product.name}</span>
              <span className="block truncate text-xs text-gray-400">Stock: {product.stock}</span>
            </span>
            <span className="shrink-0 text-xs font-semibold tabular-nums text-gray-500 dark:text-gray-300">{currency(product.sale_price)}</span>
          </span>
        ),
      })),
    [products]
  )

  // Produits affichés en "raccourcis rapides" (en stock)
  const quickProducts = useMemo(() => products.filter((p) => Number(p.stock) > 0).slice(0, 8), [products])

  return (
    <div className="space-y-6">
      {/* ---- En-tête ---- */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">Petites ventes</h1>
            <span className="badge bg-brand-100 text-brand-700 dark:bg-brand-500/15 dark:text-brand-400">
              <Zap size={12} className="mr-1" /> Mode rapide
            </span>
          </div>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">
            Enregistrez rapidement une vente sans générer de facture
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        {/* ---- Panier de vente rapide ---- */}
        <div className="xl:col-span-3 space-y-4">
          <div className="card p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 rounded-lg bg-brand-100 dark:bg-brand-500/15 text-brand-600 dark:text-brand-400">
                <ShoppingBag size={18} />
              </div>
              <div>
                <h2 className="font-semibold leading-tight">Nouvelle petite vente</h2>
                <p className="text-xs text-gray-400">Sélectionnez des produits puis encaissez</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 dark:bg-red-500/10 rounded-lg px-3 py-2">
                  <PackageX size={16} className="shrink-0" /> {error}
                </div>
              )}
              {success && (
                <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 dark:bg-emerald-500/10 dark:text-emerald-400 rounded-lg px-3 py-2">
                  <CheckCircle2 size={16} className="shrink-0" /> {success}
                </div>
              )}

              {/* Recherche de produit */}
              <div className="flex gap-2">
                <div className="flex-1 min-w-0">
                  <SearchableSelect
                    value={productToAdd}
                    onChange={setProductToAdd}
                    options={productOptions}
                    placeholder="Rechercher un produit..."
                    emptyMessage="Aucun produit trouvé"
                  />
                </div>
                <button type="button" className="btn-primary shrink-0" onClick={() => addProduct(productToAdd)}>
                  <Plus size={16} /> Ajouter
                </button>
              </div>

              {/* Raccourcis rapides */}
              {quickProducts.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-400 mb-2">Ajout rapide — cliquez sur un produit</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {quickProducts.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => addProduct(p.id)}
                        className="text-left p-2.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-brand-400 dark:hover:border-brand-500 hover:bg-brand-50 dark:hover:bg-brand-500/10 transition-colors"
                      >
                        <p className="text-xs font-medium truncate">{p.name}</p>
                        <p className="text-xs font-bold text-brand-600 dark:text-brand-400 mt-0.5">{currency(p.sale_price)}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">Stock: {p.stock}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Panier */}
              {cart.length > 0 ? (
                <div className="border border-gray-200 dark:border-gray-700/60 rounded-xl overflow-hidden divide-y divide-gray-100 dark:divide-gray-800">
                  {cart.map((item) => (
                    <div key={item.product_id} className="flex items-center gap-3 p-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.product_name}</p>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className="text-xs w-24 bg-transparent text-gray-500 dark:text-gray-400 outline-none border-b border-dashed border-gray-300 dark:border-gray-600 focus:border-brand-500"
                          value={item.unit_price}
                          onChange={(e) => updatePrice(item.product_id, Number(e.target.value))}
                          title="Prix unitaire"
                        />
                      </div>
                      <QtyStepper value={item.quantity} max={item.stock} onChange={(q) => updateQuantity(item.product_id, q)} />
                      <div className="w-24 text-right shrink-0">
                        <p className="text-sm font-semibold tabular-nums">{currency(item.quantity * item.unit_price)}</p>
                      </div>
                      <button type="button" className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg shrink-0" onClick={() => removeFromCart(item.product_id)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl p-8 flex flex-col items-center text-center gap-2">
                  <div className="h-12 w-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400">
                    <ShoppingBag size={20} />
                  </div>
                  <p className="font-medium text-sm">Le panier est vide</p>
                  <p className="text-xs text-gray-400">Ajoutez des produits pour commencer la vente</p>
                </div>
              )}

              {/* Remarque + remise */}
              <div className="flex flex-col sm:flex-row sm:items-end gap-3">
                <div className="flex-1">
                  <label className="label">Remarque (optionnel)</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="Ex: vente au comptoir, réparation..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
                <div className="sm:w-40">
                  <label className="label">Remise (FCFA)</label>
                  <input type="number" min="0" max={subtotal} className="input text-right" value={discount} onChange={(e) => setDiscount(e.target.value)} />
                </div>
              </div>

              {/* Récapitulatif */}
              <div className="rounded-xl bg-gray-50 dark:bg-gray-800/60 p-4 space-y-1.5">
                <div className="flex justify-between text-sm text-gray-500"><span>Sous-total</span><span>{currency(subtotal)}</span></div>
                <div className="flex justify-between text-sm text-gray-500"><span>Remise</span><span>-{currency(discount)}</span></div>
                <div className="flex items-center justify-between pt-2 mt-1 border-t border-gray-200 dark:border-gray-700">
                  <span className="font-semibold">Total à encaisser</span>
                  <span className="text-2xl font-extrabold text-brand-600 dark:text-brand-400 tabular-nums">{currency(total)}</span>
                </div>
              </div>

              <button type="submit" className="btn-primary w-full !py-3 text-base" disabled={createSmallSale.isPending || cart.length === 0}>
                <ShoppingBag size={18} /> {createSmallSale.isPending ? 'Enregistrement...' : 'Encaisser la vente'}
              </button>
            </form>
          </div>
        </div>

        {/* ---- Colonne droite ---- */}
        <div className="xl:col-span-2 space-y-4">
          {/* Statistiques du jour */}
          <div className="grid grid-cols-2 gap-3">
            <div className="card p-4 bg-brand-600 text-white border-0">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium opacity-80">Ventes du jour</p>
                <TrendingUp size={16} className="opacity-80" />
              </div>
              <p className="text-xl font-bold mt-1 tabular-nums">{currency(todayTotal)}</p>
              <p className="text-[11px] opacity-80 mt-0.5">{todayCount} vente{todayCount > 1 ? 's' : ''}</p>
            </div>
            <div className="card p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-gray-500">Ticket moyen</p>
                <Receipt size={16} className="text-gray-400" />
              </div>
              <p className="text-xl font-bold mt-1 tabular-nums">{currency(todayAvg)}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">{todayCount > 0 ? 'par vente' : 'aucune vente'}</p>
            </div>
          </div>

          {/* Historique récent */}
          <div className="card p-5">
            <h3 className="font-semibold mb-3">Historique récent</h3>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                className="input pl-9"
                placeholder="Rechercher un produit / vendeur..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              />
            </div>
            <div className="mt-3 space-y-2 max-h-[420px] overflow-y-auto">
              {paginatedSales.length === 0 ? (
                <div className="text-center py-8">
                  <div className="h-10 w-10 mx-auto rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400">
                    <Receipt size={16} />
                  </div>
                  <p className="text-sm text-gray-400 mt-2">Aucune petite vente enregistrée</p>
                </div>
              ) : (
                paginatedSales.map((s) => (
                  <div key={s.id} className="flex items-center justify-between gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/60 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {(s.small_sale_items || []).map((it) => it.product_name).join(', ') || 'Vente'}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {s.users?.full_name || 'Vendeur'} · {new Date(s.created_at).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <span className="text-sm font-bold text-gray-700 dark:text-gray-200 tabular-nums shrink-0">{currency(s.total)}</span>
                  </div>
                ))
              )}
            </div>
            {paginatedSales.length > 0 && <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />}
          </div>
        </div>
      </div>
    </div>
  )
}
