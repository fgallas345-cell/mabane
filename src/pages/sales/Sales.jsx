import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Plus, Trash2, Edit, Download, MessageCircle, Eye, Search, Receipt, FileText, RotateCcw, CreditCard, Truck, ShoppingCart, Printer, ChevronDown, ChevronLeft, ChevronRight, CalendarDays, SlidersHorizontal, ClipboardList, BadgeCheck, AlertTriangle, Clock, Ban, Users, Coins, ArrowUp, ArrowDown, FilePlus, Send, Star, PlusCircle, Package, Check, ArrowRight, Pencil, Banknote, Smartphone, Waves, PiggyBank, Landmark,
} from 'lucide-react'
import { useProducts } from '../../hooks/useProducts'
import { useClients } from '../../hooks/useEntities'
import { useSales, useCreateSale, useCancelSale, useAddSalePayment, useDeleteSale, useUpdateSaleItems, useDeliveries, useCreateDelivery, useConfirmQuote, useCancelQuote, useSalePayments } from '../../hooks/useSales'
import { useAuth } from '../../context/AuthContext'
import { useDepositBalances } from '../../hooks/useClientDeposits'
import { useToast } from '../../context/ToastContext'
import Modal from '../../components/Modal'
import { DetailList, DetailRow, Callout } from '../../components/Detail'
import RowActions from '../../components/RowActions'
import ConfirmDialog from '../../components/ConfirmDialog'
import { currency, PAYMENT_METHOD_LABELS, CASH_PAYMENT_METHODS, SHOP } from '../../lib/constants'
import { useClickOutside } from '../../hooks/useClickOutside'
import { formatQty } from '../../utils/quantity'
import { isCountedSale } from '../../utils/finance'
import { downloadInvoicePDF } from '../../utils/invoicePdf'
import { downloadDeliveryPDF } from '../../utils/deliveryPdf'
import { sendInvoiceViaWhatsApp, sendReceiptViaWhatsApp } from '../../utils/whatsapp'
import { downloadPaymentReceiptPDF } from '../../utils/paymentReceiptPdf'
import SearchableSelect from '../../components/SearchableSelect'
import DocumentSignatureSection from '../../components/DocumentSignatureSection'
import Segmented from '../../components/Segmented'
import QtyStepper from '../../components/QtyStepper'

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
        isComptoir ? 'bg-gray-100 dark:bg-white/[0.06] text-gray-400' : `${palette.bg} ${palette.text}`
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


// ---------------------------------------------------------------------------
// En-tête, indicateurs, filtres et pagination de la liste des ventes
// ---------------------------------------------------------------------------
function InvoiceIllustration({ className = '' }) {
  return (
    <svg viewBox="0 0 140 100" className={className} aria-hidden="true">
      <ellipse cx="70" cy="58" rx="66" ry="40" fill="#dfe9fb" className="dark:opacity-20" />
      <rect x="22" y="22" width="62" height="70" rx="6" fill="#2b5c94" />
      <rect x="34" y="12" width="66" height="74" rx="6" fill="#ffffff" stroke="#1e3a7b" strokeWidth="2.5" />
      <path d="M78 12 h16 a6 6 0 0 1 6 6 v4 h-22 z" fill="#1e3a7b" />
      <path d="M44 30 h30 M44 40 h44 M44 50 h44 M44 60 h34" stroke="#9cc2f5" strokeWidth="4" strokeLinecap="round" />
      <circle cx="98" cy="76" r="16" fill="#f39e26" stroke="#ffffff" strokeWidth="3" />
      <path d="M90 76 l6 6 l10 -11" fill="none" stroke="#ffffff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function MiniBarsDeco({ color, rising }) {
  return (
    <svg viewBox="0 0 90 52" className="pointer-events-none absolute right-4 bottom-4 h-12 w-20" aria-hidden="true">
      {rising ? (
        <>
          <path d="M0 52 L0 44 L22 36 L36 40 L58 22 L72 26 L90 4 L90 52 Z" fill={color} opacity="0.45" />
          <path d="M0 44 L22 36 L36 40 L58 22 L72 26 L90 4" fill="none" stroke={color} strokeWidth="3" strokeLinejoin="round" />
        </>
      ) : (
        [14, 22, 30, 40, 52].map((h, i) => (
          <rect key={i} x={i * 18 + 2} y={52 - h} width="12" height={h} rx="2.5" fill={color} opacity={0.3 + i * 0.16} />
        ))
      )}
    </svg>
  )
}

function StatTrend({ pct, onDark }) {
  if (pct == null) return <span className={`text-xs ${onDark ? 'text-white/60' : 'text-gray-400'}`}>—</span>
  const up = pct >= 0
  const Icon = up ? ArrowUp : ArrowDown
  const tone = onDark ? (up ? 'text-white' : 'text-red-200') : up ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
  return (
    <span className={`inline-flex items-center gap-0.5 text-sm font-bold ${tone}`}>
      <Icon size={14} strokeWidth={3} /> {up ? '+' : ''}{pct}%
    </span>
  )
}

const STAT_TONES = {
  blue: { chip: 'bg-blue-100 text-[#1d4fb8] dark:bg-blue-500/15 dark:text-blue-300', bars: '#93b4f5', bg: 'card' },
  green: { chip: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300', bars: '#4ade80', bg: 'card bg-gradient-to-br from-white to-emerald-50/60 dark:from-darkcard dark:to-emerald-500/5' },
  orange: { chip: 'bg-accent-100 text-accent-600 dark:bg-accent-500/15 dark:text-accent-400', bars: '#f8bc66', bg: 'card bg-gradient-to-br from-white to-accent-50 dark:from-darkcard dark:to-accent-500/5' },
}

function StatTile({ icon: Icon, label, value, pct, hint, tone, featured }) {
  if (featured) {
    return (
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1a3f95] to-[#0d2550] text-white p-5 flex items-center gap-4 shadow-[0_14px_30px_-14px_rgba(19,48,111,0.7)] min-h-[104px]">
        <span className="h-16 w-16 shrink-0 rounded-2xl bg-[#2f6bea] flex items-center justify-center">
          <Icon size={30} />
        </span>
        <div className="relative min-w-0" title={hint}>
          <p className="text-sm text-white/85">{label}</p>
          <p className="text-2xl font-extrabold tabular-nums leading-tight">{value}</p>
          <StatTrend pct={pct} onDark />
        </div>
        <MiniBarsDeco color="#3b82f6" rising />
      </div>
    )
  }
  const t = STAT_TONES[tone]
  return (
    <div className={`relative overflow-hidden ${t.bg} !rounded-3xl p-5 flex items-center gap-4 min-h-[104px]`}>
      <span className={`h-16 w-16 shrink-0 rounded-2xl flex items-center justify-center ${t.chip}`}>
        <Icon size={30} />
      </span>
      <div className="relative min-w-0" title={hint}>
        <p className="text-sm text-gray-600 dark:text-gray-400">{label}</p>
        <p className="text-2xl font-extrabold tabular-nums leading-tight text-brand-900 dark:text-gray-50">{value}</p>
        <StatTrend pct={pct} />
      </div>
      <MiniBarsDeco color={t.bars} />
    </div>
  )
}

/** Statut principal d'une vente sous forme de pastille avec icône, + la livraison si elle reste à faire */
function SalePills({ sale }) {
  const pill = 'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap'
  if (sale.status === 'annulee') {
    return <span className={`${pill} bg-gray-100 text-gray-500 dark:bg-white/[0.06] dark:text-gray-400`}><Ban size={13} /> Annulée</span>
  }
  if (sale.quote_status === 'draft') {
    return <span className={`${pill} bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300`}><FileText size={13} /> Devis</span>
  }
  const main = {
    payee: <span className={`${pill} bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400`}><BadgeCheck size={13} /> Payée</span>,
    partielle: <span className={`${pill} bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400`}><Clock size={13} /> Partiel</span>,
    credit: <span className={`${pill} bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400`}><AlertTriangle size={13} /> À crédit</span>,
  }[sale.status]
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {main}
      {sale.delivery_status && sale.delivery_status !== 'livree' && (
        <span className={`${pill} bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300`} title={sale.delivery_status === 'partielle' ? 'Livraison partielle' : 'Livraison en attente'}>
          <Truck size={13} /> {sale.delivery_status === 'partielle' ? 'Livr. partielle' : 'En attente'}
        </span>
      )}
    </span>
  )
}

/** Liste déroulante de filtre avec icône (select natif, accessible au clavier) */
function FilterSelect({ icon: Icon, label, value, onChange, options }) {
  return (
    <label className="relative flex items-center">
      <span className="sr-only">{label}</span>
      <Icon size={17} className="pointer-events-none absolute left-4 text-brand-900 dark:text-gray-300" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none w-full rounded-2xl bg-white dark:bg-darkcard border border-gray-200/80 dark:border-white/[0.08] shadow-card pl-11 pr-10 py-3 text-sm font-semibold text-brand-900 dark:text-gray-100 outline-none focus:ring-2 focus:ring-accent-500/30 focus:border-accent-500 cursor-pointer"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <ChevronDown size={16} className="pointer-events-none absolute right-4 text-brand-900 dark:text-gray-300" />
    </label>
  )
}

/** Numéros de page affichés : 1 2 3 … 23 (la page courante et ses voisines restent visibles) */
function pageNumbers(current, total) {
  const set = new Set([1, total, current - 1, current, current + 1])
  if (current <= 3) [2, 3].forEach((n) => set.add(n))
  const pages = [...set].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b)
  const out = []
  pages.forEach((n, i) => {
    if (i > 0 && n - pages[i - 1] > 1) out.push('…' + n)
    out.push(n)
  })
  return out
}

function NumberedPagination({ page, totalPages, onPageChange, from, to, total }) {
  const btn = 'h-9 min-w-9 px-2.5 rounded-xl text-sm font-semibold flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed'
  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-4 border-t border-gray-100 dark:border-white/[0.06]">
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Affichage de {from} à {to} sur {total} facture{total > 1 ? 's' : ''}
      </p>
      {totalPages > 1 && (
        <nav className="flex items-center gap-1.5" aria-label="Pagination">
          <button type="button" aria-label="Page précédente" className={`${btn} border border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/[0.06]`} disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
            <ChevronLeft size={16} />
          </button>
          {pageNumbers(page, totalPages).map((n) =>
            typeof n === 'string' ? (
              <span key={n} className="px-1 text-gray-400">…</span>
            ) : (
              <button
                key={n}
                type="button"
                aria-current={n === page ? 'page' : undefined}
                className={`${btn} ${n === page ? 'bg-[#1d4fb8] text-white shadow-sm' : 'border border-gray-200 dark:border-white/10 text-brand-900 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/[0.06]'}`}
                onClick={() => onPageChange(n)}
              >
                {n}
              </button>
            )
          )}
          <button type="button" aria-label="Page suivante" className={`${btn} border border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/[0.06]`} disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
            <ChevronRight size={16} />
          </button>
        </nav>
      )}
    </div>
  )
}

const DATE_FILTERS = [
  { value: 'all', label: 'Toutes les dates' },
  { value: 'today', label: "Aujourd'hui" },
  { value: '7d', label: '7 derniers jours' },
  { value: 'month', label: 'Ce mois' },
  { value: 'last_month', label: 'Mois dernier' },
]

const STATUS_FILTERS = [
  { value: 'all', label: 'Tous les statuts' },
  { value: 'payee', label: 'Payées' },
  { value: 'partielle', label: 'Partiellement payées' },
  { value: 'credit', label: 'À crédit' },
  { value: 'delivery', label: 'Livraison à faire' },
  { value: 'draft', label: 'Devis' },
  { value: 'annulee', label: 'Annulées' },
]

function inDateFilter(dateStr, filter) {
  if (filter === 'all') return true
  const d = new Date(dateStr)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  switch (filter) {
    case 'today':
      return d >= today
    case '7d':
      return d >= new Date(today.getTime() - 6 * 86400000)
    case 'month':
      return d >= new Date(now.getFullYear(), now.getMonth(), 1)
    case 'last_month':
      return d >= new Date(now.getFullYear(), now.getMonth() - 1, 1) && d < new Date(now.getFullYear(), now.getMonth(), 1)
    default:
      return true
  }
}

function matchesStatus(sale, filter) {
  switch (filter) {
    case 'all':
      return true
    case 'draft':
      return sale.quote_status === 'draft' && sale.status !== 'annulee'
    case 'annulee':
      return sale.status === 'annulee'
    case 'delivery':
      return isCountedSale(sale) && sale.delivery_status !== 'livree'
    default:
      return isCountedSale(sale) && sale.status === filter
  }
}

const pctChange = (cur, prev) => (prev ? Math.round(((cur - prev) / prev) * 100) : null)

const escapeHtml = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

const STATUS_TEXT = { payee: 'Payée', partielle: 'Partiel', credit: 'À crédit', annulee: 'Annulée' }

/** Ouvre la liste filtrée dans une fenêtre imprimable (ou à enregistrer en PDF depuis le navigateur) */
function printSalesList(rows, subtitle) {
  const win = window.open('', '_blank')
  if (!win) return false
  const total = rows.filter(isCountedSale).reduce((s, r) => s + Number(r.total || 0), 0)
  const due = rows.filter(isCountedSale).reduce((s, r) => s + Math.max(0, Number(r.total || 0) - Number(r.amount_paid || 0)), 0)
  const body = rows
    .map((s) => {
      const rest = isCountedSale(s) ? Math.max(0, Number(s.total) - Number(s.amount_paid)) : 0
      const status = s.status === 'annulee' ? 'Annulée' : s.quote_status === 'draft' ? 'Devis' : STATUS_TEXT[s.status] || s.status
      return `<tr><td>${escapeHtml(s.invoice_number)}</td><td>${escapeHtml(new Date(s.created_at).toLocaleDateString('fr-FR'))}</td><td>${escapeHtml(s.clients?.name || 'Client comptoir')}<br><small>${escapeHtml(s.clients?.phone || '')}</small></td><td class="r">${escapeHtml(currency(s.total))}</td><td class="r">${rest > 0 ? escapeHtml(currency(rest)) : '—'}</td><td>${escapeHtml(status)}</td></tr>`
    })
    .join('')
  win.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Liste des ventes</title>
<style>
  body{font-family:Inter,system-ui,sans-serif;color:#0f172a;margin:24px}
  h1{font-size:20px;margin:0}p{margin:4px 0 16px;color:#475569;font-size:13px}
  table{width:100%;border-collapse:collapse;font-size:12px}
  th{background:#eef3f9;text-align:left;padding:8px;border-bottom:2px solid #1e3a7b;text-transform:uppercase;font-size:11px}
  td{padding:7px 8px;border-bottom:1px solid #e2e8f0;vertical-align:top}td small{color:#64748b}
  .r{text-align:right;white-space:nowrap}tfoot td{font-weight:700;border-top:2px solid #1e3a7b}
</style></head><body>
<h1>${escapeHtml(SHOP.name)} — Liste des ventes</h1>
<p>${escapeHtml(subtitle)} · ${rows.length} document(s) · imprimé le ${escapeHtml(new Date().toLocaleString('fr-FR'))}</p>
<table><thead><tr><th>N° facture</th><th>Date</th><th>Client</th><th class="r">Total</th><th class="r">Reste à payer</th><th>Statut</th></tr></thead>
<tbody>${body}</tbody>
<tfoot><tr><td colspan="3">Total (hors devis et annulées)</td><td class="r">${escapeHtml(currency(total))}</td><td class="r">${escapeHtml(currency(due))}</td><td></td></tr></tfoot></table>
<script>window.onload=function(){window.print()}</script>
</body></html>`)
  win.document.close()
  return true
}

/** Chariot vide (panier de la nouvelle vente) */
function CartIllustration({ className = '' }) {
  return (
    <svg viewBox="0 0 120 100" className={className} aria-hidden="true">
      <circle cx="62" cy="50" r="42" fill="#e4edfb" className="dark:opacity-20" />
      <path d="M18 24 h12 l10 42 h50 l10 -32 H36" fill="none" stroke="#3b6fe0" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M38 34 h58 l-8 26 H44 z" fill="#93b4f5" opacity="0.6" />
      <path d="M52 36 v22 M66 36 v22 M80 36 v22" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" opacity="0.8" />
      <circle cx="48" cy="80" r="6" fill="#3b6fe0" />
      <circle cx="84" cy="80" r="6" fill="#3b6fe0" />
      <path d="M82 14 c 4 -6 14 -4 12 4 c -1 5 -8 8 -12 4 z" fill="#bcd2f7" />
    </svg>
  )
}

export default function Sales() {
  const { user, isAdmin } = useAuth()
  const toast = useToast()
  const { data: products = [] } = useProducts()
  // Unité d'un produit (m, kg, L... → quantité décimale autorisée)
  const unitOf = (productId) => products.find((p) => p.id === productId)?.unit
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
  const [dateFilter, setDateFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [onlyDue, setOnlyDue] = useState(false)
  const [hideCancelled, setHideCancelled] = useState(false)
  const [onlyNamedClients, setOnlyNamedClients] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [newMenuOpen, setNewMenuOpen] = useState(false)
  const [showAllTop, setShowAllTop] = useState(false)
  const filtersRef = useRef(null)
  const newMenuRef = useRef(null)
  const closeFilters = useCallback(() => setFiltersOpen(false), [])
  const closeNewMenu = useCallback(() => setNewMenuOpen(false), [])
  useClickOutside(filtersRef, closeFilters, filtersOpen)
  useClickOutside(newMenuRef, closeNewMenu, newMenuOpen)

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

  // Raccourci du tableau de bord : /ventes?nouveau=1
  const [searchParams, setSearchParams] = useSearchParams()
  useEffect(() => {
    if (searchParams.get('nouveau') === '1') {
      setNewSaleOpen(true)
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, setSearchParams])

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
        const message = `Stock insuffisant pour "${overStock.product_name}" (disponible: ${formatQty(overStock.stock)})`
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

  // Factures ET devis : un devis se modifie sans toucher au stock
  const canEditSale = (s) => isAdmin && s.status !== 'annulee' && s.delivery_status !== 'partielle'
  const openEditSale = (s) => {
    setEditSale(s)
    setEditClientId(s.client_id || '')
    setEditDiscount(s.discount || 0)
    setEditSaleItems(s.sale_items || [])
    setEditProductToAdd('')
  }

  const handleUpdateSale = async (e) => {
    e.preventDefault()
    if (!editSale) return

    const docName = editSale.quote_status === 'draft' ? 'le devis' : 'la facture'
    // --- Validation ---
    if (editSaleItems.length === 0) {
      toast.error(`${editSale.quote_status === 'draft' ? 'Un devis' : 'Une facture'} doit contenir au moins un article.`)
      return
    }
    const newSubtotal = editSaleItems.reduce((sum, item) => sum + item.quantity * item.unit_price, 0)
    if (Number(editDiscount || 0) > newSubtotal) {
      toast.error(`La remise ne peut pas dépasser le sous-total de ${docName}.`)
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
      toast.error(err.message || `Erreur lors de la mise à jour de ${docName}`)
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

  const topSaleProducts = useMemo(() => {
    const frequency = new Map()
    sales.forEach((sale) =>
      (sale.sale_items || []).forEach((item) => {
        if (item.product_id) frequency.set(item.product_id, (frequency.get(item.product_id) || 0) + 1)
      })
    )
    const score = (p) => (frequency.get(p.id) || 0) + (Number(p.stock) > 0 ? 1e6 : 0)
    return [...products].sort((a, b) => score(b) - score(a)).slice(0, 12)
  }, [sales, products])

  const term = search.trim().toLowerCase()
  const extraFilterCount = [onlyDue, hideCancelled, onlyNamedClients].filter(Boolean).length
  const hasFilters = !!term || dateFilter !== 'all' || statusFilter !== 'all' || extraFilterCount > 0
  const filteredSales = sales.filter((s) => {
    if (term && !(
      s.invoice_number.toLowerCase().includes(term) ||
      (s.clients?.name || '').toLowerCase().includes(term) ||
      (s.clients?.phone || '').toLowerCase().includes(term)
    )) return false
    if (!inDateFilter(s.created_at, dateFilter)) return false
    if (!matchesStatus(s, statusFilter)) return false
    if (onlyDue && !(isCountedSale(s) && Number(s.total) - Number(s.amount_paid) > 0)) return false
    if (hideCancelled && s.status === 'annulee') return false
    if (onlyNamedClients && !s.client_id) return false
    return true
  })

  // Indicateurs du haut (factures confirmées uniquement), comparés à la période précédente équivalente
  const stats = useMemo(() => {
    const now = new Date()
    const DAY = 86400000
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const prevMonthSameDay = new Date(Math.min(new Date(now.getFullYear(), now.getMonth() - 1, now.getDate(), now.getHours(), now.getMinutes()).getTime(), monthStart.getTime()))
    const counted = sales.filter(isCountedSale).map((s) => ({ ...s, t: new Date(s.created_at).getTime() }))
    const between = (a, b) => counted.filter((s) => s.t >= a.getTime() && s.t < b.getTime())
    const sum = (list) => list.reduce((acc, s) => acc + Number(s.total || 0), 0)
    const distinctClients = (list) => new Set(list.filter((s) => s.client_id).map((s) => s.client_id)).size

    const todayTotal = sum(between(today, now))
    const yesterdayTotal = sum(between(new Date(today.getTime() - DAY), new Date(now.getTime() - DAY)))
    const monthList = between(monthStart, now)
    const prevMonthList = between(prevMonthStart, prevMonthSameDay)
    const start30 = new Date(today.getTime() - 29 * DAY)
    const activeClients = distinctClients(between(start30, now))
    const prevActive = distinctClients(between(new Date(start30.getTime() - 30 * DAY), start30))
    return {
      todayTotal,
      todayPct: pctChange(todayTotal, yesterdayTotal),
      invoiceCount: counted.length,
      invoicePct: pctChange(monthList.length, prevMonthList.length),
      activeClients,
      activePct: pctChange(activeClients, prevActive),
      monthRevenue: sum(monthList),
      revenuePct: pctChange(sum(monthList), sum(prevMonthList)),
    }
  }, [sales])

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
      canEditSale(s) && {
        icon: Edit,
        label: isDraft ? 'Modifier le devis' : 'Modifier la facture',
        onClick: () => openEditSale(s),
      },
      isAdmin && !isCancelled && { icon: RotateCcw, label: isDraft ? 'Annuler le devis' : 'Annuler la facture', tone: 'red', onClick: () => setConfirmCancel(s) },
      isAdmin && isCancelled && { icon: Trash2, label: 'Supprimer la facture', tone: 'red', onClick: () => setConfirmDelete(s) },
    ]
  }

  const editIsDraft = editSale?.quote_status === 'draft'
  const editProductOptions = useMemo(
    () => products.map((product) => ({
      value: product.id,
      label: `${product.name} - ${currency(product.sale_price)} (stock: ${formatQty(product.stock)})`,
      searchText: `${product.name || ''} ${product.sale_price || ''}`,
      disabled: !editIsDraft && Number(product.stock) <= 0,
      content: (
        <span className="flex min-w-0 flex-1 items-start justify-between gap-3">
          <span className="min-w-0">
            <span className="block truncate font-medium">{product.name}</span>
            <span className={`block truncate text-xs ${Number(product.stock) <= 0 ? 'text-red-500' : 'text-gray-400'}`}>
              {Number(product.stock) <= 0 ? 'Rupture de stock' : `Stock : ${formatQty(product.stock)}`}
            </span>
          </span>
          <span className="shrink-0 text-xs font-semibold tabular-nums text-gray-500 dark:text-gray-300">{currency(product.sale_price)}</span>
        </span>
      ),
    })),
    [products, editIsDraft]
  )

  const productOptions = useMemo(
    () =>
      products.map((product) => ({
        value: product.id,
        label: `${product.name} - ${currency(product.sale_price)} (stock: ${formatQty(product.stock)})`,
        searchText: `${product.name || ''} ${product.sale_price || ''} ${product.stock || ''}`,
        disabled: !isDraft && Number(product.stock) <= 0,
        content: (
          <span className="flex min-w-0 flex-1 items-start justify-between gap-3">
            <span className="min-w-0">
              <span className="block truncate font-medium">{product.name}</span>
              <span className={`block truncate text-xs ${Number(product.stock) <= 0 ? 'text-red-500' : 'text-gray-400'}`}>
                {Number(product.stock) <= 0 ? 'Rupture de stock' : `Stock : ${formatQty(product.stock)}`}
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
      {/* ---- En-tête ---- */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-5">
          <InvoiceIllustration className="hidden sm:block h-20 w-28 shrink-0" />
          <div>
            <h1 className="text-2xl sm:text-[32px] font-extrabold tracking-tight text-brand-900 dark:text-gray-50">Ventes / Facturation</h1>
            <p className="text-[15px] text-gray-600 dark:text-gray-400 mt-1">Gérez vos factures et consultez l'historique des ventes</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-2xl bg-white dark:bg-darkcard border border-gray-200/80 dark:border-white/[0.08] shadow-card px-5 py-3 text-sm font-semibold text-brand-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-white/[0.06] disabled:opacity-50"
            disabled={filteredSales.length === 0}
            onClick={() => {
              const parts = [DATE_FILTERS.find((f) => f.value === dateFilter)?.label, STATUS_FILTERS.find((f) => f.value === statusFilter)?.label, search && `« ${search} »`]
              if (!printSalesList(filteredSales, parts.filter(Boolean).join(' · '))) toast.error('Autorisez les fenêtres pop-up pour imprimer la liste.')
            }}
          >
            <Printer size={18} /> Imprimer
          </button>
          <div className="relative" ref={newMenuRef}>
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={newMenuOpen}
              className="btn-accent !rounded-2xl !px-5 !py-3 shadow-[0_10px_24px_-10px_rgba(243,158,38,0.7)]"
              onClick={() => setNewMenuOpen((o) => !o)}
            >
              <Plus size={18} strokeWidth={2.5} /> Nouvelle facture <ChevronDown size={16} className={`transition-transform ${newMenuOpen ? 'rotate-180' : ''}`} />
            </button>
            {newMenuOpen && (
              <div role="menu" className="absolute right-0 mt-2 w-60 card p-1.5 z-30 animate-fade-in">
                <button
                  type="button"
                  role="menuitem"
                  className="w-full flex items-start gap-3 px-3 py-2.5 text-left rounded-xl hover:bg-gray-50 dark:hover:bg-white/[0.06]"
                  onClick={() => { setNewMenuOpen(false); resetForm(); setNewSaleOpen(true) }}
                >
                  <FilePlus size={18} className="mt-0.5 text-accent-600" />
                  <span><span className="block text-sm font-semibold">Nouvelle facture</span><span className="block text-xs text-gray-500">Vente avec facture, payée ou à crédit</span></span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="w-full flex items-start gap-3 px-3 py-2.5 text-left rounded-xl hover:bg-gray-50 dark:hover:bg-white/[0.06]"
                  onClick={() => { setNewMenuOpen(false); resetForm(); setIsDraft(true); setNewQuoteOpen(true) }}
                >
                  <FileText size={18} className="mt-0.5 text-purple-600" />
                  <span><span className="block text-sm font-semibold">Nouveau devis</span><span className="block text-xs text-gray-500">Proposition de prix, sans toucher au stock</span></span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ---- Indicateurs ---- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatTile featured icon={ShoppingCart} label="Ventes du jour" value={currency(stats.todayTotal)} pct={stats.todayPct} hint="Total des factures du jour, comparé à hier à la même heure" />
        <StatTile tone="blue" icon={FileText} label="Total factures" value={stats.invoiceCount} pct={stats.invoicePct} hint="Factures confirmées (hors devis et annulées) · variation : factures de ce mois vs le mois dernier à la même date" />
        <StatTile tone="green" icon={Users} label="Clients actifs" value={stats.activeClients} pct={stats.activePct} hint="Clients ayant au moins une facture ces 30 derniers jours, comparé aux 30 jours précédents" />
        <StatTile tone="orange" icon={Coins} label="Chiffre d'affaires" value={currency(stats.monthRevenue)} pct={stats.revenuePct} hint="Factures de ce mois, comparé au mois dernier à la même date" />
      </div>

      {/* ---- Recherche et filtres ---- */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto_auto] gap-3">
        <div className="relative">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-900 dark:text-gray-300" />
          <input
            className="w-full rounded-2xl bg-white dark:bg-darkcard border border-gray-200/80 dark:border-white/[0.08] shadow-card pl-12 pr-4 py-3 text-sm outline-none placeholder:text-gray-500 focus:ring-2 focus:ring-accent-500/30 focus:border-accent-500"
            placeholder="Rechercher une facture, client ou téléphone..."
            aria-label="Rechercher une facture"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
          />
        </div>
        <FilterSelect icon={CalendarDays} label="Période" value={dateFilter} onChange={(v) => { setDateFilter(v); setPage(1) }} options={DATE_FILTERS} />
        <FilterSelect icon={ClipboardList} label="Statut" value={statusFilter} onChange={(v) => { setStatusFilter(v); setPage(1) }} options={STATUS_FILTERS} />
        <div className="relative" ref={filtersRef}>
          <button
            type="button"
            aria-expanded={filtersOpen}
            className={`w-full inline-flex items-center justify-center gap-2.5 rounded-2xl border shadow-card px-5 py-3 text-sm font-semibold ${
              extraFilterCount ? 'bg-blue-50 border-blue-200 text-[#1d4fb8] dark:bg-blue-500/15 dark:border-blue-500/30 dark:text-blue-200' : 'bg-white dark:bg-darkcard border-gray-200/80 dark:border-white/[0.08] text-brand-900 dark:text-gray-100'
            }`}
            onClick={() => setFiltersOpen((o) => !o)}
          >
            <SlidersHorizontal size={17} /> Filtres{extraFilterCount ? ` (${extraFilterCount})` : ''} <ChevronDown size={16} />
          </button>
          {filtersOpen && (
            <div className="absolute right-0 mt-2 w-72 card p-4 z-30 space-y-3 animate-fade-in">
              <label className="flex items-center gap-2.5 text-sm cursor-pointer">
                <input type="checkbox" className="h-4 w-4 accent-[#1d4fb8]" checked={onlyDue} onChange={(e) => { setOnlyDue(e.target.checked); setPage(1) }} />
                Avec un reste à payer
              </label>
              <label className="flex items-center gap-2.5 text-sm cursor-pointer">
                <input type="checkbox" className="h-4 w-4 accent-[#1d4fb8]" checked={hideCancelled} onChange={(e) => { setHideCancelled(e.target.checked); setPage(1) }} />
                Masquer les annulées
              </label>
              <label className="flex items-center gap-2.5 text-sm cursor-pointer">
                <input type="checkbox" className="h-4 w-4 accent-[#1d4fb8]" checked={onlyNamedClients} onChange={(e) => { setOnlyNamedClients(e.target.checked); setPage(1) }} />
                Exclure le client comptoir
              </label>
              <button
                type="button"
                className="w-full btn-secondary !py-2 text-sm"
                onClick={() => { setOnlyDue(false); setHideCancelled(false); setOnlyNamedClients(false); setDateFilter('all'); setStatusFilter('all'); setSearch(''); setPage(1); setFiltersOpen(false) }}
              >
                Réinitialiser tous les filtres
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ---- Liste ---- */}
      <section className="card !rounded-3xl overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <h2 className="flex items-center gap-2.5 text-lg font-bold text-brand-900 dark:text-gray-50">
            <span className="h-8 w-8 rounded-full bg-[#1d4fb8] text-white flex items-center justify-center"><Receipt size={16} /></span>
            Liste des ventes (Factures)
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            {totalDette > 0 && (
              <span className="rounded-full bg-red-50 dark:bg-red-500/10 px-3.5 py-1.5 text-xs font-semibold text-red-600 dark:text-red-400" title="Dette totale de vos clients (avances / crédits)">
                Dette clients : {currency(totalDette)}
              </span>
            )}
            {!isLoading && (
              <span className="rounded-full bg-blue-50 dark:bg-blue-500/15 px-3.5 py-1.5 text-xs font-semibold text-[#1d4fb8] dark:text-blue-200">
                {filteredSales.length === sales.length
                  ? `${sales.length} facture${sales.length > 1 ? 's' : ''} au total`
                  : `${filteredSales.length} sur ${sales.length} facture${sales.length > 1 ? 's' : ''}`}
              </span>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-2 animate-pulse">
                <div className="h-8 w-8 rounded-full bg-gray-100 dark:bg-white/[0.06]" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-1/4 rounded bg-gray-100 dark:bg-white/[0.06]" />
                  <div className="h-2.5 w-1/6 rounded bg-gray-100 dark:bg-white/[0.06]" />
                </div>
                <div className="h-3 w-16 rounded bg-gray-100 dark:bg-white/[0.06]" />
              </div>
            ))}
          </div>
        ) : filteredSales.length === 0 ? (
          <div className="p-12 flex flex-col items-center text-center gap-3">
            <div className="h-12 w-12 rounded-full bg-gray-100 dark:bg-white/[0.06] flex items-center justify-center text-gray-400">
              <FileText size={20} />
            </div>
            <div>
              <p className="font-medium">{hasFilters ? 'Aucune facture ne correspond à vos critères' : 'Aucune vente enregistrée'}</p>
              <p className="text-sm text-gray-400 mt-0.5">
                {hasFilters ? 'Modifiez la recherche ou les filtres.' : 'Créez votre première facture pour commencer.'}
              </p>
            </div>
            {!hasFilters && (
              <button className="btn-primary mt-1" onClick={() => { resetForm(); setNewSaleOpen(true) }}>
                <Plus size={16} /> Nouvelle facture
              </button>
            )}
          </div>
        ) : (
          <>
            {/* ---- Tableau (desktop / tablette) ---- */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-50/80 dark:bg-white/[0.03]">
                    <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-brand-900 dark:text-gray-300"># Facture</th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-brand-900 dark:text-gray-300">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-brand-900 dark:text-gray-300">Client</th>
                    <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-brand-900 dark:text-gray-300">Total</th>
                    <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-brand-900 dark:text-gray-300">Reste à payer</th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-brand-900 dark:text-gray-300">Statut</th>
                    <th className="px-5 py-3 text-right text-xs font-bold uppercase tracking-wide text-brand-900 dark:text-gray-300">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/[0.06]">
                  {paginatedSales.map((s) => {
                    const date = formatRelativeDate(s.created_at)
                    const due = Number(s.total) - Number(s.amount_paid)
                    const isDraft = s.quote_status === 'draft'
                    const isCancelled = s.status === 'annulee'
                    return (
                      <tr
                        key={s.id}
                        className={`hover:bg-blue-50/40 dark:hover:bg-white/[0.03] transition-colors cursor-pointer ${isCancelled ? 'opacity-60' : ''}`}
                        onClick={() => setDetailSale(s)}
                      >
                        <td className="px-5 py-3 text-sm font-bold text-brand-900 dark:text-gray-100 whitespace-nowrap">{s.invoice_number}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">{date.label}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <ClientAvatar name={s.clients?.name} />
                            <div className="min-w-0">
                              <p className="text-sm font-bold uppercase text-brand-900 dark:text-gray-100 truncate max-w-[260px]">{s.clients?.name || 'Client comptoir'}</p>
                              {s.clients?.phone && <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{s.clients.phone}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-bold tabular-nums text-brand-900 dark:text-gray-100 whitespace-nowrap">{currency(s.total)}</td>
                        <td className="px-4 py-3 text-right text-sm tabular-nums whitespace-nowrap">
                          {!isCancelled && !isDraft && due > 0 ? (
                            <span className="text-red-600 dark:text-red-400 font-bold">{currency(due)}</span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3"><SalePills sale={s} /></td>
                        <td className="px-5 py-3" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            <button type="button" title="Voir le détail" aria-label="Voir le détail" className="h-9 w-9 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.1] text-brand-900 dark:text-gray-200 flex items-center justify-center" onClick={() => setDetailSale(s)}>
                              <Eye size={17} />
                            </button>
                            <button type="button" title={isDraft ? 'Télécharger le devis (PDF)' : 'Télécharger / imprimer la facture (PDF)'} aria-label="Télécharger le PDF" className="h-9 w-9 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.1] text-brand-900 dark:text-gray-200 flex items-center justify-center" onClick={() => downloadInvoicePDF(s)}>
                              <Printer size={17} />
                            </button>
                            <RowActions items={buildSaleMenu(s)} />
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* ---- Vue cartes (mobile) ---- */}
            <div className="md:hidden divide-y divide-gray-100 dark:divide-white/[0.06]">
              {paginatedSales.map((s) => {
                const date = formatRelativeDate(s.created_at)
                const due = Number(s.total) - Number(s.amount_paid)
                const showDue = s.status !== 'annulee' && s.quote_status !== 'draft' && due > 0
                return (
                  <div key={s.id} className="p-4" onClick={() => setDetailSale(s)}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <ClientAvatar name={s.clients?.name} />
                        <div className="min-w-0">
                          <p className="text-sm font-bold uppercase truncate text-brand-900 dark:text-gray-100">{s.clients?.name || 'Client comptoir'}</p>
                          <p className="text-xs text-gray-500">{s.invoice_number} · {date.label}</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-bold tabular-nums text-brand-900 dark:text-gray-100">{currency(s.total)}</span>
                        {showDue && <p className="text-[11px] font-semibold text-red-600 mt-0.5">Reste : {currency(due)}</p>}
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-3">
                      <SalePills sale={s} />
                      <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <button type="button" aria-label="Télécharger le PDF" className="h-9 w-9 rounded-xl bg-gray-100 dark:bg-white/[0.06] text-brand-900 dark:text-gray-200 flex items-center justify-center" onClick={() => downloadInvoicePDF(s)}>
                          <Printer size={16} />
                        </button>
                        <RowActions items={buildSaleMenu(s)} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            <NumberedPagination
              page={page}
              totalPages={totalPages}
              onPageChange={setPage}
              from={(page - 1) * pageSize + 1}
              to={Math.min(page * pageSize, filteredSales.length)}
              total={filteredSales.length}
            />
          </>
        )}
      </section>

      {/* ---- Modal: nouvelle vente / devis ---- */}
      <Modal
        open={newSaleOpen || newQuoteOpen}
        onClose={() => { setNewSaleOpen(false); setNewQuoteOpen(false) }}
        title={isDraft ? 'Nouveau devis' : 'Nouvelle vente'}
        subtitle={isDraft ? 'Préparez une proposition de prix : le stock ne bouge pas' : 'Sélectionnez un produit, ajoutez-le au panier et finalisez la vente'}
        icon={isDraft ? FileText : ShoppingCart}
        maxWidth="max-w-5xl"
      >
        <form onSubmit={handleCreateSale} className="space-y-4">
          {/* ---- Client + type de document ---- */}
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4 md:items-end">
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
              <p className="label">Type de document</p>
              <div role="radiogroup" aria-label="Type de document" className="inline-flex w-full md:w-auto rounded-2xl bg-gray-100 dark:bg-white/[0.06] p-1">
                {[
                  { value: 'facture', label: 'Facture', icon: FileText },
                  { value: 'devis', label: 'Devis', icon: Send },
                ].map((opt) => {
                  const active = (isDraft ? 'devis' : 'facture') === opt.value
                  const OptIcon = opt.icon
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      className={`flex-1 md:w-32 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${
                        active ? 'bg-[#13306f] text-white shadow-sm' : 'text-brand-900 dark:text-gray-300 hover:bg-white/70 dark:hover:bg-white/[0.06]'
                      }`}
                      onClick={() => {
                        const draft = opt.value === 'devis'
                        setIsDraft(draft)
                        if (draft) changePayMode('full')
                      }}
                    >
                      <OptIcon size={16} /> {opt.label}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* ---- Recherche de produit ---- */}
          <div>
            <label className="label">Ajouter un produit</label>
            <SearchableSelect
              value=""
              onChange={(id) => addProduct(id)}
              options={productOptions}
              placeholder="Rechercher un produit par nom, puis Entrée..."
              emptyMessage="Aucun produit trouvé"
              clearOnSelect
              autoFocus
            />
          </div>

          {/* ---- Plus vendus | Panier ---- */}
          <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-4">
            <div className="rounded-2xl border border-gray-200/80 dark:border-white/[0.08] p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="flex items-center gap-2 font-bold text-brand-900 dark:text-gray-100">
                  <Star size={18} className="text-accent-500 fill-accent-500" /> Produits les plus vendus
                </p>
                {topSaleProducts.length > 4 && (
                  <button type="button" className="flex items-center gap-1 text-sm font-semibold text-blue-700 dark:text-blue-300 hover:underline" onClick={() => setShowAllTop((v) => !v)}>
                    {showAllTop ? 'Moins' : 'Voir tous'} <ArrowRight size={14} />
                  </button>
                )}
              </div>
              {topSaleProducts.length === 0 ? (
                <p className="text-sm text-gray-400 py-6 text-center">Aucun produit en stock.</p>
              ) : (
                <div className={`grid grid-cols-1 sm:grid-cols-2 gap-3 ${showAllTop ? 'max-h-[340px] overflow-y-auto pr-1' : ''}`}>
                  {(showAllTop ? topSaleProducts : topSaleProducts.slice(0, 4)).map((p) => {
                    const out = Number(p.stock) <= 0
                    return (
                      <button
                        key={p.id}
                        type="button"
                        disabled={out && !isDraft}
                        onClick={() => addProduct(p.id)}
                        className="group flex items-center gap-3 text-left p-3 rounded-2xl border border-gray-200/80 dark:border-white/[0.08] bg-white dark:bg-white/[0.02] hover:border-blue-300 hover:shadow-card dark:hover:border-blue-500/50 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {p.image_url ? (
                          <img src={p.image_url} alt="" loading="lazy" className="h-14 w-14 shrink-0 rounded-xl object-cover bg-gray-50 dark:bg-white/[0.04]" />
                        ) : (
                          <span className="h-14 w-14 shrink-0 rounded-xl bg-gray-100 dark:bg-white/[0.06] text-gray-400 flex items-center justify-center"><Package size={20} /></span>
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block text-[13px] font-bold uppercase text-brand-900 dark:text-gray-100 truncate">{p.name}</span>
                          <span className="block text-[15px] font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums">{currency(p.sale_price)}</span>
                          <span className={`block text-xs ${out ? 'text-red-500' : 'text-gray-500 dark:text-gray-400'}`}>{out ? 'Rupture' : `Stock : ${formatQty(p.stock)}`}</span>
                        </span>
                        <PlusCircle size={24} className="shrink-0 text-[#1d4fb8] dark:text-blue-300 transition-transform group-hover:scale-110" />
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-gray-200/80 dark:border-white/[0.08] p-4 flex flex-col">
              <p className="flex items-center gap-2 font-bold text-brand-900 dark:text-gray-100 mb-3">
                <ShoppingCart size={18} /> Panier de vente <span className="font-normal text-gray-500">({cart.length} article{cart.length > 1 ? 's' : ''})</span>
              </p>
              {cart.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center py-6 gap-1">
                  <CartIllustration className="h-24 w-28 mb-1" />
                  <p className="font-bold text-brand-900 dark:text-gray-100">Aucun article ajouté</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 max-w-[220px]">Ajoutez des produits pour commencer la vente</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-white/[0.06] max-h-[340px] overflow-y-auto -mx-1 px-1">
                  {cart.map((item) => {
                    const over = !isDraft && item.quantity > item.stock
                    return (
                      <div key={item.product_id} className="py-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-bold uppercase text-brand-900 dark:text-gray-100 truncate">{item.product_name}</p>
                            <p className="text-xs text-gray-500 tabular-nums">{currency(item.unit_price)} / unité · stock {formatQty(item.stock)}</p>
                          </div>
                          <button
                            type="button"
                            aria-label={`Retirer ${item.product_name}`}
                            className="p-1.5 -mr-1 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl"
                            onClick={() => removeFromCart(item.product_id)}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                        <div className="flex items-center justify-between mt-1.5">
                          <QtyStepper value={item.quantity} unit={unitOf(item.product_id)} onChange={(q) => updateQuantity(item.product_id, q)} invalid={over} />
                          <p className="text-sm font-bold tabular-nums text-brand-900 dark:text-gray-100">{currency(item.quantity * item.unit_price)}</p>
                        </div>
                        {over && <p className="text-xs text-red-500 mt-1">Stock insuffisant : {formatQty(item.stock)} disponible{Number(item.stock) > 1 ? 's' : ''}.</p>}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ---- Remise, paiement, livraison ---- */}
          <div className={`grid grid-cols-1 gap-4 rounded-2xl bg-gray-50 dark:bg-white/[0.03] p-4 ${isDraft ? 'md:grid-cols-[200px_1fr]' : 'md:grid-cols-[180px_1.4fr_1fr]'}`}>
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

            {isDraft ? (
              <p className="self-end text-sm text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-500/10 rounded-xl px-3 py-2.5">
                Le stock n'est pas touché. Vous pourrez confirmer le devis plus tard pour en faire une facture.
              </p>
            ) : (
              <>
                <div>
                  <p className="label">Paiement</p>
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
                  <div className="mt-2 flex flex-col sm:flex-row gap-2">
                    {payMode !== 'credit' && (
                      <select
                        className="input sm:flex-1"
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
                    {payMode === 'advance' && (
                      <div className="sm:flex-1">
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
                        <div className="flex gap-1.5 mt-1.5">
                          {[
                            { label: 'Moitié', value: Math.round(total / 2) },
                            { label: 'Tout', value: total },
                          ].map((chip) => (
                            <button key={chip.label} type="button" className="badge bg-white border border-gray-200 text-gray-600 hover:bg-gray-100 dark:bg-white/[0.06] dark:border-white/10 dark:text-gray-300" onClick={() => setAmountPaid(String(chip.value))}>
                              {chip.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  {payMode === 'credit' && <p className="text-xs text-gray-500 mt-1.5">Rien n'est payé maintenant : le montant s'ajoute à la dette du client.</p>}
                </div>
                <div>
                  <p className="label">Livraison</p>
                  <Segmented
                    label="Livraison"
                    value={deliveryMode}
                    onChange={setDeliveryMode}
                    options={[
                      { value: 'immediate', label: 'Tout de suite' },
                      { value: 'staged', label: 'Plus tard' },
                    ]}
                  />
                  {deliveryMode === 'staged' && <p className="text-xs text-gray-500 mt-1.5">Le stock sort au fur et à mesure des bons de livraison.</p>}
                </div>
              </>
            )}
          </div>

          {/* ---- Pied collant : total + actions ---- */}
          <div className="sticky -bottom-5 sm:-bottom-6 -mx-5 sm:-mx-6 -mb-5 sm:-mb-6 px-5 sm:px-6 py-4 bg-white/95 dark:bg-darkcard/95 backdrop-blur border-t border-gray-200 dark:border-white/[0.08] rounded-b-xl">
            {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400 mb-2">{error}</p>}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="rounded-2xl bg-blue-50/80 dark:bg-blue-500/10 px-5 py-2.5 sm:min-w-[280px]">
                <p className="text-sm font-semibold text-brand-900 dark:text-gray-200">{isDraft ? 'Total du devis' : 'Total à payer'}</p>
                <p className="text-[28px] font-extrabold tabular-nums leading-tight text-[#13306f] dark:text-blue-200">{currency(total)}</p>
                {(Number(discount) > 0 || (!isDraft && payMode !== 'full')) && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
                    {Number(discount) > 0 && <>Sous-total {currency(subtotal)} · remise − {currency(discount)}</>}
                    {Number(discount) > 0 && !isDraft && payMode !== 'full' && ' · '}
                    {!isDraft && payMode !== 'full' && (
                      <span className="text-red-600 dark:text-red-400 font-semibold">Reste à payer {currency(Math.max(0, total - Number(amountPaid || 0)))}</span>
                    )}
                  </p>
                )}
              </div>
              <div className="flex gap-3">
                <button type="button" className="btn-secondary !rounded-2xl !px-6 !py-3" onClick={() => { setNewSaleOpen(false); setNewQuoteOpen(false) }}>
                  <Trash2 size={16} /> Annuler
                </button>
                <button type="submit" className="btn-accent !rounded-2xl !px-8 !py-3 flex-1 sm:flex-none shadow-[0_10px_24px_-10px_rgba(243,158,38,0.7)]" disabled={createSale.isPending || cart.length === 0}>
                  <Check size={18} strokeWidth={2.75} /> {createSale.isPending ? 'Enregistrement...' : isDraft ? 'Enregistrer le devis' : 'Valider la vente'}
                </button>
              </div>
            </div>
          </div>
        </form>
      </Modal>

      {/* ---- Modal: modifier une facture (client, remise, articles) ---- */}
      <Modal
        open={!!editSale}
        onClose={() => setEditSale(null)}
        icon={Pencil}
        title={<>{editIsDraft ? 'Modifier le devis' : 'Modifier la facture'} <span className="whitespace-nowrap">{editSale?.invoice_number}</span></>}
        subtitle={editIsDraft ? 'Client, articles, quantités, prix et remise · le stock ne bouge pas' : 'Client, articles, quantités, prix et remise'}
        maxWidth="max-w-4xl"
      >
        {editSale && (() => {
          const editSubtotal = editSaleItems.reduce((sum, item) => sum + item.quantity * item.unit_price, 0)
          const editTotal = Math.max(0, editSubtotal - Number(editDiscount || 0))
          const alreadyPaid = Number(editSale.amount_paid || 0)
          const newDue = editTotal - alreadyPaid
          const diff = editTotal - Number(editSale.total || 0)
          return (
            <form onSubmit={handleUpdateSale} className="space-y-4">
              {/* Client + ajout de produit */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    options={editProductOptions}
                    placeholder="Tapez le nom du produit puis Entrée..."
                    emptyMessage="Aucun produit trouvé"
                    clearOnSelect
                  />
                </div>
              </div>

              {/* Articles : une ligne par article */}
              <div className="rounded-2xl border border-gray-200/80 dark:border-white/[0.08] overflow-hidden">
                <div className="hidden md:grid grid-cols-[1fr_140px_130px_130px_40px] items-center gap-3 px-4 py-2.5 bg-gray-50/80 dark:bg-white/[0.03] border-b border-gray-200/80 dark:border-white/[0.08] text-xs font-bold uppercase tracking-wide text-brand-900 dark:text-gray-300">
                  <span>Article ({editSaleItems.length})</span>
                  <span className="text-center">Quantité</span>
                  <span className="text-right">Prix unitaire</span>
                  <span className="text-right">Total</span>
                  <span />
                </div>
                {editSaleItems.length === 0 ? (
                  <p className="text-sm text-gray-500 p-6 text-center">Aucun article : ajoutez-en au moins un.</p>
                ) : (
                  <ul className="divide-y divide-gray-100 dark:divide-white/[0.06] max-h-[42vh] overflow-y-auto">
                    {editSaleItems.map((item) => (
                      <li key={item.id} className="grid grid-cols-[1fr_auto] md:grid-cols-[1fr_140px_130px_130px_40px] items-center gap-x-3 gap-y-2 px-4 py-2.5">
                        <p className="text-sm font-bold uppercase text-brand-900 dark:text-gray-100 truncate" title={item.product_name}>{item.product_name}</p>
                        <button
                          type="button"
                          aria-label={`Retirer ${item.product_name}`}
                          title="Retirer l'article"
                          className="md:hidden h-9 w-9 rounded-xl flex items-center justify-center bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-500/10 dark:text-red-400"
                          onClick={() => handleRemoveEditSaleItem(item.id)}
                        >
                          <Trash2 size={15} />
                        </button>
                        <div className="md:flex md:justify-center">
                          <QtyStepper value={item.quantity} unit={unitOf(item.product_id)} onChange={(q) => handleEditSaleItemQuantity(item.id, q)} />
                        </div>
                        <div className="relative">
                          <input
                            type="number"
                            inputMode="numeric"
                            min="0"
                            aria-label={`Prix unitaire de ${item.product_name}`}
                            className="input !rounded-2xl h-10 pr-3 text-right font-semibold tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                            value={item.unit_price}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => handleEditSaleItemPrice(item.id, e.target.value)}
                          />
                        </div>
                        <p className="text-sm font-extrabold tabular-nums text-right text-brand-900 dark:text-gray-100 col-span-2 md:col-span-1">
                          <span className="md:hidden text-xs font-medium text-gray-500 mr-2">Total</span>
                          {currency(item.quantity * item.unit_price)}
                        </p>
                        <button
                          type="button"
                          aria-label={`Retirer ${item.product_name}`}
                          title="Retirer l'article"
                          className="hidden md:flex h-9 w-9 rounded-xl items-center justify-center bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20"
                          onClick={() => handleRemoveEditSaleItem(item.id)}
                        >
                          <Trash2 size={15} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Remise + récapitulatif */}
              <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-4 rounded-2xl bg-gray-50 dark:bg-white/[0.03] p-4">
                <div>
                  <label className="label" htmlFor="edit-discount">Remise (FCFA)</label>
                  <input
                    id="edit-discount"
                    type="number"
                    inputMode="numeric"
                    min="0"
                    className="input !rounded-2xl text-right font-semibold tabular-nums"
                    value={editDiscount}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setEditDiscount(e.target.value)}
                  />
                </div>
                <dl className={`grid grid-cols-2 gap-2 text-center ${editIsDraft ? 'sm:grid-cols-2' : 'sm:grid-cols-4'}`}>
                  <div className="rounded-xl bg-white dark:bg-white/[0.04] px-2 py-2.5">
                    <dt className="text-[11px] text-gray-500">Sous-total</dt>
                    <dd className="text-sm font-bold tabular-nums text-brand-900 dark:text-gray-100">{currency(editSubtotal)}</dd>
                  </div>
                  <div className="rounded-xl bg-white dark:bg-white/[0.04] px-2 py-2.5">
                    <dt className="text-[11px] text-gray-500">Ancien total</dt>
                    <dd className="text-sm font-bold tabular-nums text-brand-900 dark:text-gray-100">{currency(editSale.total)}</dd>
                  </div>
                  {!editIsDraft && <>
                  <div className="rounded-xl bg-white dark:bg-white/[0.04] px-2 py-2.5">
                    <dt className="text-[11px] text-gray-500">Déjà payé</dt>
                    <dd className="text-sm font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{currency(alreadyPaid)}</dd>
                  </div>
                  <div className={`rounded-xl px-2 py-2.5 ${newDue > 0 ? 'bg-red-50 dark:bg-red-500/10' : 'bg-emerald-50 dark:bg-emerald-500/10'}`}>
                    <dt className="text-[11px] text-gray-500">{newDue > 0 ? 'Nouveau reste' : newDue < 0 ? 'Trop-perçu' : 'Soldée'}</dt>
                    <dd className={`text-sm font-extrabold tabular-nums ${newDue > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>{currency(Math.abs(newDue))}</dd>
                  </div>
                  </>}
                </dl>
              </div>

              {!editIsDraft && newDue < 0 && (
                <Callout tone="amber" title="Le nouveau total est inférieur à ce qui a déjà été payé">
                  Le client a payé {currency(alreadyPaid)} : vérifiez les quantités ou prévoyez un remboursement.
                </Callout>
              )}

              {/* Pied collant : nouveau total + actions */}
              <div className="sticky -bottom-5 sm:-bottom-6 -mx-5 sm:-mx-6 -mb-5 sm:-mb-6 px-5 sm:px-6 py-4 bg-white/95 dark:bg-darkcard/95 backdrop-blur border-t border-gray-200 dark:border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="rounded-2xl bg-blue-50/80 dark:bg-blue-500/10 px-5 py-2.5">
                  <p className="text-sm font-semibold text-brand-900 dark:text-gray-200">{editIsDraft ? 'Nouveau total du devis' : 'Nouveau total'}</p>
                  <p className="text-2xl font-extrabold tabular-nums leading-tight text-[#13306f] dark:text-blue-200">
                    {currency(editTotal)}
                    {diff !== 0 && (
                      <span className={`ml-2 align-middle text-xs font-bold ${diff > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                        {diff > 0 ? '+' : '−'}{currency(Math.abs(diff))}
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex gap-3">
                  <button type="button" className="btn-secondary !rounded-2xl !px-5" onClick={() => setEditSale(null)}>Annuler</button>
                  <button type="submit" className="btn-cta flex-1 sm:flex-none" disabled={updateSaleItems.isPending || editSaleItems.length === 0}>
                    <Check size={18} strokeWidth={2.75} /> {updateSaleItems.isPending ? 'Enregistrement...' : editIsDraft ? 'Enregistrer le devis' : 'Enregistrer les modifications'}
                  </button>
                </div>
              </div>
            </form>
          )
        })()}
      </Modal>

      {/* ---- Modal: gestion des livraisons ---- */}
      <Modal open={!!deliverySale} onClose={() => { setDeliverySale(null); setNewDeliveryOpen(false) }} icon={Truck} title={deliverySale ? `Livraisons - Facture ${deliverySale.invoice_number}` : ''} maxWidth="max-w-2xl">
        {deliverySale && (
          <div className="space-y-4">
            {deliveriesLoading && <p className="text-sm text-gray-400">Chargement...</p>}

            {!deliveriesLoading && deliveries.length > 0 && (
              <div className="space-y-2">
                <label className="label">Bons de livraison existants</label>
                <div className="border border-gray-200 dark:border-white/[0.08] rounded-xl divide-y divide-gray-100 dark:divide-white/[0.06]">
                  {deliveries.map((delivery) => (
                    <div key={delivery.id} className="p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <span className="text-sm font-semibold whitespace-nowrap">{delivery.delivery_number}</span>
                          <span className="text-xs text-gray-400 ml-2">{new Date(delivery.created_at).toLocaleString('fr-FR')}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <DocumentSignatureSection
                            compact
                            docType="delivery"
                            docId={delivery.id}
                            isAdmin={isAdmin}
                            cancelled={deliverySale.status === 'annulee'}
                          />
                          <button
                            type="button"
                            className="text-xs btn-secondary py-1 px-2"
                            onClick={() => downloadDeliveryPDF(buildDeliveryPdfData(delivery))}
                          >
                            <Download size={12} /> PDF
                          </button>
                        </div>
                      </div>
                      {delivery.notes && <p className="text-xs text-gray-500 mb-1">{delivery.notes}</p>}
                      <div className="space-y-1">
                        {delivery.delivery_items?.map((di) => (
                          <div key={di.id} className="flex justify-between text-xs text-gray-600 dark:text-gray-300">
                            <span>{di.sale_items?.product_name || 'Article'}</span>
                            <span className="font-medium">× {formatQty(di.quantity_delivered)}</span>
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
              <form onSubmit={handleCreateDelivery} className="space-y-3 border border-gray-200 dark:border-white/[0.08] rounded-xl p-3">
                <label className="label">Quantités à livrer maintenant</label>
                {deliveryItems.length === 0 && <p className="text-xs text-gray-400">Tous les articles ont déjà été livrés.</p>}
                {deliveryItems.map((item) => (
                  <div key={item.sale_item_id} className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-brand-900 dark:text-gray-100 truncate">{item.product_name}</p>
                      <p className="text-xs text-gray-400">Commandé : {formatQty(item.quantity)} · reste à livrer : {formatQty(item.available)}</p>
                    </div>
                    <QtyStepper
                      min={0}
                      unit={unitOf(item.product_id)}
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
                <div className="flex justify-end gap-2.5 pt-4 mt-1 border-t border-gray-100 dark:border-white/[0.06]">
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
        icon={Receipt}
        title={<>{detailSale?.quote_status === 'draft' ? 'Devis' : 'Facture'} <span className="whitespace-nowrap">{detailSale?.invoice_number}</span></>}
        subtitle={detailSale ? `Créé le ${new Date(detailSale.created_at).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' })}` : ''}
        maxWidth="max-w-4xl"
      >
        {detailSale && (() => {
          const isDraft = detailSale.quote_status === 'draft'
          const isCancelled = detailSale.status === 'annulee'
          const total = Number(detailSale.total || 0)
          const paid = Number(detailSale.amount_paid || 0)
          const due = total - paid
          const discount = Number(detailSale.discount || 0)
          const paidPct = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0
          const items = detailSale.sale_items || []
          return (
            <div className="space-y-4">
              {/* Client + statuts */}
              <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-gray-50 dark:bg-white/[0.04] px-4 py-3">
                <ClientAvatar name={detailSale.clients?.name} />
                <div className="min-w-0 flex-1">
                  <p className="font-bold uppercase text-brand-900 dark:text-gray-50 truncate">{detailSale.clients?.name || 'Client comptoir'}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{detailSale.clients?.phone || 'Aucun numéro enregistré'}</p>
                </div>
                <SalePills sale={detailSale} />
              </div>

              {isDraft && !isCancelled && (
                <Callout tone="purple" title="Ceci est un devis (brouillon)">
                  Il n'affecte pas le stock et ne compte pas dans le chiffre d'affaires.
                </Callout>
              )}
              {isCancelled && (
                <Callout tone="red" title="Facture annulée">
                  Les quantités sorties ont été remises en stock{paid > 0 ? ' et les encaissements remboursés.' : '.'}
                </Callout>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-[1.35fr_1fr] gap-4 items-start">
                {/* ---- Articles ---- */}
                <div className="rounded-2xl border border-gray-200/80 dark:border-white/[0.08] overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 bg-gray-50/80 dark:bg-white/[0.03] border-b border-gray-200/80 dark:border-white/[0.08]">
                    <p className="text-xs font-bold uppercase tracking-wide text-brand-900 dark:text-gray-300">Articles</p>
                    <span className="rounded-full bg-blue-50 dark:bg-blue-500/15 px-2.5 py-0.5 text-xs font-semibold text-[#1d4fb8] dark:text-blue-200">
                      {items.length} article{items.length > 1 ? 's' : ''}
                    </span>
                  </div>
                  <ul className="divide-y divide-gray-100 dark:divide-white/[0.06] max-h-[46vh] overflow-y-auto">
                    {items.map((item) => (
                      <li key={item.id} className="flex items-center gap-3 px-4 py-3">
                        <span className="h-9 min-w-9 px-2 shrink-0 rounded-xl bg-blue-50 dark:bg-blue-500/15 text-[#1d4fb8] dark:text-blue-200 text-xs font-bold flex items-center justify-center tabular-nums">
                          ×{formatQty(item.quantity)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold uppercase text-brand-900 dark:text-gray-100 truncate" title={item.product_name}>{item.product_name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">{currency(item.unit_price)} / unité</p>
                        </div>
                        <span className="text-sm font-bold tabular-nums whitespace-nowrap text-brand-900 dark:text-gray-100">{currency(item.line_total)}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* ---- Montants, signature, paiements ---- */}
                <div className="space-y-4">
                  <div className="rounded-2xl bg-gradient-to-br from-[#1a3f95] to-[#0d2550] text-white p-5 shadow-[0_14px_30px_-14px_rgba(19,48,111,0.7)]">
                    {discount > 0 && (
                      <div className="flex justify-between text-sm text-white/75 mb-1">
                        <span>Sous-total · remise</span>
                        <span className="tabular-nums">{currency(detailSale.subtotal)} − {currency(discount)}</span>
                      </div>
                    )}
                    <p className="text-sm text-white/80">{isDraft ? 'Montant du devis' : 'Total de la facture'}</p>
                    <p className="text-[30px] font-extrabold tabular-nums leading-tight">{currency(total)}</p>
                    {!isDraft && !isCancelled && (
                      <>
                        <div className="mt-3 h-2 rounded-full bg-white/15 overflow-hidden" role="progressbar" aria-valuenow={paidPct} aria-valuemin={0} aria-valuemax={100} aria-label="Part payée">
                          <div className={`h-full rounded-full ${due > 0 ? 'bg-accent-400' : 'bg-emerald-400'}`} style={{ width: `${paidPct}%` }} />
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-3">
                          <div className="rounded-xl bg-white/10 px-3 py-2">
                            <p className="text-xs text-white/70">Payé ({paidPct}%)</p>
                            <p className="font-bold tabular-nums">{currency(paid)}</p>
                          </div>
                          <div className={`rounded-xl px-3 py-2 ${due > 0 ? 'bg-red-500/25' : 'bg-emerald-500/25'}`}>
                            <p className="text-xs text-white/70">{due > 0 ? 'Reste dû' : 'Soldée'}</p>
                            <p className="font-bold tabular-nums">{currency(Math.max(0, due))}</p>
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  <DocumentSignatureSection
                    docType="invoice"
                    docId={detailSale.id}
                    docLabel={isDraft ? 'le devis' : 'la facture'}
                    amount={detailSale.total}
                    isAdmin={isAdmin}
                    cancelled={isCancelled}
                  />

                  {detailPayments.length > 0 && (
                    <DetailList title={`Paiements (${detailPayments.length})`}>
                      {detailPayments.map((p) => {
                        const refund = Number(p.amount) < 0
                        return (
                          <DetailRow
                            key={p.id}
                            tone={refund ? 'red' : 'emerald'}
                            label={
                              <span>
                                <span className="font-semibold text-brand-900 dark:text-gray-100">{refund ? 'Remboursement' : PAYMENT_METHOD_LABELS[p.method] || p.method}</span>
                                {p.reference && !refund && <span className="text-gray-500"> · Réf {p.reference}</span>}
                                <span className="block text-xs text-gray-500">{new Date(p.created_at).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                                {p.notes && !refund && <span className="block text-xs text-gray-500">{p.notes}</span>}
                              </span>
                            }
                          >
                            {currency(p.amount)}
                          </DetailRow>
                        )
                      })}
                    </DetailList>
                  )}
                </div>
              </div>

              {!isDraft && !detailSale.clients?.phone && !isCancelled && (
                <p className="text-xs text-amber-600 dark:text-amber-400">Ce client n'a pas de numéro WhatsApp enregistré.</p>
              )}

              {/* ---- Actions (pied collant) ---- */}
              <div className="sticky -bottom-5 sm:-bottom-6 -mx-5 sm:-mx-6 -mb-5 sm:-mb-6 px-5 sm:px-6 py-4 bg-white/95 dark:bg-darkcard/95 backdrop-blur border-t border-gray-200 dark:border-white/[0.08] flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2.5">
                <div className="flex flex-wrap gap-2">
                  <button className="btn-secondary !rounded-2xl" onClick={() => downloadInvoicePDF(detailSale)}>
                    <Download size={16} /> PDF
                  </button>
                  {!isDraft && (
                    <button className="btn-secondary !rounded-2xl" disabled={!detailSale.clients?.phone} onClick={() => sendInvoiceViaWhatsApp(detailSale)}>
                      <MessageCircle size={16} /> WhatsApp
                    </button>
                  )}
                  {!isDraft && detailSale.delivery_status !== 'livree' && !isCancelled && (
                    <button className="btn-secondary !rounded-2xl" onClick={() => { const sale = detailSale; setDetailSale(null); setDeliverySale(sale) }}>
                      <Truck size={16} /> Livraisons
                    </button>
                  )}
                  {canEditSale(detailSale) && (
                    <button className="btn-secondary !rounded-2xl" onClick={() => { const sale = detailSale; setDetailSale(null); openEditSale(sale) }}>
                      <Pencil size={16} /> {isDraft ? 'Modifier le devis' : 'Modifier'}
                    </button>
                  )}
                  {isDraft && isAdmin && (
                    <button className="btn-secondary !rounded-2xl" onClick={() => { setDetailSale(null); setConfirmCancel(detailSale) }}>
                      Annuler le devis
                    </button>
                  )}
                </div>
                {isDraft ? (
                  <button
                    className="btn-cta"
                    onClick={() => confirmQuote.mutateAsync({ saleId: detailSale.id, userId: user?.id }).then(() => setDetailSale(null)).catch(() => {})}
                    disabled={confirmQuote.isPending}
                  >
                    <Check size={18} strokeWidth={2.75} /> Confirmer le devis
                  </button>
                ) : (
                  !isCancelled && due > 0 && (
                    <button
                      className="btn-cta"
                      onClick={() => { const sale = detailSale; setDetailSale(null); setPaymentOpen(sale); setPaymentAmount(''); setPaymentMethod('especes'); setPaymentError('') }}
                    >
                      <CreditCard size={18} /> Enregistrer un paiement
                    </button>
                  )
                )}
              </div>
            </div>
          )
        })()}
      </Modal>

      {/* ---- Modal: paiement d'une facture (avance / crédit) ---- */}
      <Modal
        open={!!paymentOpen}
        onClose={() => setPaymentOpen(null)}
        icon={CreditCard}
        title="Enregistrer un paiement"
        subtitle={paymentOpen ? `Facture ${paymentOpen.invoice_number}` : ''}
        maxWidth="max-w-xl"
      >
        {paymentOpen && (() => {
          const total = Number(paymentOpen.total || 0)
          const alreadyPaid = Number(paymentOpen.amount_paid || 0)
          const due = total - alreadyPaid
          const amount = Number(paymentAmount || 0)
          const afterPayment = Math.max(0, due - amount)
          const tooMuch = amount > due
          const methods = [
            { value: 'especes', label: 'Espèces', icon: Banknote, tone: 'text-emerald-600 dark:text-emerald-400' },
            { value: 'orange_money', label: 'Orange Money', icon: Smartphone, tone: 'text-orange-500' },
            { value: 'wave', label: 'Wave', icon: Waves, tone: 'text-sky-500' },
            ...(depositOf(paymentOpen?.client_id) > 0 ? [{ value: 'depot', label: 'Dépôt client', icon: PiggyBank, tone: 'text-violet-500' }] : []),
            { value: 'autre', label: 'Autre', icon: Landmark, tone: 'text-gray-500 dark:text-gray-300' },
          ]
          const currentMethod = ['especes', 'orange_money', 'wave', 'depot'].includes(paymentMethod) ? paymentMethod : 'autre'
          return (
            <form onSubmit={handleAddPayment} className="space-y-5">
              {/* Récapitulatif : client + montants */}
              <div className="rounded-2xl bg-gradient-to-br from-[#1a3f95] to-[#0d2550] text-white p-4 shadow-[0_14px_30px_-14px_rgba(19,48,111,0.7)]">
                <div className="flex items-center gap-3">
                  <ClientAvatar name={paymentOpen.clients?.name} />
                  <div className="min-w-0">
                    <p className="font-bold uppercase truncate">{paymentOpen.clients?.name || 'Client comptoir'}</p>
                    {paymentOpen.clients?.phone && <p className="text-xs text-white/70">{paymentOpen.clients.phone}</p>}
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl bg-white/10 px-2 py-2">
                    <p className="text-[11px] text-white/70">Total</p>
                    <p className="text-sm font-bold tabular-nums">{currency(total)}</p>
                  </div>
                  <div className="rounded-xl bg-white/10 px-2 py-2">
                    <p className="text-[11px] text-white/70">Déjà payé</p>
                    <p className="text-sm font-bold tabular-nums">{currency(alreadyPaid)}</p>
                  </div>
                  <div className="rounded-xl bg-red-500/30 px-2 py-2">
                    <p className="text-[11px] text-white/80">Reste dû</p>
                    <p className="text-sm font-extrabold tabular-nums">{currency(due)}</p>
                  </div>
                </div>
              </div>

              {/* Montant */}
              <div>
                <label className="label" htmlFor="pay-amount">Montant reçu</label>
                <div className="relative">
                  <input
                    id="pay-amount"
                    type="number"
                    inputMode="numeric"
                    min="1"
                    max={due}
                    required
                    autoFocus
                    className={`input !rounded-2xl !py-3.5 pr-20 text-2xl font-extrabold tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${tooMuch ? '!border-red-400 focus:!ring-red-500/30' : ''}`}
                    placeholder="0"
                    value={paymentAmount}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                  />
                  <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400">FCFA</span>
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <button type="button" className="rounded-full border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-brand-900 dark:text-gray-200 hover:border-blue-300 hover:bg-blue-50 dark:hover:bg-white/[0.08]" onClick={() => setPaymentAmount(String(due))}>
                    Tout solder · {currency(due)}
                  </button>
                  {due > 1 && (
                    <button type="button" className="rounded-full border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-brand-900 dark:text-gray-200 hover:border-blue-300 hover:bg-blue-50 dark:hover:bg-white/[0.08]" onClick={() => setPaymentAmount(String(Math.round(due / 2)))}>
                      Moitié · {currency(Math.round(due / 2))}
                    </button>
                  )}
                  {paymentAmount !== '' && amount > 0 && (
                    <span className={`ml-auto rounded-full px-3 py-1.5 text-xs font-semibold tabular-nums ${
                      tooMuch
                        ? 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400'
                        : afterPayment === 0
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
                          : 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400'
                    }`}>
                      {tooMuch ? `Dépasse le reste dû de ${currency(amount - due)}` : afterPayment === 0 ? 'La facture sera soldée' : `Il restera ${currency(afterPayment)}`}
                    </span>
                  )}
                </div>
              </div>

              {/* Mode de paiement */}
              <div>
                <p className="label">Mode de paiement</p>
                <div role="radiogroup" aria-label="Mode de paiement" className="grid grid-cols-2 sm:grid-cols-[repeat(auto-fit,minmax(96px,1fr))] gap-2">
                  {methods.map((m) => {
                    const active = currentMethod === m.value
                    const MethodIcon = m.icon
                    return (
                      <button
                        key={m.value}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => setPaymentMethod(m.value === 'autre' ? 'virement' : m.value)}
                        className={`flex flex-col items-center justify-center gap-1.5 rounded-2xl border px-2 py-3 text-xs font-semibold transition-all ${
                          active
                            ? 'border-[#13306f] bg-[#13306f] text-white shadow-sm dark:border-[#1d4fb8] dark:bg-[#1d4fb8]'
                            : 'border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.03] text-brand-900 dark:text-gray-200 hover:border-blue-300 hover:bg-blue-50/50 dark:hover:bg-white/[0.06]'
                        }`}
                      >
                        <MethodIcon size={20} className={active ? 'text-white' : m.tone} />
                        <span className="text-center leading-tight">{m.label}</span>
                      </button>
                    )
                  })}
                </div>
                {paymentMethod === 'depot' && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    Payé avec l’argent déposé par le client — disponible : <strong className="tabular-nums">{currency(depositOf(paymentOpen?.client_id))}</strong>
                  </p>
                )}
                {currentMethod === 'autre' && (
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
                  <input id="pay-notes" className="input" value={paymentNotes} onChange={(e) => setPaymentNotes(e.target.value)} placeholder="Ex. : acompte" />
                </div>
              </div>

              {paymentError && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{paymentError}</p>}

              <div className="sticky -bottom-5 sm:-bottom-6 -mx-5 sm:-mx-6 -mb-5 sm:-mb-6 px-5 sm:px-6 py-4 bg-white/95 dark:bg-darkcard/95 backdrop-blur border-t border-gray-200 dark:border-white/[0.08] flex gap-3">
                <button type="button" className="btn-secondary !rounded-2xl !px-5" onClick={() => setPaymentOpen(null)}>Annuler</button>
                <button type="submit" className="btn-cta flex-1" disabled={addPayment.isPending || tooMuch}>
                  <Check size={18} strokeWidth={2.75} />
                  {addPayment.isPending ? 'Enregistrement...' : amount > 0 && !tooMuch ? `Encaisser ${currency(amount)}` : 'Confirmer le paiement'}
                </button>
              </div>
            </form>
          )
        })()}
      </Modal>

      {/* ---- Modal: reçu de paiement ---- */}
      <Modal open={!!lastReceipt} onClose={() => setLastReceipt(null)} icon={Receipt} title="Reçu de paiement">
        {lastReceipt && (
          <div className="space-y-3">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Paiement enregistré pour la facture <strong>{lastReceipt.invoiceNumber}</strong> — reçu <strong>{lastReceipt.receiptNumber}</strong>
            </p>
            <DocumentSignatureSection
              docType="payment_receipt"
              docId={lastReceipt.receiptNumber}
              amount={lastReceipt.amount}
              isAdmin={isAdmin}
            />
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
      <Modal open={!!initialReceipt} onClose={() => setInitialReceipt(null)} icon={Receipt} title="Reçu de paiement">
        {initialReceipt && (
          <div className="space-y-3">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Avance enregistrée pour la facture <strong>{initialReceipt.invoiceNumber}</strong> — reçu <strong>{initialReceipt.receiptNumber}</strong>
            </p>
            <DocumentSignatureSection
              docType="payment_receipt"
              docId={initialReceipt.receiptNumber}
              amount={initialReceipt.amount}
              isAdmin={isAdmin}
            />
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
