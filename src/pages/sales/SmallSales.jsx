import { useEffect, useState, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Trash2, Search, Receipt, ShoppingBag, CheckCircle2, PackageX, Pencil, ShoppingCart, Ticket, Box, Plus, Flame, ArrowRight, ArrowUp, ArrowDown, ScanLine, Banknote, BarChart3, Package } from 'lucide-react'
import { useProducts } from '../../hooks/useProducts'
import { useSmallSales, useCreateSmallSale, useUpdateSmallSale, useDeleteSmallSale } from '../../hooks/useSmallSales'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import Pagination from '../../components/Pagination'
import Modal from '../../components/Modal'
import ConfirmDialog from '../../components/ConfirmDialog'
import { currency, displayName } from '../../lib/constants'
import { formatQty } from '../../utils/quantity'
import SearchableSelect from '../../components/SearchableSelect'
import QtyStepper from '../../components/QtyStepper'


// ---------------------------------------------------------------------------
// Éléments visuels de la caisse rapide
// ---------------------------------------------------------------------------
function RegisterIllustration({ className = '' }) {
  return (
    <svg viewBox="0 0 160 112" className={className} aria-hidden="true">
      <ellipse cx="80" cy="66" rx="76" ry="44" fill="#dfe9fb" className="dark:opacity-20" />
      {/* Ticket qui sort de la caisse */}
      <path d="M70 10 h34 v34 l-4 -3 -4 3 -4 -3 -4 3 -4 -3 -4 3 -4 -3 -2 2 z" fill="#ffffff" stroke="#1e3a7b" strokeWidth="2" />
      <path d="M76 20 h22 M76 27 h16 M76 34 h19" stroke="#9cc2f5" strokeWidth="2.5" strokeLinecap="round" />
      {/* Écran */}
      <rect x="38" y="22" width="26" height="18" rx="3" fill="#1e3a7b" />
      <rect x="42" y="26" width="18" height="8" rx="1.5" fill="#9cc2f5" />
      <rect x="49" y="40" width="4" height="10" fill="#1e3a7b" />
      {/* Corps de la caisse */}
      <path d="M30 50 h96 l8 34 h-112 z" fill="#2b5c94" stroke="#1e3a7b" strokeWidth="2.5" strokeLinejoin="round" />
      {[0, 1, 2].map((r) =>
        [0, 1, 2, 3].map((c) => (
          <rect key={`${r}-${c}`} x={44 + c * 13 + r * 1.5} y={56 + r * 8} width="9" height="5" rx="1.5" fill={c === 3 && r === 2 ? '#f39e26' : '#cfe0f7'} />
        ))
      )}
      <rect x="100" y="57" width="18" height="20" rx="3" fill="#f39e26" stroke="#1e3a7b" strokeWidth="2" />
      {/* Tiroir */}
      <rect x="18" y="84" width="124" height="16" rx="3" fill="#1e3a7b" />
      <rect x="66" y="90" width="28" height="4" rx="2" fill="#9cc2f5" />
    </svg>
  )
}

/** Petites barres montantes décoratives (cartes de statistiques) */
function MiniBars({ className = '', color, line }) {
  return (
    <svg viewBox="0 0 96 48" className={className} aria-hidden="true">
      {[10, 16, 22, 30, 40].map((h, i) => (
        <rect key={i} x={i * 19 + 2} y={48 - h} width="13" height={h} rx="2.5" fill={color} opacity={0.35 + i * 0.15} />
      ))}
      {line && (
        <>
          <path d="M2 40 L30 30 L46 34 L88 6" fill="none" stroke={line} strokeWidth="4" strokeLinecap="round" />
          <path d="M76 5 L90 4 L89 18" fill="none" stroke={line} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
    </svg>
  )
}

function TrendBadge({ pct, dark }) {
  if (pct == null) return null
  const up = pct >= 0
  const Icon = up ? ArrowUp : ArrowDown
  return (
    <span className={`inline-flex items-center gap-0.5 font-bold ${up ? (dark ? 'text-emerald-300' : 'text-emerald-600 dark:text-emerald-400') : dark ? 'text-red-300' : 'text-red-600 dark:text-red-400'}`}>
      <Icon size={13} strokeWidth={3} /> {up ? '+' : ''}{pct}%
    </span>
  )
}

function ProductImage({ src, className = '' }) {
  return src ? (
    <img src={src} alt="" loading="lazy" className={`${className} shrink-0 rounded-xl object-cover bg-gray-50 dark:bg-white/[0.04]`} />
  ) : (
    <span className={`${className} shrink-0 rounded-xl bg-gray-100 dark:bg-white/[0.06] text-gray-400 flex items-center justify-center`}>
      <Package size={18} />
    </span>
  )
}

/** « Aujourd'hui », « Hier » ou « 12 nov. » */
function relativeDay(date) {
  const d = new Date(date)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return "Aujourd'hui"
  if (d.toDateString() === yesterday.toDateString()) return 'Hier'
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

const pctChange = (cur, prev) => (prev ? Math.round(((cur - prev) / prev) * 100) : null)

export default function SmallSales() {
  const { user, isAdmin } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const searchBoxRef = useRef(null)
  const [showAllQuick, setShowAllQuick] = useState(false)
  const [showAllHistory, setShowAllHistory] = useState(false)
  const { data: products = [] } = useProducts()
  // Unité d'un produit (m, kg, L... → quantité décimale autorisée)
  const unitOf = (productId) => products.find((p) => p.id === productId)?.unit
  const { data: smallSales = [] } = useSmallSales()
  const [cart, setCart] = useState([]) // {product_id, product_name, quantity, unit_price}
  const [notes, setNotes] = useState('')
  const [discount, setDiscount] = useState(0)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 10
  const [editSale, setEditSale] = useState(null)
  const [editCart, setEditCart] = useState([])
  const [editNotes, setEditNotes] = useState('')
  const [editDiscount, setEditDiscount] = useState(0)
  const [editError, setEditError] = useState('')
  const [deleteSaleTarget, setDeleteSaleTarget] = useState(null)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  const updateSmallSale = useUpdateSmallSale()
  const deleteSmallSale = useDeleteSmallSale()
  const createSmallSale = useCreateSmallSale()

  const resetForm = () => {
    setCart([])
    setNotes('')
    setDiscount(0)
    setError('')
  }

  const getAvailableStock = (productId, currentQuantity = 0) => {
    const product = products.find((p) => p.id === productId)
    return Number(product?.stock || 0) + currentQuantity
  }

  const addProductToCart = (id, cartState, setCartState, setErrorState) => {
    const product = products.find((p) => p.id === id)
    if (!product) return
    const existing = cartState.find((item) => item.product_id === product.id)
    const availableStock = getAvailableStock(product.id, existing?.quantity || 0)
    if (availableStock <= 0) {
      setErrorState(`Stock insuffisant pour "${product.name}"`)
      return
    }

    setCartState((c) => {
      const current = c.find((item) => item.product_id === product.id)
      if (current) {
        if (current.quantity + 1 > availableStock) {
          setErrorState(`Stock insuffisant pour "${product.name}" (disponible: ${availableStock})`)
          return c
        }
        return c.map((item) =>
          item.product_id === product.id ? { ...item, quantity: item.quantity + 1, stock: availableStock } : item
        )
      }

      return [
        ...c,
        {
          product_id: product.id,
          product_name: product.name,
          quantity: 1,
          unit_price: Number(product.sale_price) || 0,
          stock: availableStock,
        },
      ]
    })
    setErrorState('')
  }

  const addProduct = (id) => addProductToCart(id, cart, setCart, setError)
  const addProductToEdit = (id) => addProductToCart(id, editCart, setEditCart, setEditError)

  const updateCartQuantity = (productId, qty, cartState, setCartState, setErrorState) => {
    const item = cartState.find((item) => item.product_id === productId)
    if (!item) return
    const availableStock = getAvailableStock(productId, item.quantity)
    if (qty > availableStock) {
      setErrorState(`Stock insuffisant pour "${item.product_name}" (disponible: ${availableStock})`)
      return
    }
    setCartState((c) => c.map((item) =>
      item.product_id === productId ? { ...item, quantity: Math.max(1, qty), stock: availableStock } : item
    ))
    setErrorState('')
  }

  const updateCartPrice = (productId, price, setCartState) => {
    setCartState((c) => c.map((item) =>
      item.product_id === productId ? { ...item, unit_price: Math.max(0, Number(price) || 0) } : item
    ))
  }

  const updateQuantity = (productId, qty) => updateCartQuantity(productId, qty, cart, setCart, setError)
  const updatePrice = (productId, price) => updateCartPrice(productId, price, setCart)
  const updateEditQuantity = (productId, qty) => updateCartQuantity(productId, qty, editCart, setEditCart, setEditError)
  const updateEditPrice = (productId, price) => updateCartPrice(productId, price, setEditCart)

  const removeFromCart = (productId) => {
    setCart((c) => c.filter((item) => item.product_id !== productId))
  }

  const removeFromEditCart = (productId) => {
    setEditCart((c) => c.filter((item) => item.product_id !== productId))
  }

  const subtotal = useMemo(() => cart.reduce((sum, item) => sum + item.quantity * item.unit_price, 0), [cart])
  const total = Math.max(0, subtotal - Number(discount || 0))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (cart.length === 0) {
      const message = 'Ajoutez au moins un produit à la vente.'
      setError(message)
      toast.error(message)
      return
    }
    const overStock = cart.find((item) => item.quantity > item.stock)
    if (overStock) {
      const message = `Stock insuffisant pour "${overStock.product_name}" (disponible: ${formatQty(overStock.stock)})`
      setError(message)
      toast.error(message)
      return
    }
    if (Number(discount || 0) > subtotal) {
      const message = 'La remise ne peut pas dépasser le sous-total.'
      setError(message)
      toast.error(message)
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
      const message = `Vente de ${currency(total)} enregistrée`
      setSuccess(message)
      toast.success(message)
      resetForm()
    } catch (err) {
      const message = err.message || 'Erreur lors de l’enregistrement de la vente.'
      setError(message)
      toast.error(message)
    }
  }

  const handleOpenEdit = (sale) => {
    setEditSale(sale)
    setEditNotes(sale.notes || '')
    setEditDiscount(Number(sale.discount) || 0)
    setEditCart(
      (sale.small_sale_items || []).map((item) => ({
        product_id: item.product_id,
        product_name: item.product_name,
        quantity: item.quantity,
        unit_price: Number(item.unit_price),
        stock: getAvailableStock(item.product_id, item.quantity),
      }))
    )
    setEditError('')
  }

  const handleCloseEdit = () => {
    setEditSale(null)
    setEditCart([])
    setEditNotes('')
    setEditDiscount(0)
    setEditError('')
  }

  const handleUpdateSubmit = async (e) => {
    e.preventDefault()
    setEditError('')
    setSuccess('')
    if (editCart.length === 0) {
      const message = 'La vente doit contenir au moins un produit.'
      setEditError(message)
      toast.error(message)
      return
    }
    const overStock = editCart.find((item) => item.quantity > item.stock)
    if (overStock) {
      const message = `Stock insuffisant pour "${overStock.product_name}" (disponible: ${formatQty(overStock.stock)})`
      setEditError(message)
      toast.error(message)
      return
    }
    if (Number(editDiscount || 0) > editCart.reduce((sum, item) => sum + item.quantity * item.unit_price, 0)) {
      const message = 'La remise ne peut pas dépasser le sous-total.'
      setEditError(message)
      toast.error(message)
      return
    }
    try {
      await updateSmallSale.mutateAsync({
        saleId: editSale.id,
        notes: editNotes,
        discount: Number(editDiscount) || 0,
        items: editCart.map((item) => ({
          product_id: item.product_id,
          product_name: item.product_name,
          quantity: item.quantity,
          unit_price: item.unit_price,
        })),
      })
      setSuccess('Vente modifiée avec succès')
      handleCloseEdit()
    } catch (err) {
      const message = err.message || 'Erreur lors de la mise à jour de la vente.'
      setEditError(message)
      toast.error(message)
    }
  }

  const handleDeleteSale = async () => {
    if (!deleteSaleTarget) return
    setError('')
    setSuccess('')
    try {
      await deleteSmallSale.mutateAsync(deleteSaleTarget.id)
      const message = 'Vente annulée et stock restitué'
      setSuccess(message)
      toast.success(message)
      setDeleteSaleTarget(null)
    } catch (err) {
      const message = err.message || 'Erreur lors de la suppression de la vente.'
      setError(message)
      toast.error(message)
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

  // Comparaison avec hier à la même heure
  const yesterdayStart = new Date()
  yesterdayStart.setHours(0, 0, 0, 0)
  yesterdayStart.setDate(yesterdayStart.getDate() - 1)
  const sameTimeYesterday = Date.now() - 24 * 60 * 60 * 1000
  const yesterdaySales = smallSales.filter((s) => {
    const t = new Date(s.created_at).getTime()
    return t >= yesterdayStart.getTime() && t < sameTimeYesterday
  })
  const yesterdayTotal = yesterdaySales.reduce((sum, s) => sum + Number(s.total || 0), 0)
  const todayTrend = pctChange(todayTotal, yesterdayTotal)
  const avgTrend = todayCount > 0 && yesterdaySales.length > 0 ? pctChange(todayAvg, yesterdayTotal / yesterdaySales.length) : null

  const productsById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products])
  const historyRows = showAllHistory ? paginatedSales : smallSales.slice(0, 6)

  const productOptions = useMemo(
    () =>
      products.map((product) => ({
        value: product.id,
        label: `${product.name} - ${currency(product.sale_price)} (stock: ${formatQty(product.stock)})`,
        searchText: `${product.name || ''} ${product.sale_price || ''} ${product.stock || ''}`,
        disabled: Number(product.stock) <= 0,
        content: (
          <span className="flex min-w-0 flex-1 items-start justify-between gap-3">
            <span className="min-w-0">
              <span className="block truncate font-medium">{product.name}</span>
              <span className="block truncate text-xs text-gray-400">Stock: {formatQty(product.stock)}</span>
            </span>
            <span className="shrink-0 text-xs font-semibold tabular-nums text-gray-500 dark:text-gray-300">{currency(product.sale_price)}</span>
          </span>
        ),
      })),
    [products]
  )

  // Produits affichés en "raccourcis rapides" (en stock)
  // Produits rapides = les plus vendus au comptoir (nombre de ventes), en stock ; complété par le catalogue
  const quickProducts = useMemo(() => {
    const frequency = new Map()
    smallSales.forEach((sale) =>
      (sale.small_sale_items || []).forEach((item) => {
        if (item.product_id) frequency.set(item.product_id, (frequency.get(item.product_id) || 0) + 1)
      })
    )
    const inStock = products.filter((p) => Number(p.stock) > 0)
    const best = inStock.filter((p) => frequency.has(p.id)).sort((a, b) => frequency.get(b.id) - frequency.get(a.id))
    const rest = inStock.filter((p) => !frequency.has(p.id))
    return [...best, ...rest].slice(0, 12)
  }, [products, smallSales])

  return (
    <div className="space-y-6">
      {/* ---- En-tête : illustration, titre, chiffres du jour ---- */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_auto] gap-4 xl:items-center">
        <div className="flex items-center gap-5">
          <RegisterIllustration className="hidden sm:block h-24 w-36 shrink-0" />
          <div>
            <h1 className="text-2xl sm:text-[32px] font-extrabold tracking-tight text-brand-900 dark:text-gray-50">Caisse rapide</h1>
            <p className="text-[15px] text-gray-600 dark:text-gray-400 mt-1">Enregistrez rapidement une vente sans générer de facture</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 xl:w-[700px]">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#13306f] to-[#0b2152] text-white p-5 shadow-[0_14px_30px_-14px_rgba(19,48,111,0.7)] flex items-center gap-4">
            <span className="h-14 w-14 shrink-0 rounded-2xl bg-[#2f6bea] flex items-center justify-center">
              <ShoppingCart size={26} />
            </span>
            <div className="relative min-w-0">
              <p className="text-sm text-white/85">Ventes du jour</p>
              <p className="text-2xl font-extrabold tabular-nums leading-tight">{currency(todayTotal)}</p>
              <p className="text-xs text-white/70 flex items-center gap-1.5 mt-0.5">
                <TrendBadge pct={todayTrend} dark /> {todayCount} vente{todayCount > 1 ? 's' : ''}
              </p>
            </div>
            <MiniBars className="absolute right-4 bottom-4 h-12 w-24" color="#3b82f6" line="#60a5fa" />
          </div>
          <div className="relative overflow-hidden card !rounded-3xl p-5 flex items-center gap-4">
            <span className="h-14 w-14 shrink-0 rounded-2xl bg-accent-100 text-accent-600 dark:bg-accent-500/15 dark:text-accent-400 flex items-center justify-center">
              <Ticket size={26} />
            </span>
            <div className="relative min-w-0">
              <p className="text-sm text-gray-600 dark:text-gray-400">Ticket moyen</p>
              <p className="text-2xl font-extrabold tabular-nums leading-tight text-brand-900 dark:text-gray-50">{currency(todayAvg)}</p>
              <p className="text-xs text-gray-400 flex items-center gap-1.5 mt-0.5">
                <TrendBadge pct={avgTrend} /> {todayCount > 0 ? 'par vente' : 'aucune vente'}
              </p>
            </div>
            <MiniBars className="absolute right-4 bottom-4 h-12 w-24" color="#93c5fd" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        {/* ---- Panier de vente rapide ---- */}
        <div className="xl:col-span-3">
          <div className="card !rounded-3xl p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                <span className="h-11 w-11 rounded-xl bg-blue-50 text-[#1e3a7b] dark:bg-blue-500/15 dark:text-blue-300 flex items-center justify-center">
                  <Box size={22} />
                </span>
                <h2 className="text-xl font-bold text-brand-900 dark:text-gray-50">Nouvelle petite vente</h2>
              </div>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-xl bg-blue-50 hover:bg-blue-100 dark:bg-blue-500/15 dark:hover:bg-blue-500/25 px-4 py-2.5 text-sm font-semibold text-[#1e3a7b] dark:text-blue-200"
                onClick={() => searchBoxRef.current?.querySelector('input')?.focus()}
              >
                <Plus size={16} strokeWidth={2.5} /> Sélectionner un produit
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 dark:bg-red-500/10 rounded-xl px-3 py-2">
                  <PackageX size={16} className="shrink-0" /> {error}
                </div>
              )}
              {success && (
                <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 dark:bg-emerald-500/10 dark:text-emerald-400 rounded-xl px-3 py-2">
                  <CheckCircle2 size={16} className="shrink-0" /> {success}
                </div>
              )}

              {/* Recherche de produit */}
              <div ref={searchBoxRef}>
                <SearchableSelect
                  value=""
                  onChange={(id) => addProduct(id)}
                  options={productOptions}
                  placeholder="Tapez le nom du produit puis Entrée..."
                  emptyMessage="Aucun produit trouvé"
                  clearOnSelect
                  autoFocus
                />
              </div>

              {/* Les plus vendus */}
              {quickProducts.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <p className="flex items-center gap-1.5 font-bold text-brand-900 dark:text-gray-100">
                      Les plus vendus <Flame size={17} className="text-orange-500 fill-orange-400" />
                    </p>
                    {quickProducts.length > 6 && (
                      <button type="button" className="flex items-center gap-1 text-sm font-semibold text-blue-700 dark:text-blue-300 hover:underline" onClick={() => setShowAllQuick((v) => !v)}>
                        {showAllQuick ? 'Moins' : 'Voir tout'} <ArrowRight size={14} />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {(showAllQuick ? quickProducts : quickProducts.slice(0, 6)).map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => addProduct(p.id)}
                        className="flex items-center gap-3 text-left p-3 rounded-2xl border border-gray-200/80 dark:border-white/[0.08] bg-white dark:bg-white/[0.02] hover:border-blue-300 hover:shadow-card dark:hover:border-blue-500/50 transition-all active:scale-[0.98]"
                      >
                        <ProductImage src={p.image_url} className="h-12 w-12" />
                        <span className="min-w-0">
                          <span className="block text-[13px] font-bold uppercase text-brand-900 dark:text-gray-100 truncate">{p.name}</span>
                          <span className="block text-[13px] font-bold text-brand-900 dark:text-gray-200 tabular-nums">{currency(p.sale_price)}</span>
                          <span className="block text-[11px] text-gray-400">Stock: {formatQty(p.stock)}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Panier */}
              {cart.length > 0 ? (
                <div className="rounded-2xl border border-gray-200 dark:border-white/[0.08] overflow-hidden divide-y divide-gray-100 dark:divide-white/[0.06]">
                  {cart.map((item) => (
                    <div key={item.product_id} className="flex flex-wrap sm:flex-nowrap items-center gap-3 p-3">
                      <ProductImage src={productsById.get(item.product_id)?.image_url} className="h-10 w-10" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold uppercase text-brand-900 dark:text-gray-100 truncate">{item.product_name}</p>
                        <label className="flex items-center gap-1.5 mt-1 text-xs text-gray-400">
                          Prix
                          <input
                            type="number"
                            inputMode="numeric"
                            min="0"
                            className="input h-7 w-24 !py-0 text-right text-xs"
                            value={item.unit_price}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => updatePrice(item.product_id, Number(e.target.value))}
                            aria-label="Prix unitaire"
                          />
                        </label>
                      </div>
                      <QtyStepper value={item.quantity} unit={unitOf(item.product_id)} max={item.stock} onChange={(q) => updateQuantity(item.product_id, q)} />
                      <div className="w-24 text-right shrink-0">
                        <p className="text-sm font-bold tabular-nums text-brand-900 dark:text-gray-100">{currency(item.quantity * item.unit_price)}</p>
                      </div>
                      <button type="button" aria-label="Retirer du panier" className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl shrink-0" onClick={() => removeFromCart(item.product_id)}>
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="border-2 border-dashed border-gray-200 dark:border-white/10 rounded-2xl py-7 px-4 flex flex-col items-center text-center gap-1.5">
                  <div className="h-12 w-12 rounded-full bg-blue-50 dark:bg-blue-500/15 flex items-center justify-center text-[#1e3a7b] dark:text-blue-300 mb-1">
                    <ScanLine size={22} />
                  </div>
                  <p className="font-bold text-brand-900 dark:text-gray-100">Le panier est vide</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Ajoutez des produits pour commencer la vente</p>
                </div>
              )}

              {/* Remarque + remise */}
              <div className="flex flex-col sm:flex-row sm:items-end gap-3">
                <div className="flex-1">
                  <label className="label" htmlFor="small-sale-notes">Remarque (optionnel)</label>
                  <input
                    id="small-sale-notes"
                    type="text"
                    className="input"
                    placeholder="Ex. : vente au comptoir, réparation..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
                <div className="sm:w-44">
                  <label className="label" htmlFor="small-sale-discount">Remise (FCFA)</label>
                  <input id="small-sale-discount" type="number" min="0" max={subtotal} className="input text-right" value={discount} onChange={(e) => setDiscount(e.target.value)} />
                </div>
              </div>

              {/* Récapitulatif */}
              <div className="grid grid-cols-1 sm:grid-cols-[2fr_3fr] gap-3">
                <div className="rounded-2xl bg-gray-50 dark:bg-white/[0.04] px-4 py-3 space-y-1 text-sm text-gray-600 dark:text-gray-300">
                  <div className="flex justify-between"><span>Sous-total</span><span className="tabular-nums">{currency(subtotal)}</span></div>
                  <div className="flex justify-between"><span>Remise</span><span className="tabular-nums">-{currency(discount)}</span></div>
                </div>
                <div className="rounded-2xl bg-blue-50/70 dark:bg-blue-500/10 px-5 py-3 flex items-center justify-between gap-3">
                  <span className="font-bold text-brand-900 dark:text-gray-100">Total à encaisser</span>
                  <span className="text-[28px] font-extrabold text-[#1d4fb8] dark:text-blue-300 tabular-nums leading-none">{currency(total)}</span>
                </div>
              </div>

              <div className="sticky -bottom-6 lg:-bottom-8 -mx-5 sm:-mx-6 -mb-5 sm:-mb-6 px-5 sm:px-6 py-3 bg-white/95 dark:bg-darkcard/95 backdrop-blur rounded-b-3xl">
                <button type="submit" className="btn-accent w-full !rounded-2xl !py-3.5 text-base" disabled={createSmallSale.isPending || cart.length === 0}>
                  {cart.length === 0 ? <ShoppingBag size={18} /> : <Banknote size={19} />}
                  {createSmallSale.isPending ? 'Enregistrement...' : cart.length === 0 ? 'Ajouter un produit' : `Encaisser ${currency(total)}`}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* ---- Colonne droite : historique + encart rapports ---- */}
        <div className="xl:col-span-2 space-y-5">
          <div className="card !rounded-3xl overflow-hidden">
            <div className="flex items-center justify-between gap-3 bg-[#0d2550] dark:bg-[#0b1d3d] px-5 py-4">
              <h3 className="text-lg font-bold text-white">Historique récent</h3>
              <button
                type="button"
                className="flex items-center gap-1 text-sm font-semibold text-accent-400 hover:text-accent-300"
                onClick={() => {
                  setShowAllHistory((v) => !v)
                  setSearch('')
                  setPage(1)
                }}
              >
                {showAllHistory ? 'Réduire' : 'Voir tout'} <ArrowRight size={15} />
              </button>
            </div>

            {showAllHistory && (
              <div className="px-4 pt-4">
                <div className="relative">
                  <Search size={18} className="search-icon" />
                  <input
                    className="search-field"
                    placeholder="Rechercher un produit / vendeur..."
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                  />
                </div>
              </div>
            )}

            <div className={`px-4 py-2 divide-y divide-gray-100 dark:divide-white/[0.06] ${showAllHistory ? 'max-h-[560px] overflow-y-auto' : ''}`}>
              {historyRows.length === 0 ? (
                <div className="text-center py-10">
                  <div className="h-10 w-10 mx-auto rounded-full bg-gray-100 dark:bg-white/[0.06] flex items-center justify-center text-gray-400">
                    <Receipt size={16} />
                  </div>
                  <p className="text-sm text-gray-400 mt-2">{search ? 'Aucun résultat' : 'Aucune petite vente enregistrée'}</p>
                </div>
              ) : (
                historyRows.map((s) => {
                  const items = s.small_sale_items || []
                  return (
                    <div key={s.id} className="flex items-center gap-3 py-3">
                      <ProductImage src={productsById.get(items[0]?.product_id)?.image_url} className="h-12 w-12" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold uppercase text-brand-900 dark:text-gray-100 truncate" title={items.map((it) => it.product_name).join(', ')}>
                          {items.map((it) => it.product_name).join(', ') || 'Vente'}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                          {relativeDay(s.created_at)} • {new Date(s.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                          {showAllHistory && ` · ${displayName(s.users?.full_name, 'Vendeur')}`}
                        </p>
                      </div>
                      <span className="text-[15px] font-extrabold text-brand-900 dark:text-gray-100 tabular-nums shrink-0">{currency(s.total)}</span>
                      {isAdmin && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button type="button" title="Modifier la vente" aria-label="Modifier la vente" className="h-9 w-9 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.1] text-brand-900 dark:text-gray-200 flex items-center justify-center" onClick={() => handleOpenEdit(s)}>
                            <Pencil size={15} />
                          </button>
                          <button type="button" title="Annuler la vente" aria-label="Annuler la vente" className="h-9 w-9 rounded-xl bg-red-50 hover:bg-red-100 dark:bg-red-500/10 dark:hover:bg-red-500/20 text-red-600 dark:text-red-400 flex items-center justify-center" onClick={() => setDeleteSaleTarget(s)}>
                            <Trash2 size={15} />
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
            {showAllHistory && paginatedSales.length > 0 && (
              <div className="px-4 pb-3">
                <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
              </div>
            )}
          </div>

          {/* Encart rapports */}
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-50 to-blue-100/70 dark:from-blue-500/10 dark:to-blue-500/5 border border-blue-100 dark:border-blue-500/20 p-5 min-h-[130px]">
            <svg viewBox="0 0 160 110" className="absolute right-0 bottom-0 h-full w-1/2 opacity-90" aria-hidden="true">
              <path d="M0 110 C 40 80, 70 95, 100 70 S 150 40, 160 30 L160 110 Z" fill="#bfdbfe" opacity="0.6" />
              {[0, 1, 2].map((i) => (
                <rect key={i} x={90 + i * 18} y={70 - i * 14} width="12" height={40 + i * 14} rx="3" fill="#3b82f6" opacity={0.35 + i * 0.2} />
              ))}
              <path d="M60 80 L95 55 L115 62 L150 22" fill="none" stroke="#f39e26" strokeWidth="4" strokeLinecap="round" />
              <path d="M138 20 L152 20 L150 34" fill="none" stroke="#f39e26" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <div className="relative flex items-start gap-3 max-w-[70%]">
              <BarChart3 size={34} className="shrink-0 text-[#1d4fb8] dark:text-blue-300" />
              <div>
                <p className="text-lg font-extrabold text-brand-900 dark:text-gray-50">Boostez vos ventes !</p>
                <p className="text-sm text-gray-600 dark:text-gray-300">Gardez un œil sur vos performances en temps réel.</p>
              </div>
            </div>
            <div className="relative mt-4 flex justify-end">
              <button type="button" className="btn-accent !rounded-xl !py-2 text-sm" onClick={() => navigate('/rapports')}>
                Voir les rapports <ArrowRight size={15} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <Modal open={!!editSale} onClose={handleCloseEdit} icon={Pencil} title={`Modifier la petite vente`} maxWidth="max-w-2xl">
        <form onSubmit={handleUpdateSubmit} className="space-y-4">
          {editError && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 dark:bg-red-500/10 rounded-xl px-3 py-2">
              <PackageX size={16} className="shrink-0" /> {editError}
            </div>
          )}
          <SearchableSelect
            value=""
            onChange={(id) => addProductToEdit(id)}
            options={productOptions}
            placeholder="Tapez le nom du produit puis Entrée..."
            emptyMessage="Aucun produit trouvé"
            clearOnSelect
          />
          {quickProducts.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Les plus vendus — un clic pour ajouter</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {quickProducts.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => addProductToEdit(p.id)}
                    className="text-left p-2.5 rounded-xl border border-gray-200 dark:border-white/10 hover:border-blue-300 dark:hover:border-blue-500/50 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors"
                  >
                    <p className="text-xs font-medium truncate">{p.name}</p>
                    <p className="text-xs font-bold text-[#1d4fb8] dark:text-blue-300 mt-0.5">{currency(p.sale_price)}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">Stock: {formatQty(p.stock)}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {editCart.length > 0 ? (
            <div className="border border-gray-200 dark:border-white/[0.08] rounded-xl overflow-hidden divide-y divide-gray-100 dark:divide-white/[0.06]">
              {editCart.map((item) => (
                <div key={item.product_id} className="flex items-center gap-3 p-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-brand-900 dark:text-gray-100 truncate">{item.product_name}</p>
                    <label className="flex items-center gap-1.5 mt-1 text-xs text-gray-400">
                      Prix
                      <input
                        type="number"
                        inputMode="numeric"
                        min="0"
                        className="input h-7 w-24 !py-0 text-right text-xs"
                        value={item.unit_price}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => updateEditPrice(item.product_id, Number(e.target.value))}
                        aria-label="Prix unitaire"
                      />
                    </label>
                  </div>
                  <QtyStepper value={item.quantity} unit={unitOf(item.product_id)} max={item.stock} onChange={(q) => updateEditQuantity(item.product_id, q)} />
                  <div className="w-24 text-right shrink-0">
                    <p className="text-sm font-semibold tabular-nums">{currency(item.quantity * item.unit_price)}</p>
                  </div>
                  <button type="button" className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl shrink-0" onClick={() => removeFromEditCart(item.product_id)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="border-2 border-dashed border-gray-200 dark:border-white/10 rounded-xl p-8 flex flex-col items-center text-center gap-2">
              <div className="h-12 w-12 rounded-full bg-gray-100 dark:bg-white/[0.06] flex items-center justify-center text-gray-400">
                <ShoppingBag size={20} />
              </div>
              <p className="font-medium text-sm">Le panier de la vente est vide</p>
              <p className="text-xs text-gray-400">Ajoutez des produits pour mettre à jour la vente</p>
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-end gap-3">
            <div className="flex-1">
              <label className="label">Remarque (optionnel)</label>
              <input
                type="text"
                className="input"
                placeholder="Ex: vente au comptoir, réparation..."
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
              />
            </div>
            <div className="sm:w-40">
              <label className="label">Remise (FCFA)</label>
              <input type="number" min="0" max={editCart.reduce((sum, item) => sum + item.quantity * item.unit_price, 0)} className="input text-right" value={editDiscount} onChange={(e) => setEditDiscount(e.target.value)} />
            </div>
          </div>

          <div className="rounded-xl bg-gray-50 dark:bg-white/[0.04] p-4 space-y-1.5">
            <div className="flex justify-between text-sm text-gray-500"><span>Sous-total</span><span>{currency(editCart.reduce((sum, item) => sum + item.quantity * item.unit_price, 0))}</span></div>
            <div className="flex justify-between text-sm text-gray-500"><span>Remise</span><span>-{currency(editDiscount)}</span></div>
            <div className="flex items-center justify-between pt-2 mt-1 border-t border-gray-200 dark:border-white/10">
              <span className="font-semibold">Total à encaisser</span>
              <span className="text-2xl font-extrabold text-[#1d4fb8] dark:text-blue-300 tabular-nums">{currency(Math.max(0, editCart.reduce((sum, item) => sum + item.quantity * item.unit_price, 0) - Number(editDiscount || 0)))}</span>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={handleCloseEdit}>Annuler</button>
            <button type="submit" className="btn-primary" disabled={updateSmallSale.isPending || editCart.length === 0}>
              {updateSmallSale.isPending ? 'Enregistrement...' : 'Enregistrer les modifications'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteSaleTarget}
        onClose={() => setDeleteSaleTarget(null)}
        onConfirm={handleDeleteSale}
        title="Annuler la petite vente"
        confirmLabel="Annuler la vente"
        loadingLabel="Annulation..."
        message="Confirmez-vous l'annulation de cette petite vente ? Le stock sera restitué automatiquement."
        loading={deleteSmallSale.isPending}
      />
    </div>
  )
}
