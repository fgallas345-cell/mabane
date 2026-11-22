import { useEffect, useState, useMemo } from 'react'
import { Plus, Trash2, Edit, Download, MessageCircle, Eye, Search, Receipt, FileText, RotateCcw, CreditCard, Wallet, Truck, ShoppingCart } from 'lucide-react'
import { useProducts } from '../../hooks/useProducts'
import { useClients } from '../../hooks/useEntities'
import { useSales, useCreateSale, useCancelSale, useAddSalePayment, useDeleteSale, useUpdateSaleItems, useDeliveries, useCreateDelivery, useConfirmQuote, useCancelQuote, useSalePayments } from '../../hooks/useSales'
import { useAuth } from '../../context/AuthContext'
import { useDepositBalances } from '../../hooks/useClientDeposits'
import { useToast } from '../../context/ToastContext'
import Pagination from '../../components/Pagination'
import Modal from '../../components/Modal'
import ActionButton from '../../components/ActionButton'
import { DetailHeader, DetailList, DetailRow, Callout, DetailActions } from '../../components/Detail'
import RowActions from '../../components/RowActions'
import ConfirmDialog from '../../components/ConfirmDialog'
import { currency, PAYMENT_METHOD_LABELS, CASH_PAYMENT_METHODS } from '../../lib/constants'
import { isCountedSale } from '../../utils/finance'
import { downloadInvoicePDF } from '../../utils/invoicePdf'
import { downloadDeliveryPDF } from '../../utils/deliveryPdf'
import { sendInvoiceViaWhatsApp, sendReceiptViaWhatsApp } from '../../utils/whatsapp'
import { downloadPaymentReceiptPDF } from '../../utils/paymentReceiptPdf'
import SearchableSelect from '../../components/SearchableSelect'
import Segmented from '../../components/Segmented'
import QtyStepper from '../../components/QtyStepper'

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

function DeliveryStatusBadge({ deliveryStatus }) {
  const map = {
    en_attente: { label: 'En attente', cls: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
    partielle: { label: 'Partiellement livrée', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400' },
    livree: { label: 'Livrée', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' },
  }
  const s = map[deliveryStatus] || map.en_attente
  return <span className={`badge ${s.cls}`}>{s.label}</span>
}

function QuoteStatusBadge({ quoteStatus }) {
  const map = {
    draft: { label: 'Devis', cls: 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400' },
    confirmed: { label: 'Confirmé', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' },
    cancelled: { label: 'Annulé', cls: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400' },
  }
  const s = map[quoteStatus] || map.confirmed
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

export default function Sales() {
  const { user, isAdmin } = useAuth()
  const toast = useToast()
  const { data: products = [] } = useProducts()
  const { data: clients = [] } = useClients()
  const { data: sales = [], isLoading } = useSales()
  const createSale = useCreateSale()
  const cancelSale = useCancelSale()
  const addPayment = useAddSalePayment()
  const updateSaleItems = useUpdateSaleItems()
  const deleteSale = useDeleteSale()
  const confirmQuote = useConfirmQuote()
  const { data: depositBalances = new Map() } = useDepositBalances()
  const depositOf = (id) => (id ? depositBalances.get(id)?.balance || 0 : 0)
  const cancelQuote = useCancelQuote()

  const [newSaleOpen, setNewSaleOpen] = useState(false)
  const [newQuoteOpen, setNewQuoteOpen] = useState(false)
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
  const [paymentMethod, setPaymentMethod] = useState('especes')
  const [paymentReference, setPaymentReference] = useState('')
  const [paymentNotes, setPaymentNotes] = useState('')
  const [paymentError, setPaymentError] = useState('')
  const [lastReceipt, setLastReceipt] = useState(null)
  const [initialReceipt, setInitialReceipt] = useState(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 10

  const createDelivery = useCreateDelivery()
  const [newDeliveryOpen, setNewDeliveryOpen] = useState(false)
  const [deliverySale, setDeliverySale] = useState(null)
  const [deliveryItems, setDeliveryItems] = useState([])
  const [deliveryNotes, setDeliveryNotes] = useState('')
  const { data: detailPayments = [] } = useSalePayments(detailSale?.id)

  // --- Form state for new sale / quote ---
  const [clientId, setClientId] = useState('')
  const [discount, setDiscount] = useState(0)
  const [amountPaid, setAmountPaid] = useState('')
  const [partialPayment, setPartialPayment] = useState(false)
  const [payMode, setPayMode] = useState('full') // full | advance | credit
  const [salePayMethod, setSalePayMethod] = useState('especes') // mode de l'encaissement à la création
  const [deliveryMode, setDeliveryMode] = useState('immediate')
  const [isDraft, setIsDraft] = useState(false)
  const [cart, setCart] = useState([]) // {product_id, product_name, quantity, unit_price, stock}
  const [productToAdd, setProductToAdd] = useState('')
  const [error, setError] = useState('')

  const resetForm = () => {
    setClientId('')
    setDiscount(0)
    setAmountPaid('')
    setPartialPayment(false)
    setPayMode('full')
    setSalePayMethod('especes')
    setDeliveryMode('immediate')
    setIsDraft(false)
    setCart([])
    setProductToAdd('')
    setError('')
  }

  const addProduct = (id = productToAdd) => {
    if (!id) return
    const product = products.find((p) => p.id === id)
    if (!product) return
    if (cart.find((c) => c.product_id === product.id)) {
      setCart((c) => c.map((item) => (item.product_id === product.id ? { ...item, quantity: item.quantity + 1 } : item)))
    } else {
       setCart((c) => [...c, { product_id: product.id, product_name: product.name, quantity: 1, unit_price: product.sale_price, purchase_price: Number(product.purchase_price) || 0, stock: product.stock }])
    }
    setProductToAdd('')
  }

  const updateQuantity = (productId, qty) => {
    setCart((c) => c.map((item) => (item.product_id === productId ? { ...item, quantity: Math.max(1, Math.floor(Number(qty)) || 1) } : item)))
  }

  // Le mode « Dépôt client » n'a de sens que si le client choisi a de l'argent en dépôt
  useEffect(() => {
    if (salePayMethod === 'depot' && !(depositBalances.get(clientId)?.balance > 0)) setSalePayMethod('especes')
  }, [salePayMethod, clientId, depositBalances])

  const changePayMode = (mode) => {
    setPayMode(mode)
    setPartialPayment(mode !== 'full')
    setAmountPaid(mode === 'credit' ? '0' : '')
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
      const message = 'Ajoutez au moins un produit à la facture.'
      setError(message)
      toast.error(message)
      return
    }
    if (!isDraft) {
      const overStock = cart.find((item) => item.quantity > item.stock)
      if (overStock) {
        const message = `Stock insuffisant pour "${overStock.product_name}" (disponible: ${overStock.stock})`
        setError(message)
        toast.error(message)
        return
      }
    }
    if (Number(discount || 0) > subtotal) {
      const message = 'La remise ne peut pas dépasser le sous-total.'
      setError(message)
      toast.error(message)
      return
    }
    if (!isDraft && partialPayment && Number(amountPaid || 0) > total) {
      const message = 'Le montant payé ne peut pas dépasser le total de la facture.'
      setError(message)
      toast.error(message)
      return
    }
    if (!isDraft && payMode !== 'credit' && salePayMethod === 'depot') {
      const paidNow = partialPayment ? Number(amountPaid || 0) : total
      if (!clientId) {
        const message = 'Paiement par dépôt : sélectionnez le client qui a déposé l’argent.'
        setError(message)
        toast.error(message)
        return
      }
      if (paidNow > depositOf(clientId)) {
        const message = `Dépôt insuffisant : ce client n'a que ${currency(depositOf(clientId))} en dépôt.`
        setError(message)
        toast.error(message)
        return
      }
    }
    if (!isDraft && partialPayment && !clientId) {
      const message = 'Sélectionnez un client pour une vente à crédit ou avec avance (pour pouvoir suivre sa dette).'
      setError(message)
      toast.error(message)
      return
    }
    try {
      const createdSale = await createSale.mutateAsync({
        clientId: clientId || null,
        userId: user?.id,
        discount: Number(discount) || 0,
        amountPaid: isDraft ? 0 : (partialPayment ? Number(amountPaid) || 0 : total),
         items: cart.map((c) => ({
           product_id: c.product_id,
           product_name: c.product_name,
           quantity: c.quantity,
           unit_price: c.unit_price,
           purchase_price: c.purchase_price || 0,
         })),
        deliveryMode: isDraft ? 'staged' : deliveryMode,
        quoteStatus: isDraft ? 'draft' : 'confirmed',
        paymentMethod: payMode === 'credit' ? 'especes' : salePayMethod,
      })
      if (!isDraft && partialPayment && Number(amountPaid) > 0) {
        setInitialReceipt({
          receiptNumber: createdSale?.receipt_number,
          invoiceNumber: createdSale?.invoice_number,
          clientName: clientId ? (clients.find((c) => c.id === clientId)?.name || 'Client comptoir') : 'Client comptoir',
          clientPhone: clientId ? (clients.find((c) => c.id === clientId)?.phone || null) : null,
          amount: Number(amountPaid),
          method: salePayMethod,
          reference: null,
          notes: 'Avance initiale',
          remaining: Number(total) - Number(amountPaid),
          total: Number(total),
          createdAt: createdSale?.created_at || new Date().toISOString(),
        })
      }
      setNewSaleOpen(false)
      setNewQuoteOpen(false)
      resetForm()
    } catch (err) {
      const message = err.message || 'Erreur lors de la création de la facture.'
      setError(message)
      toast.error(message)
    }
  }

  const handleAddPayment = async (e) => {
    e.preventDefault()
    setPaymentError('')
    const due = paymentOpen.total - paymentOpen.amount_paid
    if (!paymentAmount || Number(paymentAmount) <= 0) {
      const message = 'Entrez un montant valide.'
      setPaymentError(message)
      toast.error(message)
      return
    }
    if (paymentMethod === 'depot' && Number(paymentAmount) > depositOf(paymentOpen.client_id)) {
      const message = `Dépôt insuffisant : ce client n'a que ${currency(depositOf(paymentOpen.client_id))} en dépôt.`
      setPaymentError(message)
      toast.error(message)
      return
    }
    if (Number(paymentAmount) > due) {
      const message = `Le paiement dépasse le solde restant dû (${currency(due)}).`
      setPaymentError(message)
      toast.error(message)
      return
    }
    try {
      const updatedSale = await addPayment.mutateAsync({
        saleId: paymentOpen.id,
        amount: Number(paymentAmount),
        method: paymentMethod,
        reference: paymentReference || null,
        notes: paymentNotes || null,
      })
      setLastReceipt({
        receiptNumber: updatedSale?.receipt_number,
        invoiceNumber: paymentOpen.invoice_number,
        clientName: paymentOpen.clients?.name || 'Client comptoir',
        clientPhone: paymentOpen.clients?.phone || null,
        amount: Number(paymentAmount),
        method: paymentMethod,
        reference: paymentReference || null,
        notes: paymentNotes || null,
        remaining: Number(paymentOpen.total) - Number(paymentOpen.amount_paid) - Number(paymentAmount),
        total: Number(paymentOpen.total),
        createdAt: new Date().toISOString(),
      })
      setPaymentOpen(null)
      setPaymentAmount('')
      setPaymentMethod('especes')
      setPaymentReference('')
      setPaymentNotes('')
    } catch (err) {
      const message = err.message || 'Erreur lors de l’ajout du paiement.'
      setPaymentError(message)
      toast.error(message)
    }
  }

  const handleCancelSale = async () => {
    const isDraft = confirmCancel.quote_status === 'draft'
    try {
      // Un devis n'a jamais touché le stock : RPC dédiée (cancel_quote), pas de restitution
      if (isDraft) await cancelQuote.mutateAsync({ saleId: confirmCancel.id, userId: user?.id })
      else await cancelSale.mutateAsync({ saleId: confirmCancel.id, userId: user?.id })
    } catch {
      return // toast déjà affiché par le hook
    }
    setConfirmCancel(null)
    if (detailSale?.id === confirmCancel.id) {
      setDetailSale((sale) => (isDraft ? { ...sale, quote_status: 'cancelled', status: 'annulee' } : { ...sale, status: 'annulee' }))
    }
  }

  const handleUpdateSale = async (e) => {
    e.preventDefault()
    if (!editSale) return

    // --- Validation ---
    if (editSaleItems.length === 0) {
      toast.error('Une facture doit contenir au moins un article.')
      return
    }
    const newSubtotal = editSaleItems.reduce((sum, item) => sum + item.quantity * item.unit_price, 0)
    if (Number(editDiscount || 0) > newSubtotal) {
      toast.error('La remise ne peut pas dépasser le sous-total de la facture.')
      return
    }
    const newTotal = newSubtotal - Number(editDiscount || 0)
    if (Number(editSale.amount_paid || 0) > newTotal) {
      toast.error(`Le nouveau total (${currency(newTotal)}) est inférieur au montant déjà encaissé (${currency(editSale.amount_paid)}).`)
      return
    }
    // Le stock n'est concerné que pour une facture confirmée et livrée immédiatement
    // (devis et livraisons échelonnées ne l'ont jamais décrémenté).
    const movesStock = editSale.quote_status === 'confirmed' && editSale.delivery_status === 'livree'
    if (movesStock) {
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
        toast.error(`Stock insuffisant pour "${overStock.product_name}" (disponible: ${Number(products.find((p) => p.id === overStock.product_id)?.stock || 0) + (originalByProductId[overStock.product_id] || 0)})`)
        return
      }
    }

    try {
      // Une seule RPC atomique : articles + remise + client, total et statut recalculés côté base
      const itemsToUpdate = editSaleItems.map(item => ({
        product_id: item.product_id,
        product_name: item.product_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
      }))
      await updateSaleItems.mutateAsync({
        saleId: editSale.id,
        items: itemsToUpdate,
        discount: Number(editDiscount) || 0,
        clientId: editClientId || null,
      })
      setEditSale(null)
      setEditProductToAdd('')
      // refresh detail view if open
      if (detailSale?.id === editSale.id) {
        setDetailSale(null) // Force refresh by closing detail
      }
    } catch (err) {
      toast.error(err.message || 'Erreur lors de la mise à jour de la facture')
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

  const addEditProduct = (id = editProductToAdd) => {
    if (!id || !editSale) return
    const product = products.find((p) => p.id === id)
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
      toast.error('Une facture doit contenir au moins un article.')
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
      toast.error(err.message || 'Erreur lors de la suppression')
    }
  }

  const { data: deliveries = [], isLoading: deliveriesLoading } = useDeliveries(deliverySale?.id)

  const handleCreateDelivery = async (e) => {
    e.preventDefault()
    if (!deliverySale) return
    const validItems = deliveryItems.filter(item => item.quantity_delivered > 0)
    if (validItems.length === 0) {
      toast.error('Sélectionnez au moins un article à livrer.')
      return
    }
    try {
      await createDelivery.mutateAsync({
        saleId: deliverySale.id,
        items: validItems.map(item => ({
          sale_item_id: item.sale_item_id,
          quantity_delivered: item.quantity_delivered,
        })),
        notes: deliveryNotes || null,
      })
      setNewDeliveryOpen(false)
      setDeliveryItems([])
      setDeliveryNotes('')
    } catch (err) {
      toast.error(err.message || 'Erreur lors de la création du bon de livraison')
    }
  }

  const handleDeliveryItemQuantity = (saleItemId, qty) => {
    setDeliveryItems(items =>
      items.map(item =>
        item.sale_item_id === saleItemId
          ? { ...item, quantity_delivered: Math.max(0, Math.min(qty, item.available)) }
          : item
      )
    )
  }

  // Données du bon de livraison PDF : client, facture, et reste à livrer après CE bon
  const buildDeliveryPdfData = (delivery) => {
    const cumulative = {}
    for (const d of deliveries || []) {
      const items = (d.delivery_items || []).map((di) => {
        cumulative[di.sale_item_id] = (cumulative[di.sale_item_id] || 0) + di.quantity_delivered
        const ordered = di.sale_items?.quantity || 0
        return { ...di, ordered, remaining: Math.max(0, ordered - cumulative[di.sale_item_id]) }
      })
      if (d.id === delivery.id) return { ...d, delivery_items: items, sale: deliverySale }
    }
    return { ...delivery, sale: deliverySale }
  }

  const openNewDelivery = () => {
    if (!deliverySale) return
    const deliveredByItem = {}
    ;(deliveries || []).forEach(d => {
      ;(d.delivery_items || []).forEach(di => {
        deliveredByItem[di.sale_item_id] = (deliveredByItem[di.sale_item_id] || 0) + di.quantity_delivered
      })
    })
    const undelivered = (deliverySale.sale_items || []).map(item => {
      const delivered = deliveredByItem[item.id] || 0
      return {
        sale_item_id: item.id,
        product_name: item.product_name,
        quantity: item.quantity,
        quantity_delivered: Math.max(0, item.quantity - delivered),
        available: item.quantity - delivered,
      }
    })
    setDeliveryItems(undelivered.filter(i => i.available > 0))
    setDeliveryNotes('')
    setNewDeliveryOpen(true)
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
    .filter(isCountedSale)
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

  // Menu d'actions d'une facture : le même sur ordinateur (tableau) et sur téléphone (cartes)
  const buildSaleMenu = (s) => {
    const due = Number(s.total) - Number(s.amount_paid)
    const isDraft = s.quote_status === 'draft'
    const isCancelled = s.status === 'annulee'
    return [
      { icon: Eye, label: 'Voir le détail', onClick: () => setDetailSale(s) },
      isDraft && { icon: FileText, label: 'Confirmer le devis', tone: 'emerald', onClick: () => confirmQuote.mutateAsync({ saleId: s.id, userId: user?.id }).then(() => setDetailSale(null)).catch(() => {}) },
      !isDraft && !isCancelled && due > 0 && { icon: CreditCard, label: 'Enregistrer un paiement', tone: 'emerald', onClick: () => { setPaymentOpen(s); setPaymentAmount(''); setPaymentMethod('especes'); setPaymentError('') } },
      !isDraft && !isCancelled && s.delivery_status !== 'livree' && { icon: Truck, label: 'Gérer les livraisons', onClick: () => setDeliverySale(s) },
      !isDraft && { icon: MessageCircle, label: s.clients?.phone ? 'Envoyer par WhatsApp' : 'WhatsApp : aucun numéro', disabled: !s.clients?.phone, onClick: () => sendInvoiceViaWhatsApp(s) },
      isAdmin && !isDraft && !isCancelled && s.delivery_status !== 'partielle' && {
        icon: Edit,
        label: 'Modifier la facture',
        onClick: () => {
          setEditSale(s)
          setEditClientId(s.client_id || '')
          setEditDiscount(s.discount || 0)
          setEditSaleItems(s.sale_items || [])
          setEditProductToAdd('')
        },
      },
      isAdmin && !isCancelled && { icon: RotateCcw, label: isDraft ? 'Annuler le devis' : 'Annuler la facture', tone: 'red', onClick: () => setConfirmCancel(s) },
      isAdmin && isCancelled && { icon: Trash2, label: 'Supprimer la facture', tone: 'red', onClick: () => setConfirmDelete(s) },
    ]
  }

  const productOptions = useMemo(
    () =>
      products.map((product) => ({
        value: product.id,
        label: `${product.name} - ${currency(product.sale_price)} (stock: ${product.stock})`,
        searchText: `${product.name || ''} ${product.sale_price || ''} ${product.stock || ''}`,
        disabled: !isDraft && Number(product.stock) <= 0,
        content: (
          <span className="flex min-w-0 flex-1 items-start justify-between gap-3">
            <span className="min-w-0">
              <span className="block truncate font-medium">{product.name}</span>
              <span className={`block truncate text-xs ${Number(product.stock) <= 0 ? 'text-red-500' : 'text-gray-400'}`}>
                {Number(product.stock) <= 0 ? 'Rupture de stock' : `Stock : ${product.stock}`}
              </span>
            </span>
            <span className="shrink-0 text-xs font-semibold tabular-nums text-gray-500 dark:text-gray-300">{currency(product.sale_price)}</span>
          </span>
        ),
      })),
    [products, isDraft]
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Ventes / Facturation</h1>
          <p className="page-subtitle">Créez des factures et consultez l'historique des ventes</p>
        </div>
        <div className="flex gap-2">
          <button
            className="btn-primary"
            onClick={() => {
              resetForm()
              setNewSaleOpen(true)
            }}
          >
            <Plus size={16} /> Nouvelle vente
          </button>
          <button
            className="btn-secondary"
            onClick={() => {
              resetForm()
              setIsDraft(true)
              setNewQuoteOpen(true)
            }}
          >
            <FileText size={16} /> Nouveau devis
          </button>
        </div>
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
                  <tr className="border-b border-gray-200 dark:border-gray-700/60">
                    <th className="table-th">Facture</th>
                    <th className="table-th">Client</th>
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
                    const isDraft = s.quote_status === 'draft'
                    const isCancelled = s.status === 'annulee'
                    return (
                      <tr
                        key={s.id}
                        className={`hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors cursor-pointer ${isCancelled ? 'opacity-60' : ''}`}
                        onClick={() => setDetailSale(s)}
                      >
                        <td className="table-td">
                          <p className="font-mono text-[13px] font-semibold text-gray-800 dark:text-gray-100 whitespace-nowrap">{s.invoice_number}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{date.label}</p>
                        </td>
                        <td className="table-td">
                          <div className="flex items-center gap-2.5">
                            <ClientAvatar name={s.clients?.name} />
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate max-w-[200px]">{s.clients?.name || 'Client comptoir'}</p>
                              {s.clients?.phone && <p className="text-xs text-gray-400 truncate">{s.clients.phone}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="table-td text-right font-semibold tabular-nums">{currency(s.total)}</td>
                        <td className="table-td text-right tabular-nums">
                          {!isCancelled && !isDraft && due > 0 ? (
                            <span className="text-red-500 font-medium">{currency(due)}</span>
                          ) : (
                            <span className="text-gray-300 dark:text-gray-600">—</span>
                          )}
                        </td>
                        <td className="table-td">
                          {/* Un seul statut lisible : devis / annulée / paiement, + la livraison seulement si elle reste à faire */}
                          <div className="flex items-center gap-1.5">
                            {isCancelled ? (
                              <StatusBadge status="annulee" />
                            ) : isDraft ? (
                              <QuoteStatusBadge quoteStatus="draft" />
                            ) : (
                              <>
                                <StatusBadge status={s.status} />
                                {s.delivery_status !== 'livree' && <DeliveryStatusBadge deliveryStatus={s.delivery_status} />}
                              </>
                            )}
                          </div>
                        </td>
                        <td className="table-td" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-0.5">
                            {!isDraft && <ActionButton icon={Download} title="Télécharger le PDF" onClick={() => downloadInvoicePDF(s)} />}
                            <RowActions items={buildSaleMenu(s)} />
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
                        <span className="inline-block mt-0.5 font-mono text-[11px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 whitespace-nowrap">
                          {s.invoice_number}
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-semibold tabular-nums">{currency(s.total)}</span>
                      {due > 0 && <p className="text-[10px] font-semibold text-red-500 mt-0.5">Dû : {currency(due)}</p>}
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                    <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                      {s.status === 'annulee' ? (
                        <StatusBadge status="annulee" />
                      ) : s.quote_status === 'draft' ? (
                        <QuoteStatusBadge quoteStatus="draft" />
                      ) : (
                        <>
                          <StatusBadge status={s.status} />
                          {s.delivery_status !== 'livree' && <DeliveryStatusBadge deliveryStatus={s.delivery_status} />}
                        </>
                      )}
                      <span className="text-xs text-gray-400">{date.label}</span>
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                      {s.quote_status !== 'draft' && <ActionButton icon={Download} title="Télécharger le PDF" onClick={() => downloadInvoicePDF(s)} />}
                      <RowActions items={buildSaleMenu(s)} />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}

      {/* ---- Modal: nouvelle vente / devis ---- */}
      <Modal
        open={newSaleOpen || newQuoteOpen}
        onClose={() => { setNewSaleOpen(false); setNewQuoteOpen(false) }}
        title={isDraft ? 'Nouveau devis' : 'Nouvelle vente'}
        maxWidth="max-w-4xl"
      >
        <form onSubmit={handleCreateSale}>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-5">
            {/* ---- Colonne gauche : client + produits ---- */}
            <div className="md:col-span-3 space-y-4">
              <div>
                <label className="label">
                  Client {payMode !== 'full' && !isDraft ? <span className="text-red-500">*</span> : <span className="text-gray-400 font-normal">(optionnel)</span>}
                </label>
                <SearchableSelect
                  value={clientId}
                  onChange={setClientId}
                  options={clientOptions}
                  placeholder="Client comptoir, ou rechercher un client..."
                  emptyMessage="Aucun client trouvé"
                />
              </div>

              <div>
                <label className="label">Ajouter un produit</label>
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

              {cart.length === 0 ? (
                <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-700 py-10 text-center">
                  <ShoppingCart size={22} className="mx-auto text-gray-300 dark:text-gray-600" />
                  <p className="text-sm text-gray-400 mt-2">Le panier est vide.</p>
                  <p className="text-xs text-gray-400">Recherchez un produit ci-dessus pour l'ajouter.</p>
                </div>
              ) : (
                <div className="border border-gray-200 dark:border-gray-700/60 rounded-lg divide-y divide-gray-100 dark:divide-gray-800">
                  {cart.map((item) => {
                    const over = !isDraft && item.quantity > item.stock
                    return (
                      <div key={item.product_id} className="p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{item.product_name}</p>
                            <p className="text-xs text-gray-400 tabular-nums">{currency(item.unit_price)} / unité · stock {item.stock}</p>
                          </div>
                          <button
                            type="button"
                            aria-label={`Retirer ${item.product_name}`}
                            className="p-1.5 -mr-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg"
                            onClick={() => removeFromCart(item.product_id)}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          <QtyStepper value={item.quantity} onChange={(q) => updateQuantity(item.product_id, q)} invalid={over} />
                          <p className="text-sm font-semibold tabular-nums">{currency(item.quantity * item.unit_price)}</p>
                        </div>
                        {over && <p className="text-xs text-red-500 mt-1.5">Stock insuffisant : {item.stock} disponible{item.stock > 1 ? 's' : ''}.</p>}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* ---- Colonne droite : type, remise, paiement, livraison ---- */}
            <div className="md:col-span-2 space-y-4">
              <div>
                <label className="label">Type de document</label>
                <Segmented
                  label="Type de document"
                  value={isDraft ? 'devis' : 'facture'}
                  onChange={(v) => {
                    const draft = v === 'devis'
                    setIsDraft(draft)
                    if (draft) changePayMode('full')
                  }}
                  options={[
                    { value: 'facture', label: 'Facture' },
                    { value: 'devis', label: 'Devis' },
                  ]}
                />
                {isDraft && <p className="text-xs text-purple-600 dark:text-purple-400 mt-1.5">Le stock n'est pas touché. Vous pourrez confirmer le devis plus tard.</p>}
              </div>

              <div>
                <label className="label" htmlFor="sale-discount">Remise (FCFA)</label>
                <input
                  id="sale-discount"
                  type="number"
                  inputMode="numeric"
                  min="0"
                  max={subtotal}
                  className="input"
                  placeholder="0"
                  value={discount}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setDiscount(e.target.value)}
                />
              </div>

              {!isDraft && (
                <div>
                  <label className="label">Paiement</label>
                  <Segmented
                    label="Mode de paiement"
                    value={payMode}
                    onChange={changePayMode}
                    options={[
                      { value: 'full', label: 'Payé' },
                      { value: 'advance', label: 'Avance' },
                      { value: 'credit', label: 'Crédit' },
                    ]}
                  />
                  {payMode === 'full' && <p className="text-xs text-gray-400 mt-1.5">Le client règle la totalité maintenant.</p>}
                  {payMode !== 'credit' && (
                    <select
                      className="input mt-2"
                      aria-label="Mode de paiement de l'encaissement"
                      value={salePayMethod}
                      onChange={(e) => setSalePayMethod(e.target.value)}
                    >
                      {CASH_PAYMENT_METHODS.map((value) => (
                        <option key={value} value={value}>{PAYMENT_METHOD_LABELS[value]}</option>
                      ))}
                      {depositOf(clientId) > 0 && (
                        <option value="depot">Dépôt client (disponible : {currency(depositOf(clientId))})</option>
                      )}
                    </select>
                  )}
                  {payMode === 'credit' && <p className="text-xs text-gray-400 mt-1.5">Rien n'est payé maintenant : le montant s'ajoute à la dette du client.</p>}
                  {payMode === 'advance' && (
                    <div className="mt-2 space-y-2">
                      <input
                        type="number"
                        inputMode="numeric"
                        min="0"
                        max={total}
                        aria-label="Montant payé maintenant"
                        className="input"
                        placeholder="Montant payé maintenant"
                        value={amountPaid}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => setAmountPaid(e.target.value)}
                      />
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          { label: 'Moitié', value: Math.round(total / 2) },
                          { label: 'Tout', value: total },
                        ].map((chip) => (
                          <button key={chip.label} type="button" className="badge bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700" onClick={() => setAmountPaid(String(chip.value))}>
                            {chip.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {!isDraft && (
                <div>
                  <label className="label">Livraison</label>
                  <Segmented
                    label="Livraison"
                    value={deliveryMode}
                    onChange={setDeliveryMode}
                    options={[
                      { value: 'immediate', label: 'Tout de suite' },
                      { value: 'staged', label: 'Plus tard' },
                    ]}
                  />
                  {deliveryMode === 'staged' && (
                    <p className="text-xs text-gray-400 mt-1.5">Le stock sort au fur et à mesure des bons de livraison.</p>
                  )}
                </div>
              )}

              <dl className="rounded-lg bg-gray-50 dark:bg-gray-800/60 p-3 space-y-1.5 text-sm">
                <div className="flex justify-between text-gray-500 dark:text-gray-400"><dt>Sous-total</dt><dd className="tabular-nums">{currency(subtotal)}</dd></div>
                {Number(discount) > 0 && (
                  <div className="flex justify-between text-gray-500 dark:text-gray-400"><dt>Remise</dt><dd className="tabular-nums">- {currency(discount)}</dd></div>
                )}
                {!isDraft && payMode !== 'full' && (
                  <>
                    <div className="flex justify-between text-gray-500 dark:text-gray-400"><dt>Payé maintenant</dt><dd className="tabular-nums">{currency(Number(amountPaid || 0))}</dd></div>
                    <div className="flex justify-between font-medium text-red-500"><dt>Reste à payer</dt><dd className="tabular-nums">{currency(Math.max(0, total - Number(amountPaid || 0)))}</dd></div>
                  </>
                )}
              </dl>
            </div>
          </div>

          {/* ---- Pied collant : le total et le bouton restent toujours visibles ---- */}
          <div className="sticky bottom-0 -mx-5 sm:-mx-6 -mb-5 sm:-mb-6 mt-5 px-5 sm:px-6 py-3 bg-white dark:bg-darkcard border-t border-gray-200 dark:border-gray-700/60 rounded-b-xl">
            {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400 mb-2">{error}</p>}
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs text-gray-400">Total à payer</p>
                <p className="text-xl font-semibold tabular-nums leading-tight">{currency(total)}</p>
              </div>
              <div className="flex gap-2">
                <button type="button" className="btn-secondary" onClick={() => { setNewSaleOpen(false); setNewQuoteOpen(false) }}>Annuler</button>
                <button type="submit" className="btn-primary" disabled={createSale.isPending || cart.length === 0}>
                  {createSale.isPending ? 'Enregistrement...' : isDraft ? 'Enregistrer le devis' : 'Valider la vente'}
                </button>
              </div>
            </div>
          </div>
        </form>
      </Modal>

      {/* ---- Modal: modifier une facture (client, remise, articles) ---- */}
      <Modal open={!!editSale} onClose={() => setEditSale(null)} title={<>Modifier la facture <span className="whitespace-nowrap font-mono">{editSale?.invoice_number}</span></>} maxWidth="max-w-2xl">
        {editSale && (() => {
          const editSubtotal = editSaleItems.reduce((sum, item) => sum + item.quantity * item.unit_price, 0)
          const editTotal = Math.max(0, editSubtotal - Number(editDiscount || 0))
          return (
            <form onSubmit={handleUpdateSale}>
              <div className="space-y-4">
                <div>
                  <label className="label">Client <span className="text-gray-400 font-normal">(optionnel)</span></label>
                  <SearchableSelect
                    value={editClientId}
                    onChange={setEditClientId}
                    options={clientOptions}
                    placeholder="Client comptoir, ou rechercher un client..."
                    emptyMessage="Aucun client trouvé"
                  />
                </div>

                <div>
                  <label className="label">Ajouter un produit</label>
                  <SearchableSelect
                    value=""
                    onChange={(id) => addEditProduct(id)}
                    options={productOptions}
                    placeholder="Tapez le nom du produit puis Entrée..."
                    emptyMessage="Aucun produit trouvé"
                    clearOnSelect
                  />
                </div>

                <div className="border border-gray-200 dark:border-gray-700/60 rounded-lg divide-y divide-gray-100 dark:divide-gray-800">
                  {editSaleItems.length === 0 ? (
                    <p className="text-sm text-gray-400 p-4 text-center">Aucun article : ajoutez-en au moins un.</p>
                  ) : (
                    editSaleItems.map((item) => (
                      <div key={item.id} className="p-3">
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-sm font-medium truncate">{item.product_name}</p>
                          <button
                            type="button"
                            aria-label={`Retirer ${item.product_name}`}
                            className="p-1.5 -mr-1.5 -mt-1 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg"
                            onClick={() => handleRemoveEditSaleItem(item.id)}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                        <div className="flex flex-wrap items-end justify-between gap-3 mt-2">
                          <div className="flex items-end gap-3">
                            <div>
                              <p className="text-[11px] text-gray-400 mb-1">Quantité</p>
                              <QtyStepper value={item.quantity} onChange={(q) => handleEditSaleItemQuantity(item.id, q)} />
                            </div>
                            <div>
                              <p className="text-[11px] text-gray-400 mb-1">Prix unitaire</p>
                              <input
                                type="number"
                                inputMode="numeric"
                                min="0"
                                aria-label="Prix unitaire"
                                className="input w-28 h-9 text-right"
                                value={item.unit_price}
                                onFocus={(e) => e.target.select()}
                                onChange={(e) => handleEditSaleItemPrice(item.id, e.target.value)}
                              />
                            </div>
                          </div>
                          <p className="text-sm font-semibold tabular-nums">{currency(item.quantity * item.unit_price)}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div>
                  <label className="label" htmlFor="edit-discount">Remise (FCFA)</label>
                  <input id="edit-discount" type="number" inputMode="numeric" min="0" className="input sm:w-48" value={editDiscount} onFocus={(e) => e.target.select()} onChange={(e) => setEditDiscount(e.target.value)} />
                </div>

                <dl className="rounded-lg bg-gray-50 dark:bg-gray-800/60 p-3 space-y-1.5 text-sm">
                  <div className="flex justify-between text-gray-500 dark:text-gray-400"><dt>Sous-total</dt><dd className="tabular-nums">{currency(editSubtotal)}</dd></div>
                  {Number(editDiscount) > 0 && (
                    <div className="flex justify-between text-gray-500 dark:text-gray-400"><dt>Remise</dt><dd className="tabular-nums">- {currency(editDiscount)}</dd></div>
                  )}
                  <div className="flex justify-between text-gray-500 dark:text-gray-400"><dt>Déjà payé</dt><dd className="tabular-nums">{currency(editSale.amount_paid)}</dd></div>
                </dl>
              </div>

              <div className="sticky bottom-0 -mx-5 sm:-mx-6 -mb-5 sm:-mb-6 mt-5 px-5 sm:px-6 py-3 bg-white dark:bg-darkcard border-t border-gray-200 dark:border-gray-700/60 rounded-b-xl">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs text-gray-400">Nouveau total</p>
                    <p className="text-xl font-semibold tabular-nums leading-tight">{currency(editTotal)}</p>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" className="btn-secondary" onClick={() => setEditSale(null)}>Annuler</button>
                    <button type="submit" className="btn-primary" disabled={updateSaleItems.isPending || editSaleItems.length === 0}>
                      {updateSaleItems.isPending ? 'Enregistrement...' : 'Enregistrer'}
                    </button>
                  </div>
                </div>
              </div>
            </form>
          )
        })()}
      </Modal>

      {/* ---- Modal: gestion des livraisons ---- */}
      <Modal open={!!deliverySale} onClose={() => { setDeliverySale(null); setNewDeliveryOpen(false) }} title={deliverySale ? `Livraisons - Facture ${deliverySale.invoice_number}` : ''} maxWidth="max-w-2xl">
        {deliverySale && (
          <div className="space-y-4">
            {deliveriesLoading && <p className="text-sm text-gray-400">Chargement...</p>}

            {!deliveriesLoading && deliveries.length > 0 && (
              <div className="space-y-2">
                <label className="label">Bons de livraison existants</label>
                <div className="border border-gray-200 dark:border-gray-700/60 rounded-lg divide-y divide-gray-100 dark:divide-gray-800">
                  {deliveries.map((delivery) => (
                    <div key={delivery.id} className="p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <span className="text-sm font-semibold whitespace-nowrap">{delivery.delivery_number}</span>
                          <span className="text-xs text-gray-400 ml-2">{new Date(delivery.created_at).toLocaleString('fr-FR')}</span>
                        </div>
                        <button
                          type="button"
                          className="text-xs btn-secondary py-1 px-2"
                          onClick={() => downloadDeliveryPDF(buildDeliveryPdfData(delivery))}
                        >
                          <Download size={12} /> PDF
                        </button>
                      </div>
                      {delivery.notes && <p className="text-xs text-gray-500 mb-1">{delivery.notes}</p>}
                      <div className="space-y-1">
                        {delivery.delivery_items?.map((di) => (
                          <div key={di.id} className="flex justify-between text-xs text-gray-600 dark:text-gray-300">
                            <span>{di.sale_items?.product_name || 'Article'}</span>
                            <span className="font-medium">× {di.quantity_delivered}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!newDeliveryOpen ? (
              <button
                type="button"
                className="btn-primary w-full"
                disabled={deliverySale.delivery_status === 'livree'}
                onClick={() => openNewDelivery()}
              >
                <Truck size={16} /> {deliverySale.delivery_status === 'livree' ? 'Livraison complète' : 'Nouvelle livraison'}
              </button>
            ) : (
              <form onSubmit={handleCreateDelivery} className="space-y-3 border border-gray-200 dark:border-gray-700/60 rounded-lg p-3">
                <label className="label">Quantités à livrer maintenant</label>
                {deliveryItems.length === 0 && <p className="text-xs text-gray-400">Tous les articles ont déjà été livrés.</p>}
                {deliveryItems.map((item) => (
                  <div key={item.sale_item_id} className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{item.product_name}</p>
                      <p className="text-xs text-gray-400">Commandé : {item.quantity} · reste à livrer : {item.available}</p>
                    </div>
                    <QtyStepper
                      min={0}
                      max={item.available}
                      value={item.quantity_delivered}
                      onChange={(q) => handleDeliveryItemQuantity(item.sale_item_id, q)}
                    />
                  </div>
                ))}
                <div>
                  <label className="label">Notes (optionnel)</label>
                  <textarea
                    className="input"
                    rows="2"
                    placeholder="Ex: Livré au comptoir, transporteur..."
                    value={deliveryNotes}
                    onChange={(e) => setDeliveryNotes(e.target.value)}
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" className="btn-secondary" onClick={() => setNewDeliveryOpen(false)}>Annuler</button>
                  <button type="submit" className="btn-primary" disabled={createDelivery.isPending}>
                    {createDelivery.isPending ? 'Création...' : 'Valider la livraison'}
                  </button>
                </div>
              </form>
            )}
          </div>
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
      <Modal
        open={!!detailSale}
        onClose={() => setDetailSale(null)}
        title={<>{detailSale?.quote_status === 'draft' ? 'Devis' : 'Facture'} <span className="whitespace-nowrap font-mono">{detailSale?.invoice_number}</span></>}
        maxWidth="max-w-lg"
      >
        {detailSale && (() => {
          const isDraft = detailSale.quote_status === 'draft'
          const isCancelled = detailSale.status === 'annulee'
          const due = Number(detailSale.total) - Number(detailSale.amount_paid)
          const discount = Number(detailSale.discount || 0)
          return (
            <div className="space-y-4">
              <DetailHeader
                avatar={<ClientAvatar name={detailSale.clients?.name} />}
                title={detailSale.clients?.name || 'Client comptoir'}
                subtitle={`${detailSale.clients?.phone ? `${detailSale.clients.phone} · ` : ''}${new Date(detailSale.created_at).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })}`}
              >
                {isCancelled ? (
                  <StatusBadge status="annulee" />
                ) : isDraft ? (
                  <QuoteStatusBadge quoteStatus="draft" />
                ) : (
                  <>
                    <StatusBadge status={detailSale.status} />
                    <DeliveryStatusBadge deliveryStatus={detailSale.delivery_status} />
                  </>
                )}
              </DetailHeader>

              {isDraft && !isCancelled && (
                <Callout tone="purple" title="Ceci est un devis (brouillon)">
                  Il n'affecte pas le stock et ne compte pas dans le chiffre d'affaires.
                </Callout>
              )}
              {isCancelled && (
                <Callout tone="red" title="Facture annulée">
                  Les quantités sorties ont été remises en stock{Number(detailSale.amount_paid) > 0 ? ' et les encaissements remboursés.' : '.'}
                </Callout>
              )}

              <DetailList title="Articles">
                {detailSale.sale_items?.map((item) => (
                  <div key={item.id} className="flex items-start justify-between gap-4 px-3 py-2.5 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium">{item.product_name}</p>
                      <p className="text-xs text-gray-400 tabular-nums">{item.quantity} × {currency(item.unit_price)}</p>
                    </div>
                    <span className="font-medium tabular-nums whitespace-nowrap">{currency(item.line_total)}</span>
                  </div>
                ))}
              </DetailList>

              <DetailList>
                {discount > 0 && <DetailRow label="Sous-total">{currency(detailSale.subtotal)}</DetailRow>}
                {discount > 0 && <DetailRow label="Remise">- {currency(discount)}</DetailRow>}
                <DetailRow label="Total" strong>{currency(detailSale.total)}</DetailRow>
                {!isDraft && <DetailRow label="Payé">{currency(detailSale.amount_paid)}</DetailRow>}
                {!isDraft && !isCancelled && (
                  <DetailRow label="Reste dû" strong tone={due > 0 ? 'red' : 'emerald'}>{currency(due)}</DetailRow>
                )}
              </DetailList>

              {detailPayments.length > 0 && (
                <DetailList title="Paiements">
                  {detailPayments.map((p) => {
                    const refund = Number(p.amount) < 0
                    return (
                      <DetailRow
                        key={p.id}
                        tone={refund ? 'red' : undefined}
                        label={
                          <span>
                            {refund ? 'Remboursement' : PAYMENT_METHOD_LABELS[p.method] || p.method}
                            {p.reference && !refund && <span className="text-gray-400"> · Réf {p.reference}</span>}
                            <span className="block text-xs text-gray-400">{new Date(p.created_at).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                            {p.notes && !refund && <span className="block text-xs text-gray-400">{p.notes}</span>}
                          </span>
                        }
                      >
                        {currency(p.amount)}
                      </DetailRow>
                    )
                  })}
                </DetailList>
              )}

              {!isDraft && !detailSale.clients?.phone && !isCancelled && (
                <p className="text-xs text-amber-600 dark:text-amber-400">Ce client n'a pas de numéro WhatsApp enregistré.</p>
              )}

              <DetailActions>
                {isDraft ? (
                  <>
                    <button className="btn-secondary" onClick={() => downloadInvoicePDF(detailSale)}>
                      <Download size={15} /> PDF
                    </button>
                    {isAdmin && (
                      <button className="btn-secondary" onClick={() => { setDetailSale(null); setConfirmCancel(detailSale) }}>
                        Annuler le devis
                      </button>
                    )}
                    <button
                      className="btn-success"
                      onClick={() => confirmQuote.mutateAsync({ saleId: detailSale.id, userId: user?.id }).then(() => setDetailSale(null)).catch(() => {})}
                      disabled={confirmQuote.isPending}
                    >
                      <FileText size={15} /> Confirmer le devis
                    </button>
                  </>
                ) : (
                  <>
                    <button className="btn-secondary" onClick={() => downloadInvoicePDF(detailSale)}>
                      <Download size={15} /> PDF
                    </button>
                    <button className="btn-secondary" disabled={!detailSale.clients?.phone} onClick={() => sendInvoiceViaWhatsApp(detailSale)}>
                      <MessageCircle size={15} /> WhatsApp
                    </button>
                    {detailSale.delivery_status !== 'livree' && !isCancelled && (
                      <button className="btn-secondary" onClick={() => setDeliverySale(detailSale)}>
                        <Truck size={15} /> Livraisons
                      </button>
                    )}
                    {!isCancelled && due > 0 && (
                      <button
                        className="btn-success"
                        onClick={() => { setPaymentOpen(detailSale); setPaymentAmount(''); setPaymentMethod('especes'); setPaymentError('') }}
                      >
                        <CreditCard size={15} /> Enregistrer un paiement
                      </button>
                    )}
                  </>
                )}
              </DetailActions>
            </div>
          )
        })()}
      </Modal>

      {/* ---- Modal: paiement d'une facture (avance / crédit) ---- */}
      <Modal open={!!paymentOpen} onClose={() => setPaymentOpen(null)} title="Enregistrer un paiement">
        {paymentOpen && (() => {
          const due = Number(paymentOpen.total) - Number(paymentOpen.amount_paid)
          const afterPayment = Math.max(0, due - Number(paymentAmount || 0))
          return (
            <form onSubmit={handleAddPayment} className="space-y-4">
              <DetailHeader
                avatar={<ClientAvatar name={paymentOpen.clients?.name} />}
                title={paymentOpen.clients?.name || 'Client comptoir'}
                subtitle={<>Facture <span className="whitespace-nowrap font-mono">{paymentOpen.invoice_number}</span></>}
              />
              <DetailList>
                <DetailRow label="Total de la facture">{currency(paymentOpen.total)}</DetailRow>
                <DetailRow label="Déjà payé">{currency(paymentOpen.amount_paid)}</DetailRow>
                <DetailRow label="Reste dû" strong tone="red">{currency(due)}</DetailRow>
              </DetailList>

              <div>
                <label className="label" htmlFor="pay-amount">Montant reçu (FCFA)</label>
                <input
                  id="pay-amount"
                  type="number"
                  inputMode="numeric"
                  min="1"
                  max={due}
                  required
                  autoFocus
                  className="input text-lg font-semibold"
                  placeholder="0"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                />
                <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                  <button type="button" className="badge bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700" onClick={() => setPaymentAmount(String(due))}>
                    Solder : {currency(due)}
                  </button>
                  {due > 1 && (
                    <button type="button" className="badge bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700" onClick={() => setPaymentAmount(String(Math.round(due / 2)))}>
                      Moitié
                    </button>
                  )}
                  {paymentAmount !== '' && <span className="text-xs text-gray-400 ml-auto tabular-nums">Il restera {currency(afterPayment)}</span>}
                </div>
              </div>

              <div>
                <label className="label">Mode de paiement</label>
                <Segmented
                  label="Mode de paiement"
                  value={['especes', 'mobile_money', 'depot'].includes(paymentMethod) ? paymentMethod : 'autre'}
                  onChange={(v) => setPaymentMethod(v === 'autre' ? 'virement' : v)}
                  options={[
                    { value: 'especes', label: 'Espèces' },
                    { value: 'mobile_money', label: 'Mobile Money' },
                    ...(depositOf(paymentOpen?.client_id) > 0 ? [{ value: 'depot', label: 'Dépôt client' }] : []),
                    { value: 'autre', label: 'Autre' },
                  ]}
                />
                {paymentMethod === 'depot' && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
                    Payé avec l’argent déposé par le client — disponible : <strong className="tabular-nums">{currency(depositOf(paymentOpen?.client_id))}</strong>
                  </p>
                )}
                {!['especes', 'mobile_money', 'depot'].includes(paymentMethod) && (
                  <select className="input mt-2" aria-label="Autre mode de paiement" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                    <option value="virement">Virement</option>
                    <option value="cheque">Chèque</option>
                    <option value="carte">Carte</option>
                  </select>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label" htmlFor="pay-ref">Référence <span className="text-gray-400 font-normal">(optionnel)</span></label>
                  <input id="pay-ref" className="input" value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)} placeholder="N° chèque / transaction" />
                </div>
                <div>
                  <label className="label" htmlFor="pay-notes">Note <span className="text-gray-400 font-normal">(optionnel)</span></label>
                  <input id="pay-notes" className="input" value={paymentNotes} onChange={(e) => setPaymentNotes(e.target.value)} placeholder="Ex: acompte" />
                </div>
              </div>

              {paymentError && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{paymentError}</p>}

              <DetailActions>
                <button type="button" className="btn-secondary" onClick={() => setPaymentOpen(null)}>Annuler</button>
                <button type="submit" className="btn-success" disabled={addPayment.isPending}>
                  {addPayment.isPending ? 'Enregistrement...' : 'Confirmer le paiement'}
                </button>
              </DetailActions>
            </form>
          )
        })()}
      </Modal>

      {/* ---- Modal: reçu de paiement ---- */}
      <Modal open={!!lastReceipt} onClose={() => setLastReceipt(null)} title="Reçu de paiement">
        {lastReceipt && (
          <div className="space-y-3">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Paiement enregistré pour la facture <strong>{lastReceipt.invoiceNumber}</strong> — reçu <strong>{lastReceipt.receiptNumber}</strong>
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <button className="btn-primary flex-1" onClick={() => downloadPaymentReceiptPDF(lastReceipt)}>
                Télécharger le reçu (PDF)
              </button>
              <button className="btn-success flex-1" disabled={!lastReceipt.clientPhone} title={lastReceipt.clientPhone ? undefined : "Aucun numéro WhatsApp"} onClick={() => sendReceiptViaWhatsApp(lastReceipt)}>
                Envoyer par WhatsApp
              </button>
              <button className="btn-secondary flex-1" onClick={() => setLastReceipt(null)}>Fermer</button>
            </div>
          </div>
        )}
      </Modal>

      {/* ---- Modal: reçu initial (avance lors de la création) ---- */}
      <Modal open={!!initialReceipt} onClose={() => setInitialReceipt(null)} title="Reçu de paiement">
        {initialReceipt && (
          <div className="space-y-3">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Avance enregistrée pour la facture <strong>{initialReceipt.invoiceNumber}</strong> — reçu <strong>{initialReceipt.receiptNumber}</strong>
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <button className="btn-primary flex-1" onClick={() => downloadPaymentReceiptPDF(initialReceipt)}>
                Télécharger le reçu (PDF)
              </button>
              <button className="btn-success flex-1" disabled={!initialReceipt.clientPhone} title={initialReceipt.clientPhone ? undefined : "Aucun numéro WhatsApp"} onClick={() => sendReceiptViaWhatsApp(initialReceipt)}>
                Envoyer par WhatsApp
              </button>
              <button className="btn-secondary flex-1" onClick={() => setInitialReceipt(null)}>Fermer</button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!confirmCancel}
        onClose={() => setConfirmCancel(null)}
        onConfirm={handleCancelSale}
        loading={cancelSale.isPending || cancelQuote.isPending}
        title={confirmCancel?.quote_status === 'draft' ? 'Annuler le devis' : 'Annuler la facture'}
        confirmLabel={confirmCancel?.quote_status === 'draft' ? 'Annuler le devis' : 'Annuler la facture'}
        loadingLabel="Annulation..."
        message={confirmCancel?.quote_status === 'draft' ? `Annuler le devis "${confirmCancel?.invoice_number}" ? Il n'a aucun effet sur le stock.` : `Annuler la facture "${confirmCancel?.invoice_number}" ? Les quantités déjà sorties du stock seront remises en stock.`}
      />
    </div>
  )
}
