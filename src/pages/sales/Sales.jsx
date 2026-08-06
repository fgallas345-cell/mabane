import { useEffect, useState, useMemo, useRef } from 'react'
import { Plus, Trash2, Edit, ShoppingCart, Download, MessageCircle, Eye, Search, Receipt, FileText, RotateCcw, CreditCard, Wallet, ChevronDown, Check } from 'lucide-react'
import { useProducts } from '../../hooks/useProducts'
import { useClients } from '../../hooks/useEntities'
import { useSales, useCreateSale, useCancelSale, useAddSalePayment, useUpdateSale, useDeleteSale, useUpdateSaleItems } from '../../hooks/useSales'
import { useAuth } from '../../context/AuthContext'
import Pagination from '../../components/Pagination'
import Modal from '../../components/Modal'
import ConfirmDialog from '../../components/ConfirmDialog'
import { currency } from '../../lib/constants'
import { downloadInvoicePDF } from '../../utils/invoicePdf'
import { sendInvoiceViaWhatsApp } from '../../utils/whatsapp'

function StatusBadge({ status }) {
  const map = {
    payee: { label: 'Payé', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' },
    partielle: { label: 'Partiel', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400' },
    credit: { label: 'À crédit', cls: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400' },
    annulee: { label: 'Annulée', cls: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400' },
  }
  const s = map[status] || map.payee
  return <span className={`badge ${s.cls}`}>{s.label}</span>
}

// --- Helpers d'affichage pour le tableau ---

const AVATAR_PALETTE = [
  { bg: 'bg-blue-100 dark:bg-blue-500/15', text: 'text-blue-700 dark:text-blue-400' },
  { bg: 'bg-emerald-100 dark:bg-emerald-500/15', text: 'text-emerald-700 dark:text-emerald-400' },
  { bg: 'bg-amber-100 dark:bg-amber-500/15', text: 'text-amber-700 dark:text-amber-400' },
  { bg: 'bg-violet-100 dark:bg-violet-500/15', text: 'text-violet-700 dark:text-violet-400' },
  { bg: 'bg-rose-100 dark:bg-rose-500/15', text: 'text-rose-700 dark:text-rose-400' },
  { bg: 'bg-cyan-100 dark:bg-cyan-500/15', text: 'text-cyan-700 dark:text-cyan-400' },
]

function hashString(str) {
  let hash = 0
  for (let i = 0; i < str.length; i++) hash = (hash << 5) - hash + str.charCodeAt(i)
  return Math.abs(hash)
}

function getInitials(name) {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function ClientAvatar({ name }) {
  const isComptoir = !name
  const label = name || 'Client comptoir'
  const palette = AVATAR_PALETTE[hashString(label) % AVATAR_PALETTE.length]
  return (
    <div
      className={`h-8 w-8 shrink-0 rounded-full flex items-center justify-center text-xs font-semibold ${
        isComptoir ? 'bg-gray-100 dark:bg-gray-800 text-gray-400' : `${palette.bg} ${palette.text}`
      }`}
    >
      {isComptoir ? <Receipt size={14} /> : getInitials(label)}
    </div>
  )
}

function formatRelativeDate(dateStr) {
  const date = new Date(dateStr)
  const now = new Date()
  const isSameDay = date.toDateString() === now.toDateString()
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  const isYesterday = date.toDateString() === yesterday.toDateString()

  const time = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  if (isSameDay) return { label: `Aujourd'hui, ${time}`, tag: "Aujourd'hui", tone: 'brand' }
  if (isYesterday) return { label: `Hier, ${time}`, tag: 'Hier', tone: 'gray' }
  return { label: date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }), tag: null, tone: null }
}

function ActionButton({ icon: Icon, title, onClick, disabled, tone = 'gray' }) {
  const tones = {
    gray: 'text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200',
    emerald: 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10',
    brand: 'text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-500/10',
    red: 'text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10',
  }
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`p-2 rounded-lg transition-colors disabled:opacity-30 disabled:pointer-events-none ${tones[tone]}`}
    >
      <Icon size={15} />
    </button>
  )
}

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

export default function Sales() {
  const { user, isAdmin } = useAuth()
  const { data: products = [] } = useProducts()
  const { data: clients = [] } = useClients()
  const { data: sales = [], isLoading } = useSales()
  const createSale = useCreateSale()
  const cancelSale = useCancelSale()
  const addPayment = useAddSalePayment()
  const updateSale = useUpdateSale()
  const updateSaleItems = useUpdateSaleItems()
  const deleteSale = useDeleteSale()

  const [newSaleOpen, setNewSaleOpen] = useState(false)
  const [detailSale, setDetailSale] = useState(null)
  const [editSale, setEditSale] = useState(null)
  const [editClientId, setEditClientId] = useState('')
  const [editDiscount, setEditDiscount] = useState(0)
  const [editSaleItems, setEditSaleItems] = useState([])
  const [editProductToAdd, setEditProductToAdd] = useState('')
  const [confirmCancel, setConfirmCancel] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [paymentOpen, setPaymentOpen] = useState(null)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentError, setPaymentError] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 10

  // --- Form state for new sale ---
  const [clientId, setClientId] = useState('')
  const [discount, setDiscount] = useState(0)
  const [amountPaid, setAmountPaid] = useState('')
  const [partialPayment, setPartialPayment] = useState(false)
  const [cart, setCart] = useState([]) // {product_id, product_name, quantity, unit_price, stock}
  const [productToAdd, setProductToAdd] = useState('')
  const [error, setError] = useState('')

  const resetForm = () => {
    setClientId('')
    setDiscount(0)
    setAmountPaid('')
    setPartialPayment(false)
    setCart([])
    setProductToAdd('')
    setError('')
  }

  const addProduct = () => {
    if (!productToAdd) return
    const product = products.find((p) => p.id === productToAdd)
    if (!product) return
    if (cart.find((c) => c.product_id === product.id)) {
      setCart((c) => c.map((item) => (item.product_id === product.id ? { ...item, quantity: item.quantity + 1 } : item)))
    } else {
      setCart((c) => [...c, { product_id: product.id, product_name: product.name, quantity: 1, unit_price: product.sale_price, stock: product.stock }])
    }
    setProductToAdd('')
  }

  const updateQuantity = (productId, qty) => {
    setCart((c) => c.map((item) => (item.product_id === productId ? { ...item, quantity: Math.max(1, qty) } : item)))
  }

  const removeFromCart = (productId) => {
    setCart((c) => c.filter((item) => item.product_id !== productId))
  }

  const subtotal = useMemo(() => cart.reduce((sum, item) => sum + item.quantity * item.unit_price, 0), [cart])
  const total = Math.max(0, subtotal - Number(discount || 0))

  const handleCreateSale = async (e) => {
    e.preventDefault()
    setError('')
    if (cart.length === 0) {
      setError('Ajoutez au moins un produit à la facture.')
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
    if (partialPayment && Number(amountPaid || 0) > total) {
      setError('Le montant payé ne peut pas dépasser le total de la facture.')
      return
    }
    if (partialPayment && !clientId) {
      setError('Sélectionnez un client pour une vente à crédit ou avec avance (pour pouvoir suivre sa dette).')
      return
    }
    try {
      await createSale.mutateAsync({
        clientId: clientId || null,
        userId: user?.id,
        discount: Number(discount) || 0,
        amountPaid: partialPayment ? Number(amountPaid) || 0 : total,
        items: cart.map((c) => ({
          product_id: c.product_id,
          product_name: c.product_name,
          quantity: c.quantity,
          unit_price: c.unit_price,
        })),
      })
      setNewSaleOpen(false)
      resetForm()
    } catch (err) {
      setError(err.message)
    }
  }

  const handleAddPayment = async (e) => {
    e.preventDefault()
    setPaymentError('')
    const due = paymentOpen.total - paymentOpen.amount_paid
    if (!paymentAmount || Number(paymentAmount) <= 0) {
      setPaymentError('Entrez un montant valide.')
      return
    }
    if (Number(paymentAmount) > due) {
      setPaymentError(`Le paiement dépasse le solde restant dû (${currency(due)}).`)
      return
    }
    try {
      await addPayment.mutateAsync({ saleId: paymentOpen.id, amount: Number(paymentAmount) })
      setPaymentOpen(null)
      setPaymentAmount('')
    } catch (err) {
      setPaymentError(err.message)
    }
  }

  const handleCancelSale = async () => {
    await cancelSale.mutateAsync({ saleId: confirmCancel.id, userId: user?.id })
    setConfirmCancel(null)
    if (detailSale?.id === confirmCancel.id) {
      setDetailSale((sale) => ({ ...sale, status: 'annulee' }))
    }
  }

  const handleUpdateSale = async (e) => {
    e.preventDefault()
    if (!editSale) return

    // --- Validation ---
    if (editSaleItems.length === 0) {
      alert('Une facture doit contenir au moins un article.')
      return
    }
    const newSubtotal = editSaleItems.reduce((sum, item) => sum + item.quantity * item.unit_price, 0)
    if (Number(editDiscount || 0) > newSubtotal) {
      alert('La remise ne peut pas dépasser le sous-total de la facture.')
      return
    }
    // Stock max disponible : le stock actuel + les quantités rendues depuis la facture d'origine
    const originalByProductId = {}
    ;(editSale.sale_items || []).forEach((item) => {
      if (item.product_id) {
        originalByProductId[item.product_id] = (originalByProductId[item.product_id] || 0) + item.quantity
      }
    })
    const overStock = editSaleItems.find((item) => {
      if (!item.product_id) return false
      const product = products.find((p) => p.id === item.product_id)
      if (!product) return false
      const available = Number(product.stock || 0) + (originalByProductId[item.product_id] || 0)
      return item.quantity > available
    })
    if (overStock) {
      alert(`Stock insuffisant pour "${overStock.product_name}" (disponible: ${Number(products.find((p) => p.id === overStock.product_id)?.stock || 0) + (originalByProductId[overStock.product_id] || 0)})`)
      return
    }

    try {
      // Update sale items (full replacement: add / modify / remove handled by RPC)
      const itemsToUpdate = editSaleItems.map(item => ({
        product_id: item.product_id,
        product_name: item.product_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        purchase_price: item.purchase_price || 0,
      }))
      await updateSaleItems.mutateAsync({ saleId: editSale.id, items: itemsToUpdate })
      // Then update client and discount if changed
      await updateSale.mutateAsync({ saleId: editSale.id, clientId: editClientId || null, discount: Number(editDiscount) || 0 })
      setEditSale(null)
      setEditProductToAdd('')
      // refresh detail view if open
      if (detailSale?.id === editSale.id) {
        setDetailSale(null) // Force refresh by closing detail
      }
    } catch (err) {
      alert(err.message || 'Erreur lors de la mise à jour de la facture')
    }
  }

  const handleEditSaleItemQuantity = (itemId, newQuantity) => {
    setEditSaleItems(items => 
      items.map(item => 
        item.id === itemId 
          ? { ...item, quantity: Math.max(1, newQuantity) }
          : item
      )
    )
  }

  const handleEditSaleItemPrice = (itemId, newPrice) => {
    setEditSaleItems(items =>
      items.map(item =>
        item.id === itemId
          ? { ...item, unit_price: Math.max(0, Number(newPrice) || 0) }
          : item
      )
    )
  }

  const addEditProduct = () => {
    if (!editProductToAdd || !editSale) return
    const product = products.find((p) => p.id === editProductToAdd)
    if (!product) return
    setEditSaleItems((items) => {
      const existing = items.find((i) => i.product_id === product.id)
      if (existing) {
        return items.map((i) =>
          i.product_id === product.id ? { ...i, quantity: i.quantity + 1 } : i
        )
      }
      return [
        ...items,
        {
          id: `new-${product.id}`,
          product_id: product.id,
          product_name: product.name,
          quantity: 1,
          unit_price: Number(product.sale_price) || 0,
          purchase_price: Number(product.purchase_price) || 0,
          stock: product.stock,
        },
      ]
    })
    setEditProductToAdd('')
  }

  const handleRemoveEditSaleItem = (itemId) => {
    if (editSaleItems.length === 1) {
      alert('Une facture doit contenir au moins un article.')
      return
    }
    setEditSaleItems(items => items.filter(item => item.id !== itemId))
  }

  const handleDeleteSale = async () => {
    if (!confirmDelete) return
    try {
      await deleteSale.mutateAsync(confirmDelete.id)
      if (detailSale?.id === confirmDelete.id) setDetailSale(null)
      setConfirmDelete(null)
    } catch (err) {
      alert(err.message || 'Erreur lors de la suppression')
    }
  }

  const filteredSales = sales.filter(
    (s) =>
      s.invoice_number.toLowerCase().includes(search.toLowerCase()) ||
      (s.clients?.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (s.clients?.phone || '').toLowerCase().includes(search.toLowerCase())
  )

  const totalPages = Math.max(1, Math.ceil(filteredSales.length / pageSize))

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const paginatedSales = filteredSales.slice((page - 1) * pageSize, page * pageSize)

  const totalDette = sales
    .filter((s) => s.status !== 'annulee')
    .reduce((sum, s) => sum + (Number(s.total) - Number(s.amount_paid)), 0)

  const clientOptions = useMemo(
    () => [
      { value: '', label: 'Client comptoir (sans nom)', searchText: 'client comptoir sans nom' },
      ...clients.map((client) => ({
        value: client.id,
        label: `${client.name}${client.phone ? ` - ${client.phone}` : ''}`,
        searchText: `${client.name || ''} ${client.phone || ''}`,
        content: (
          <span className="min-w-0">
            <span className="block truncate font-medium">{client.name}</span>
            {client.phone && <span className="block truncate text-xs text-gray-400">{client.phone}</span>}
          </span>
        ),
      })),
    ],
    [clients]
  )

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Ventes / Facturation</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">Créez des factures et consultez l'historique des ventes</p>
        </div>
        <button
          className="btn-primary"
          onClick={() => {
            resetForm()
            setNewSaleOpen(true)
          }}
        >
          <Plus size={16} /> Nouvelle vente
        </button>
      </div>

      {totalDette > 0 && (
        <div className="card p-4 bg-red-50/60 dark:bg-red-500/10 border-red-200 dark:border-red-500/30 flex items-center gap-2.5">
          <Wallet size={18} className="text-red-600 dark:text-red-400 shrink-0" />
          <p className="text-sm font-semibold text-red-700 dark:text-red-400">
            Dette totale de vos clients (avances / crédits) : {currency(totalDette)}
          </p>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="input pl-9"
            placeholder="Rechercher une facture, client ou téléphone..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
          />
        </div>
        {!isLoading && (
          <p className="text-xs text-gray-400 sm:ml-auto">
            {filteredSales.length} facture{filteredSales.length > 1 ? 's' : ''}
            {search && ` correspondant à "${search}"`}
          </p>
        )}
      </div>

      {/* ---- État de chargement ---- */}
      {isLoading ? (
        <div className="card p-4 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-2 animate-pulse">
              <div className="h-8 w-8 rounded-full bg-gray-100 dark:bg-gray-800" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-1/4 rounded bg-gray-100 dark:bg-gray-800" />
                <div className="h-2.5 w-1/6 rounded bg-gray-100 dark:bg-gray-800" />
              </div>
              <div className="h-3 w-16 rounded bg-gray-100 dark:bg-gray-800" />
            </div>
          ))}
        </div>
      ) : filteredSales.length === 0 ? (
        <div className="card p-12 flex flex-col items-center text-center gap-3">
          <div className="h-12 w-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400">
            <FileText size={20} />
          </div>
          <div>
            <p className="font-medium">{search ? 'Aucune facture ne correspond à votre recherche' : 'Aucune vente enregistrée'}</p>
            <p className="text-sm text-gray-400 mt-0.5">
              {search ? 'Essayez un autre nom, numéro ou téléphone.' : 'Créez votre première facture pour commencer.'}
            </p>
          </div>
          {!search && (
            <button className="btn-primary mt-1" onClick={() => { resetForm(); setNewSaleOpen(true) }}>
              <Plus size={16} /> Nouvelle vente
            </button>
          )}
        </div>
      ) : (
        <>
          {/* ---- Tableau (desktop / tablette) ---- */}
          <div className="card hidden md:block overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700/60 bg-gray-50/60 dark:bg-gray-800/40">
                    <th className="table-th">Facture</th>
                    <th className="table-th">Client</th>
                    <th className="table-th">Date</th>
                    <th className="table-th text-right">Total</th>
                    <th className="table-th text-right">Reste dû</th>
                    <th className="table-th">Statut</th>
                    <th className="table-th text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {paginatedSales.map((s) => {
                    const date = formatRelativeDate(s.created_at)
                    const due = Number(s.total) - Number(s.amount_paid)
                    return (
                      <tr key={s.id} className="group hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                        <td className="table-td">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center font-mono text-[13px] font-semibold tracking-tight px-2 py-1 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                              {s.invoice_number}
                            </span>
                          </div>
                        </td>
                        <td className="table-td">
                          <div className="flex items-center gap-2.5">
                            <ClientAvatar name={s.clients?.name} />
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate max-w-[160px]">{s.clients?.name || 'Client comptoir'}</p>
                              {s.clients?.phone && <p className="text-xs text-gray-400 truncate">{s.clients.phone}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="table-td">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-600 dark:text-gray-300">{date.label}</span>
                            {date.tag && (
                              <span
                                className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                                  date.tone === 'brand'
                                    ? 'bg-brand-100 text-brand-700 dark:bg-brand-500/15 dark:text-brand-400'
                                    : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                                }`}
                              >
                                {date.tag}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="table-td text-right">
                          <span className="font-semibold tabular-nums">{currency(s.total)}</span>
                        </td>
                        <td className="table-td text-right tabular-nums">
                          {due > 0 ? <span className="text-red-500 font-medium">{currency(due)}</span> : <span className="text-gray-400">—</span>}
                        </td>
                        <td className="table-td"><StatusBadge status={s.status} /></td>
                        <td className="table-td">
                          <div className="flex justify-end gap-1">
                            <ActionButton icon={Eye} title="Voir le détail" onClick={() => setDetailSale(s)} />
                            <ActionButton icon={Download} title="Télécharger le PDF" onClick={() => downloadInvoicePDF(s)} tone="brand" />
                            <ActionButton
                              icon={MessageCircle}
                              title={s.clients?.phone ? 'Envoyer via WhatsApp' : 'Aucun numéro WhatsApp'}
                              disabled={!s.clients?.phone}
                              onClick={() => sendInvoiceViaWhatsApp(s)}
                              tone="emerald"
                            />
                            {s.status !== 'annulee' && due > 0 && (
                              <ActionButton icon={CreditCard} title="Enregistrer un paiement" tone="emerald" onClick={() => { setPaymentOpen(s); setPaymentAmount(''); setPaymentError('') }} />
                            )}
                            {isAdmin && s.status !== 'annulee' && (
                              <ActionButton icon={RotateCcw} title="Annuler et remettre en stock" onClick={() => setConfirmCancel(s)} tone="red" />
                            )}
                            {isAdmin && s.status !== 'annulee' && (
                              <ActionButton
                                icon={Edit}
                                title="Modifier la facture"
                                onClick={() => {
                                  setEditSale(s)
                                  setEditClientId(s.client_id || '')
                                  setEditDiscount(s.discount || 0)
                                  setEditSaleItems(s.sale_items || [])
                                  setEditProductToAdd('')
                                }}
                              />
                            )}
                            {isAdmin && s.status === 'annulee' && (
                              <ActionButton icon={Trash2} title="Supprimer la facture" onClick={() => setConfirmDelete(s)} tone="red" />
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ---- Vue cartes (mobile) ---- */}
          <div className="md:hidden space-y-2.5">
            {paginatedSales.map((s) => {
              const date = formatRelativeDate(s.created_at)
              const due = Number(s.total) - Number(s.amount_paid)
              return (
                <div key={s.id} className="card p-4" onClick={() => setDetailSale(s)}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <ClientAvatar name={s.clients?.name} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{s.clients?.name || 'Client comptoir'}</p>
                        <span className="inline-block mt-0.5 font-mono text-[11px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500">
                          {s.invoice_number}
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-semibold tabular-nums">{currency(s.total)}</span>
                      {due > 0 && <p className="text-[10px] font-semibold text-red-500 mt-0.5">Dû : {currency(due)}</p>}
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-gray-400">{date.label}</span>
                      {date.tag && (
                        <span
                          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                            date.tone === 'brand'
                              ? 'bg-brand-100 text-brand-700 dark:bg-brand-500/15 dark:text-brand-400'
                              : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                          }`}
                        >
                          {date.tag}
                        </span>
                      )}
                      <StatusBadge status={s.status} />
                    </div>
                    <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                      {s.status !== 'annulee' && due > 0 && (
                        <ActionButton icon={CreditCard} title="Payer" tone="emerald" onClick={() => { setPaymentOpen(s); setPaymentAmount(''); setPaymentError('') }} />
                      )}
                      <ActionButton icon={Download} title="Télécharger le PDF" onClick={() => downloadInvoicePDF(s)} tone="brand" />
                      <ActionButton
                        icon={MessageCircle}
                        title={s.clients?.phone ? 'Envoyer via WhatsApp' : 'Aucun numéro WhatsApp'}
                        disabled={!s.clients?.phone}
                        onClick={() => sendInvoiceViaWhatsApp(s)}
                        tone="emerald"
                      />
                      {isAdmin && s.status !== 'annulee' && (
                        <ActionButton icon={RotateCcw} title="Annuler" onClick={() => setConfirmCancel(s)} tone="red" />
                      )}
                      {isAdmin && s.status !== 'annulee' && (
                        <ActionButton icon={Edit} title="Modifier" onClick={() => { setEditSale(s); setEditClientId(s.client_id || ''); setEditDiscount(s.discount || 0); setEditSaleItems(s.sale_items || []); setEditProductToAdd('') }} />
                      )}
                      {isAdmin && s.status === 'annulee' && (
                        <ActionButton icon={Trash2} title="Supprimer" onClick={() => setConfirmDelete(s)} tone="red" />
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}

      {/* ---- Modal: nouvelle vente ---- */}
      <Modal open={newSaleOpen} onClose={() => setNewSaleOpen(false)} title="Nouvelle facture" maxWidth="max-w-2xl">
        <form onSubmit={handleCreateSale} className="space-y-4">
          {error && <div className="text-sm text-red-600 bg-red-50 dark:bg-red-500/10 rounded-lg px-3 py-2">{error}</div>}

          <div>
            <label className="label">Client (optionnel)</label>
            <SearchableSelect
              value={clientId}
              onChange={setClientId}
              options={clientOptions}
              placeholder="Rechercher un client..."
              emptyMessage="Aucun client trouvé"
            />
          </div>

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
            <button type="button" className="btn-secondary shrink-0" onClick={addProduct}>
              <Plus size={16} /> Ajouter
            </button>
          </div>

          {cart.length > 0 && (
            <div className="border border-gray-200 dark:border-gray-700/60 rounded-lg divide-y divide-gray-100 dark:divide-gray-800">
              {cart.map((item) => (
                <div key={item.product_id} className="flex items-center gap-3 p-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.product_name}</p>
                    <p className="text-xs text-gray-400">{currency(item.unit_price)} / unité</p>
                  </div>
                  <input
                    type="number"
                    min="1"
                    max={item.stock}
                    className="input w-20 text-center"
                    value={item.quantity}
                    onChange={(e) => updateQuantity(item.product_id, Number(e.target.value))}
                  />
                  <p className="w-24 text-right text-sm font-semibold">{currency(item.quantity * item.unit_price)}</p>
                  <button type="button" className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg" onClick={() => removeFromCart(item.product_id)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between">
            <label className="label mb-0">Remise (FCFA)</label>
            <input type="number" min="0" max={subtotal} className="input w-32 text-right" value={discount} onChange={(e) => setDiscount(e.target.value)} />
          </div>

          <label className="flex items-center gap-2.5 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/60 cursor-pointer">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={partialPayment}
              onChange={(e) => { setPartialPayment(e.target.checked); setAmountPaid('') }}
            />
            <span className="text-sm font-medium">Vente à crédit / avance (le client paiera le reste plus tard)</span>
          </label>

          {partialPayment && (
            <div>
              <label className="label">Montant payé maintenant (avance)</label>
              <input
                type="number"
                min="0"
                max={total}
                className="input"
                placeholder="0 si le client ne paie rien pour l'instant"
                value={amountPaid}
                onChange={(e) => setAmountPaid(e.target.value)}
              />
              <p className="text-xs text-gray-400 mt-1">
                Reste à payer par le client : <strong className="text-red-500">{currency(Math.max(0, total - Number(amountPaid || 0)))}</strong>
              </p>
            </div>
          )}

          <div className="border-t border-gray-200 dark:border-gray-700/60 pt-3 space-y-1">
            <div className="flex justify-between text-sm text-gray-500"><span>Sous-total</span><span>{currency(subtotal)}</span></div>
            <div className="flex justify-between text-sm text-gray-500"><span>Remise</span><span>-{currency(discount)}</span></div>
            <div className="flex justify-between text-lg font-bold"><span>Total</span><span>{currency(total)}</span></div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setNewSaleOpen(false)}>Annuler</button>
            <button type="submit" className="btn-primary" disabled={createSale.isPending}>
              <ShoppingCart size={16} /> {createSale.isPending ? 'Création...' : 'Créer la facture'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ---- Modal: modifier une facture (client, remise, articles) ---- */}
      <Modal open={!!editSale} onClose={() => setEditSale(null)} title={`Modifier facture ${editSale?.invoice_number || ''}`} maxWidth="max-w-2xl">
        {editSale && (
          <form onSubmit={handleUpdateSale} className="space-y-4">
            <div>
              <label className="label">Client (optionnel)</label>
              <SearchableSelect
                value={editClientId}
                onChange={setEditClientId}
                options={clientOptions}
                placeholder="Rechercher un client..."
                emptyMessage="Aucun client trouvé"
              />
            </div>

            <div className="space-y-2">
              <label className="label">Ajouter un produit à la facture</label>
              <div className="flex gap-2">
                <div className="flex-1 min-w-0">
                  <SearchableSelect
                    value={editProductToAdd}
                    onChange={setEditProductToAdd}
                    options={productOptions}
                    placeholder="Rechercher un produit..."
                    emptyMessage="Aucun produit trouvé"
                  />
                </div>
                <button type="button" className="btn-secondary shrink-0" onClick={addEditProduct}>
                  <Plus size={16} /> Ajouter
                </button>
              </div>
              <p className="text-xs text-gray-400">Modifiez la quantité et le prix unitaire, ou supprimez des articles puis enregistrez.</p>
            </div>

            <div className="space-y-2">
              <label className="label">Articles de la facture</label>
              <div className="border border-gray-200 dark:border-gray-700/60 rounded-lg divide-y divide-gray-100 dark:divide-gray-800">
                {editSaleItems.length === 0 ? (
                  <p className="text-sm text-gray-400 p-3">Aucun article</p>
                ) : (
                  editSaleItems.map(item => (
                    <div key={item.id} className="flex items-center gap-3 p-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.product_name}</p>
                        <p className="text-xs text-gray-400">Prix unitaire</p>
                      </div>
                      <input
                        type="number"
                        min="1"
                        className="input w-16 text-center"
                        value={item.quantity}
                        onChange={(e) => handleEditSaleItemQuantity(item.id, Number(e.target.value))}
                      />
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="input w-24 text-right"
                        value={item.unit_price}
                        onChange={(e) => handleEditSaleItemPrice(item.id, Number(e.target.value))}
                      />
                      <p className="w-24 text-right text-sm font-semibold">{currency(item.quantity * item.unit_price)}</p>
                      <button
                        type="button"
                        className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg"
                        onClick={() => handleRemoveEditSaleItem(item.id)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div>
              <label className="label">Remise (FCFA)</label>
              <input type="number" min="0" className="input" value={editDiscount} onChange={(e) => setEditDiscount(e.target.value)} />
            </div>

            <div className="border-t border-gray-200 dark:border-gray-700/60 pt-3 space-y-1">
              <div className="flex justify-between text-sm text-gray-500">
                <span>Sous-total</span>
                <span>{currency(editSaleItems.reduce((sum, item) => sum + item.quantity * item.unit_price, 0))}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-500">
                <span>Remise</span>
                <span>-{currency(editDiscount)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold">
                <span>Total</span>
                <span>{currency(Math.max(0, editSaleItems.reduce((sum, item) => sum + item.quantity * item.unit_price, 0) - Number(editDiscount || 0)))}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="btn-secondary" onClick={() => setEditSale(null)}>Annuler</button>
              <button type="submit" className="btn-primary" disabled={updateSaleItems.isPending || updateSale.isPending}>
                {updateSaleItems.isPending || updateSale.isPending ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDeleteSale}
        loading={deleteSale.isPending}
        message={`Supprimer la facture "${confirmDelete?.invoice_number}" ? Cette action est irréversible.`}
      />

      {/* ---- Modal: détail vente ---- */}
      <Modal open={!!detailSale} onClose={() => setDetailSale(null)} title={`Facture ${detailSale?.invoice_number || ''}`} maxWidth="max-w-lg">
        {detailSale && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <ClientAvatar name={detailSale.clients?.name} />
              <div>
                <p className="text-sm font-medium">{detailSale.clients?.name || 'Client comptoir'}</p>
                <p className="text-xs text-gray-400">{new Date(detailSale.created_at).toLocaleString('fr-FR')}</p>
              </div>
            </div>
            <div className="border border-gray-200 dark:border-gray-700/60 rounded-lg divide-y divide-gray-100 dark:divide-gray-800">
              {detailSale.sale_items?.map((item) => (
                <div key={item.id} className="flex justify-between p-3 text-sm">
                  <span>{item.product_name} × {item.quantity}</span>
                  <span className="font-medium tabular-nums">{currency(item.line_total)}</span>
                </div>
              ))}
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-sm text-gray-500"><span>Total</span><span>{currency(detailSale.total)}</span></div>
              <div className="flex justify-between text-sm text-gray-500"><span>Payé</span><span>{currency(detailSale.amount_paid)}</span></div>
              <div className="flex justify-between text-lg font-bold">
                <span>Reste dû</span>
                <span className={Number(detailSale.total) - Number(detailSale.amount_paid) > 0 ? 'text-red-500' : ''}>
                  {currency(Number(detailSale.total) - Number(detailSale.amount_paid))}
                </span>
              </div>
            </div>
            {detailSale.status === 'annulee' && (
              <p className="text-xs text-red-500 text-center font-medium">Facture annulée - stock réintégré.</p>
            )}
            {detailSale.status !== 'annulee' && Number(detailSale.total) - Number(detailSale.amount_paid) > 0 && (
              <button
                className="btn-success w-full"
                onClick={() => { setPaymentOpen(detailSale); setPaymentAmount(''); setPaymentError('') }}
              >
                <CreditCard size={15} /> Enregistrer un paiement
              </button>
            )}
            <div className="flex gap-2">
              <button className="btn-secondary flex-1" onClick={() => downloadInvoicePDF(detailSale)}>
                <Download size={15} /> Télécharger PDF
              </button>
              <button className="btn-success flex-1" disabled={!detailSale.clients?.phone} onClick={() => sendInvoiceViaWhatsApp(detailSale)}>
                <MessageCircle size={15} /> Envoyer WhatsApp
              </button>
            </div>
            {!detailSale.clients?.phone && (
              <p className="text-xs text-amber-500 text-center">Ce client n'a pas de numéro WhatsApp enregistré.</p>
            )}
          </div>
        )}
      </Modal>

      {/* ---- Modal: paiement d'une facture (avance / crédit) ---- */}
      <Modal open={!!paymentOpen} onClose={() => setPaymentOpen(null)} title="Enregistrer un paiement">
        {paymentOpen && (
          <form onSubmit={handleAddPayment} className="space-y-4">
            {paymentError && <div className="text-sm text-red-600 bg-red-50 dark:bg-red-500/10 rounded-lg px-3 py-2">{paymentError}</div>}
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Client <strong>{paymentOpen.clients?.name || 'Client comptoir'}</strong> — facture {paymentOpen.invoice_number} — solde dû :{' '}
              <span className="text-red-500 font-semibold">{currency(Number(paymentOpen.total) - Number(paymentOpen.amount_paid))}</span>
            </p>
            <div>
              <label className="label">Montant du paiement (FCFA)</label>
              <input
                type="number"
                min="1"
                max={Number(paymentOpen.total) - Number(paymentOpen.amount_paid)}
                required
                autoFocus
                className="input"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="btn-secondary" onClick={() => setPaymentOpen(null)}>Annuler</button>
              <button type="submit" className="btn-primary" disabled={addPayment.isPending}>
                {addPayment.isPending ? 'Enregistrement...' : 'Confirmer le paiement'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      <ConfirmDialog
        open={!!confirmCancel}
        onClose={() => setConfirmCancel(null)}
        onConfirm={handleCancelSale}
        loading={cancelSale.isPending}
        message={`Annuler la facture "${confirmCancel?.invoice_number}" ? Les quantités seront remises en stock.`}
      />
    </div>
  )
}
