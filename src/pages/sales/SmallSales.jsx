import { useEffect, useState, useMemo, useRef } from 'react'
import { Plus, Trash2, ShoppingCart, Search, ChevronDown, Check, Zap, Receipt } from 'lucide-react'
import { useProducts } from '../../hooks/useProducts'
import { useSmallSales, useCreateSmallSale } from '../../hooks/useSmallSales'
import { useAuth } from '../../context/AuthContext'
import Pagination from '../../components/Pagination'
import { currency } from '../../lib/constants'

const defaultOptionLabel = (option) => option.label
const defaultSearchText = (option) => option.searchText || option.label

function SearchableSelect({ value, onChange, options, placeholder, getOptionLabel = defaultOptionLabel, getSearchText = defaultSearchText, emptyMessage = 'Aucun résultat' }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const wrapperRef = useRef(null)

  const selectedOption = useMemo(() => options.find((option) => option.value === value), [options, value])

  useEffect(() => {
    setQuery(selectedOption ? getOptionLabel(selectedOption) : '')
  }, [selectedOption, getOptionLabel])

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!wrapperRef.current?.contains(event.target)) setOpen(false)
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const normalizedQuery = query.trim().toLowerCase()
  const filteredOptions = useMemo(() => {
    if (!normalizedQuery || (selectedOption && query === getOptionLabel(selectedOption))) return options
    return options.filter((option) => getSearchText(option).toLowerCase().includes(normalizedQuery))
  }, [getOptionLabel, getSearchText, normalizedQuery, options, query, selectedOption])

  const visibleOptions = filteredOptions.slice(0, 80)

  const handleSelect = (option) => {
    if (option.disabled) return
    onChange(option.value)
    setQuery(getOptionLabel(option))
    setOpen(false)
  }

  return (
    <div className="relative" ref={wrapperRef}>
      <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
      <input
        type="text"
        className="input pl-9 pr-9"
        value={query}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setOpen(false)
            return
          }
          if (e.key !== 'Enter' || !open) return

          e.preventDefault()
          const firstAvailableOption = visibleOptions.find((option) => !option.disabled)
          if (firstAvailableOption) handleSelect(firstAvailableOption)
        }}
      />
      <button
        type="button"
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
        onClick={() => setOpen((current) => !current)}
        aria-label="Afficher la liste"
      >
        <ChevronDown size={16} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg">
          <div className="max-h-64 overflow-y-auto py-1">
            {visibleOptions.length === 0 ? (
              <p className="px-3 py-2 text-sm text-gray-400">{emptyMessage}</p>
            ) : (
              visibleOptions.map((option) => (
                <button
                  key={option.value || 'empty-option'}
                  type="button"
                  disabled={option.disabled}
                  className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-45"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleSelect(option)}
                >
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center text-brand-600">
                    {option.value === value && <Check size={14} />}
                  </span>
                  <span className="min-w-0 flex-1">{option.content || getOptionLabel(option)}</span>
                </button>
              ))
            )}
            {filteredOptions.length > visibleOptions.length && (
              <p className="px-3 py-2 text-xs text-gray-400">Affinez la recherche pour voir plus de résultats.</p>
            )}
          </div>
        </div>
      )}
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

  const addProduct = () => {
    if (!productToAdd) return
    const product = products.find((p) => p.id === productToAdd)
    if (!product) return
    const stock = Number(product.stock || 0)
    if (stock <= 0) {
      setError(`Stock insuffisant pour "${product.name}"`)
      return
    }
    setCart((c) => {
      const existing = c.find((item) => item.product_id === product.id)
      if (existing) {
        if (existing.quantity + 1 > stock) {
          setError(`Stock insuffisant pour "${product.name}" (disponible: ${stock})`)
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Petites ventes</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm">Enregistrez rapidement une vente sans générer de facture</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        {/* ---- Panier de vente rapide ---- */}
        <div className="xl:col-span-3 card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Zap size={18} className="text-brand-600 dark:text-brand-400" />
            <h2 className="font-semibold">Nouvelle petite vente</h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <div className="text-sm text-red-600 bg-red-50 dark:bg-red-500/10 rounded-lg px-3 py-2">{error}</div>}
            {success && <div className="text-sm text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 rounded-lg px-3 py-2">{success}</div>}

            <div className="flex gap-2">
              <div className="flex-1 min-w-0">
                <SearchableSelect
                  value={productToAdd}
                  onChange={setProductToAdd}
                  options={productOptions}
                  placeholder="Rechercher un produit (rapide)..."
                  emptyMessage="Aucun produit trouvé"
                />
              </div>
              <button type="button" className="btn-primary shrink-0" onClick={addProduct}>
                <Plus size={16} /> Ajouter
              </button>
            </div>

            {cart.length > 0 && (
              <div className="border border-gray-200 dark:border-gray-700/60 rounded-lg divide-y divide-gray-100 dark:divide-gray-800">
                {cart.map((item) => (
                  <div key={item.product_id} className="flex items-center gap-3 p-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.product_name}</p>
                      <p className="text-xs text-gray-400">PU</p>
                    </div>
                    <input
                      type="number"
                      min="1"
                      className="input w-16 text-center"
                      value={item.quantity}
                      onChange={(e) => updateQuantity(item.product_id, Number(e.target.value))}
                    />
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="input w-24 text-right"
                      value={item.unit_price}
                      onChange={(e) => updatePrice(item.product_id, Number(e.target.value))}
                    />
                    <p className="w-24 text-right text-sm font-semibold">{currency(item.quantity * item.unit_price)}</p>
                    <button type="button" className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg" onClick={() => removeFromCart(item.product_id)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
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

            <div className="border-t border-gray-200 dark:border-gray-700/60 pt-3 space-y-1">
              <div className="flex justify-between text-sm text-gray-500"><span>Sous-total</span><span>{currency(subtotal)}</span></div>
              <div className="flex justify-between text-sm text-gray-500"><span>Remise</span><span>-{currency(discount)}</span></div>
              <div className="flex justify-between text-lg font-bold"><span>Total à encaisser</span><span>{currency(total)}</span></div>
            </div>

            <button type="submit" className="btn-primary w-full" disabled={createSmallSale.isPending}>
              <ShoppingCart size={16} /> {createSmallSale.isPending ? 'Enregistrement...' : 'Encaisser la vente'}
            </button>
          </form>
        </div>

        {/* ---- Résumé du jour ---- */}
        <div className="xl:col-span-2 space-y-4">
          <div className="card p-5 bg-brand-600 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm opacity-80">Ventes du jour</p>
                <p className="text-2xl font-bold mt-1">{currency(todayTotal)}</p>
              </div>
              <Receipt size={28} className="opacity-80" />
            </div>
            <p className="text-xs opacity-80 mt-2">{todayCount} petite{todayCount > 1 ? 's' : ''} vente{todayCount > 1 ? 's' : ''} aujourd'hui</p>
          </div>

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
            <div className="mt-3 space-y-2 max-h-72 overflow-y-auto">
              {paginatedSales.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">Aucune petite vente enregistrée</p>
              ) : (
                paginatedSales.map((s) => (
                  <div key={s.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800/60">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {(s.small_sale_items || []).map((it) => it.product_name).join(', ') || 'Vente'}
                      </p>
                      <p className="text-xs text-gray-400">
                        {s.users?.full_name || 'Vendeur'} · {new Date(s.created_at).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <span className="text-sm font-semibold tabular-nums">{currency(s.total)}</span>
                  </div>
                ))
              )}
            </div>
            <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
          </div>
        </div>
      </div>
    </div>
  )
}
