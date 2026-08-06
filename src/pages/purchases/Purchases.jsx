import { useEffect, useState, useMemo } from 'react'
import { Plus, Trash2, Pencil, Truck, Search, PackagePlus, Wallet, RotateCcw, CreditCard, Eye } from 'lucide-react'
import { useProducts } from '../../hooks/useProducts'
import { useSuppliers } from '../../hooks/useEntities'
import { usePurchases, useCreatePurchase, useAddPurchasePayment, useCancelPurchase, useUpdatePurchase, useUpdatePurchaseItems, useDeletePurchase } from '../../hooks/usePurchases'
import { useAuth } from '../../context/AuthContext'
import Pagination from '../../components/Pagination'
import Modal from '../../components/Modal'
import ConfirmDialog from '../../components/ConfirmDialog'
import { currency } from '../../lib/constants'

// --- Helpers d'affichage ---

function formatRelativeDate(dateStr) {
  const date = new Date(dateStr)
  const now = new Date()
  const isSameDay = date.toDateString() === now.toDateString()
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  const isYesterday = date.toDateString() === yesterday.toDateString()
  const time = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

  if (isSameDay) return `Aujourd'hui, ${time}`
  if (isYesterday) return `Hier, ${time}`
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) + `, ${time}`
}

function StatusBadge({ status }) {
  const map = {
    payee: { label: 'Payé', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' },
    partielle: { label: 'Partiel', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400' },
    credit: { label: 'À crédit', cls: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400' },
    annulee: { label: 'Annulé', cls: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400' },
  }
  const s = map[status] || map.credit
  return <span className={`badge ${s.cls}`}>{s.label}</span>
}

function ActionButton({ icon: Icon, title, onClick, disabled, tone = 'gray' }) {
  const tones = {
    gray: 'text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200',
    emerald: 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10',
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

export default function Purchases() {
  const { user, isAdmin } = useAuth()
  const { data: products = [] } = useProducts()
  const { data: suppliers = [] } = useSuppliers()
const { data: purchases = [], isLoading } = usePurchases()
  const createPurchase = useCreatePurchase()
  const addPayment = useAddPurchasePayment()
  const cancelPurchase = useCancelPurchase()
  const updatePurchase = useUpdatePurchase()
  const updatePurchaseItems = useUpdatePurchaseItems()
  const deletePurchase = useDeletePurchase()

  const [newPurchaseOpen, setNewPurchaseOpen] = useState(false)
  const [detailPurchase, setDetailPurchase] = useState(null)
  const [editPurchase, setEditPurchase] = useState(null)
  const [editSupplierId, setEditSupplierId] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editPurchaseItems, setEditPurchaseItems] = useState([])
  const [editProductToAdd, setEditProductToAdd] = useState('')
  const [confirmCancel, setConfirmCancel] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [paymentOpen, setPaymentOpen] = useState(null) // purchase being paid
  const [paymentAmount, setPaymentAmount] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 10

  // --- Form state for new purchase ---
  const [supplierId, setSupplierId] = useState('')
  const [amountPaid, setAmountPaid] = useState(0)
  const [notes, setNotes] = useState('')
  const [cart, setCart] = useState([]) // {product_id, product_name, quantity, unit_cost}
  const [productToAdd, setProductToAdd] = useState('')
  const [error, setError] = useState('')
  const [paymentError, setPaymentError] = useState('')

  const resetForm = () => {
    setSupplierId('')
    setAmountPaid(0)
    setNotes('')
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
      setCart((c) => [...c, { product_id: product.id, product_name: product.name, quantity: 1, unit_cost: product.purchase_price || 0 }])
    }
    setProductToAdd('')
  }

  const updateCartField = (productId, field, value) => {
    setCart((c) => c.map((item) => (item.product_id === productId ? { ...item, [field]: value } : item)))
  }

  const removeFromCart = (productId) => {
    setCart((c) => c.filter((item) => item.product_id !== productId))
  }

  const subtotal = useMemo(
    () => cart.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unit_cost) || 0), 0),
    [cart]
  )

  const handleCreatePurchase = async (e) => {
    e.preventDefault()
    setError('')
    if (!supplierId) {
      setError('Sélectionnez un fournisseur.')
      return
    }
    if (cart.length === 0) {
      setError('Ajoutez au moins un produit à cet achat.')
      return
    }
    if (Number(amountPaid || 0) > subtotal) {
      setError('Le montant payé ne peut pas dépasser le total de l’achat.')
      return
    }
    try {
      await createPurchase.mutateAsync({
        supplierId,
        userId: user?.id,
        amountPaid: Number(amountPaid) || 0,
        notes,
        items: cart.map((c) => ({
          product_id: c.product_id,
          product_name: c.product_name,
          quantity: Number(c.quantity),
          unit_cost: Number(c.unit_cost),
        })),
      })
      setNewPurchaseOpen(false)
      resetForm()
    } catch (err) {
      setError(err.message)
    }
  }

  const handleCancelPurchase = async () => {
    await cancelPurchase.mutateAsync({ purchaseId: confirmCancel.id, userId: user?.id })
    setConfirmCancel(null)
    if (detailPurchase?.id === confirmCancel.id) setDetailPurchase(null)
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
      await addPayment.mutateAsync({ purchaseId: paymentOpen.id, amount: Number(paymentAmount) })
      setPaymentOpen(null)
      setPaymentAmount('')
    } catch (err) {
      setPaymentError(err.message)
    }
  }

  const filtered = purchases.filter((p) => {
    const q = search.toLowerCase()
    return (
      p.purchase_number.toLowerCase().includes(q) ||
      (p.supplier_name || p.suppliers?.name || '').toLowerCase().includes(q) ||
      (p.purchase_items || []).some((it) => it.product_name.toLowerCase().includes(q))
    )
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize)

  const totalDette = purchases
    .filter((p) => p.status !== 'annulee')
    .reduce((sum, p) => sum + (Number(p.total) - Number(p.amount_paid)), 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Achats fournisseurs</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            Enregistrez vos approvisionnements : le stock est mis à jour automatiquement.
          </p>
        </div>
        <button className="btn-primary" onClick={() => setNewPurchaseOpen(true)}>
          <Plus size={16} /> Nouvel achat
        </button>
      </div>

      {totalDette > 0 && (
        <div className="card p-4 bg-red-50/60 dark:bg-red-500/10 border-red-200 dark:border-red-500/30 flex items-center gap-2.5">
          <Wallet size={18} className="text-red-600 dark:text-red-400 shrink-0" />
          <p className="text-sm font-semibold text-red-700 dark:text-red-400">
            Dette totale envers vos fournisseurs : {currency(totalDette)}
          </p>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="input pl-9"
            placeholder="Rechercher un fournisseur, un produit, un N° d'achat..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          />
        </div>
        {!isLoading && (
          <p className="text-xs text-gray-400 sm:ml-auto">
            {filtered.length} achat{filtered.length > 1 ? 's' : ''}{search && ` correspondant à "${search}"`}
          </p>
        )}
      </div>

      {isLoading ? (
        <div className="card p-4 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-2 animate-pulse">
              <div className="h-8 w-8 rounded-full bg-gray-100 dark:bg-gray-800" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-1/4 rounded bg-gray-100 dark:bg-gray-800" />
                <div className="h-2.5 w-1/3 rounded bg-gray-100 dark:bg-gray-800" />
              </div>
              <div className="h-3 w-16 rounded bg-gray-100 dark:bg-gray-800" />
            </div>
          ))}
        </div>
      ) : purchases.length === 0 ? (
        <div className="card p-12 flex flex-col items-center text-center gap-3">
          <div className="h-12 w-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400">
            <PackagePlus size={20} />
          </div>
          <div>
            <p className="font-medium">Aucun achat enregistré</p>
            <p className="text-sm text-gray-400 mt-0.5">Enregistrez votre premier approvisionnement fournisseur.</p>
          </div>
          <button className="btn-primary mt-1" onClick={() => setNewPurchaseOpen(true)}>
            <Plus size={16} /> Nouvel achat
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 flex flex-col items-center text-center gap-2">
          <div className="h-12 w-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400">
            <Search size={20} />
          </div>
          <p className="font-medium">Aucun achat ne correspond à "{search}"</p>
        </div>
      ) : (
        <>
          {/* ---- Tableau (desktop) ---- */}
          <div className="card hidden md:block overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700/60 bg-gray-50/60 dark:bg-gray-800/40">
                    <th className="table-th">N° achat</th>
                    <th className="table-th">Fournisseur</th>
                    <th className="table-th">Date</th>
                    <th className="table-th text-right">Total</th>
                    <th className="table-th text-right">Reste dû</th>
                    <th className="table-th">Statut</th>
                    <th className="table-th text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {paginated.map((p) => {
                    const due = Number(p.total) - Number(p.amount_paid)
                    return (
                      <tr
                        key={p.id}
                        className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors cursor-pointer"
                        onClick={() => setDetailPurchase(p)}
                      >
                        <td className="table-td font-mono text-xs">{p.purchase_number}</td>
                        <td className="table-td">
                          <div className="flex items-center gap-2">
                            <Truck size={14} className="text-gray-400 shrink-0" />
                            <span className="font-medium truncate max-w-[160px]">{p.supplier_name || p.suppliers?.name || '—'}</span>
                          </div>
                        </td>
                        <td className="table-td text-gray-500 dark:text-gray-400 whitespace-nowrap">{formatRelativeDate(p.created_at)}</td>
                        <td className="table-td text-right font-semibold tabular-nums">{currency(p.total)}</td>
                        <td className="table-td text-right tabular-nums">
                          {due > 0 ? <span className="text-red-500 font-medium">{currency(due)}</span> : <span className="text-gray-400">—</span>}
                        </td>
                        <td className="table-td"><StatusBadge status={p.status} /></td>
                        <td className="table-td">
                          <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                            <ActionButton icon={Eye} title="Voir le détail" onClick={() => setDetailPurchase(p)} />
                            {p.status !== 'annulee' && due > 0 && (
                              <ActionButton icon={CreditCard} title="Enregistrer un paiement" tone="emerald" onClick={() => { setPaymentOpen(p); setPaymentAmount(''); setPaymentError('') }} />
                            )}
                            {isAdmin && p.status !== 'annulee' && (
                              <ActionButton icon={RotateCcw} title="Annuler" tone="red" onClick={() => setConfirmCancel(p)} />
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
            {paginated.map((p) => {
              const due = Number(p.total) - Number(p.amount_paid)
              return (
                <div key={p.id} className="card p-4" onClick={() => setDetailPurchase(p)}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="h-9 w-9 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400 shrink-0">
                        <Truck size={15} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{p.supplier_name || p.suppliers?.name || '—'}</p>
                        <span className="inline-block mt-0.5 font-mono text-[11px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500">
                          {p.purchase_number}
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-semibold tabular-nums">{currency(p.total)}</span>
                      {due > 0 && <p className="text-[10px] font-semibold text-red-500 mt-0.5">Dû : {currency(due)}</p>}
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">{formatRelativeDate(p.created_at)}</span>
                      <StatusBadge status={p.status} />
                    </div>
                    <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                      <ActionButton icon={Eye} title="Voir" onClick={() => setDetailPurchase(p)} />
                      {p.status !== 'annulee' && due > 0 && (
                        <ActionButton icon={CreditCard} title="Payer" tone="emerald" onClick={() => { setPaymentOpen(p); setPaymentAmount(''); setPaymentError('') }} />
                      )}
                      {isAdmin && p.status !== 'annulee' && (
                        <ActionButton icon={RotateCcw} title="Annuler" tone="red" onClick={() => setConfirmCancel(p)} />
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

      {/* ---- Modal: nouvel achat ---- */}
      <Modal open={newPurchaseOpen} onClose={() => setNewPurchaseOpen(false)} title="Nouvel achat fournisseur" maxWidth="max-w-2xl">
        <form onSubmit={handleCreatePurchase} className="space-y-4">
          {error && <div className="text-sm text-red-600 bg-red-50 dark:bg-red-500/10 rounded-lg px-3 py-2">{error}</div>}

          <div>
            <label className="label">Fournisseur</label>
            <select required className="input" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
              <option value="">Sélectionner un fournisseur...</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}{s.phone ? ` — ${s.phone}` : ''}</option>
              ))}
            </select>
            {suppliers.length === 0 && (
              <p className="text-xs text-amber-500 mt-1">Ajoutez d'abord un fournisseur dans la page Fournisseurs.</p>
            )}
          </div>

          <div className="flex gap-2">
            <select className="input" value={productToAdd} onChange={(e) => setProductToAdd(e.target.value)}>
              <option value="">Sélectionner un produit...</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name} — prix d'achat actuel {currency(p.purchase_price)}</option>
              ))}
            </select>
            <button type="button" className="btn-secondary shrink-0" onClick={addProduct}>
              <Plus size={16} /> Ajouter
            </button>
          </div>

          {cart.length > 0 && (
            <div className="border border-gray-200 dark:border-gray-700/60 rounded-lg divide-y divide-gray-100 dark:divide-gray-800">
              {cart.map((item) => (
                <div key={item.product_id} className="flex items-center gap-2 p-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.product_name}</p>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-[10px] text-gray-400">Qté</span>
                    <input
                      type="number"
                      min="1"
                      className="input w-16 text-center !py-1"
                      value={item.quantity}
                      onChange={(e) => updateCartField(item.product_id, 'quantity', Math.max(1, Number(e.target.value)))}
                    />
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-[10px] text-gray-400">Coût unitaire</span>
                    <input
                      type="number"
                      min="0"
                      className="input w-24 text-center !py-1"
                      value={item.unit_cost}
                      onChange={(e) => updateCartField(item.product_id, 'unit_cost', Math.max(0, Number(e.target.value)))}
                    />
                  </div>
                  <p className="w-24 text-right text-sm font-semibold shrink-0">{currency(item.quantity * item.unit_cost)}</p>
                  <button type="button" className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg shrink-0" onClick={() => removeFromCart(item.product_id)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Montant payé maintenant (FCFA)</label>
              <input type="number" min="0" max={subtotal} className="input" value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)} />
              <p className="text-xs text-gray-400 mt-1">Laissez 0 si c'est un achat entièrement à crédit.</p>
            </div>
            <div>
              <label className="label">Notes (optionnel)</label>
              <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Référence bon de livraison..." />
            </div>
          </div>

          <div className="border-t border-gray-200 dark:border-gray-700/60 pt-3 space-y-1">
            <div className="flex justify-between text-lg font-bold"><span>Total achat</span><span>{currency(subtotal)}</span></div>
            <div className="flex justify-between text-sm text-gray-500">
              <span>Reste à payer (dette)</span>
              <span className={Number(amountPaid || 0) < subtotal ? 'text-red-500 font-medium' : ''}>
                {currency(Math.max(0, subtotal - Number(amountPaid || 0)))}
              </span>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setNewPurchaseOpen(false)}>Annuler</button>
            <button type="submit" className="btn-primary" disabled={createPurchase.isPending}>
              <PackagePlus size={16} /> {createPurchase.isPending ? 'Enregistrement...' : "Enregistrer l'achat"}
            </button>
          </div>
        </form>
      </Modal>

      {/* ---- Modal: détail achat ---- */}
      <Modal open={!!detailPurchase} onClose={() => setDetailPurchase(null)} title={`Achat ${detailPurchase?.purchase_number || ''}`} maxWidth="max-w-lg">
        {detailPurchase && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400 shrink-0">
                <Truck size={16} />
              </div>
              <div>
                <p className="text-sm font-medium">{detailPurchase.supplier_name || detailPurchase.suppliers?.name}</p>
                <p className="text-xs text-gray-400">{new Date(detailPurchase.created_at).toLocaleString('fr-FR')}</p>
              </div>
              <div className="ml-auto"><StatusBadge status={detailPurchase.status} /></div>
            </div>

            <div className="border border-gray-200 dark:border-gray-700/60 rounded-lg divide-y divide-gray-100 dark:divide-gray-800">
              {detailPurchase.purchase_items?.map((item) => (
                <div key={item.id} className="flex justify-between p-3 text-sm">
                  <span>{item.product_name} × {item.quantity} <span className="text-gray-400">({currency(item.unit_cost)}/unité)</span></span>
                  <span className="font-medium tabular-nums">{currency(item.line_total)}</span>
                </div>
              ))}
            </div>

            {detailPurchase.notes && <p className="text-xs text-gray-500 dark:text-gray-400 italic">{detailPurchase.notes}</p>}

            <div className="space-y-1">
              <div className="flex justify-between text-sm text-gray-500"><span>Total</span><span>{currency(detailPurchase.total)}</span></div>
              <div className="flex justify-between text-sm text-gray-500"><span>Payé</span><span>{currency(detailPurchase.amount_paid)}</span></div>
              <div className="flex justify-between text-lg font-bold">
                <span>Reste dû</span>
                <span className={Number(detailPurchase.total) - Number(detailPurchase.amount_paid) > 0 ? 'text-red-500' : ''}>
                  {currency(Number(detailPurchase.total) - Number(detailPurchase.amount_paid))}
                </span>
              </div>
            </div>

            {detailPurchase.status === 'annulee' && (
              <p className="text-xs text-red-500 text-center font-medium">Achat annulé - stock retiré.</p>
            )}

            {detailPurchase.status !== 'annulee' && Number(detailPurchase.total) - Number(detailPurchase.amount_paid) > 0 && (
              <button
                className="btn-success w-full"
                onClick={() => { setPaymentOpen(detailPurchase); setPaymentAmount(''); setPaymentError('') }}
              >
                <CreditCard size={15} /> Enregistrer un paiement
              </button>
            )}
          </div>
        )}
      </Modal>

      {/* ---- Modal: paiement ---- */}
      <Modal open={!!paymentOpen} onClose={() => setPaymentOpen(null)} title="Enregistrer un paiement">
        {paymentOpen && (
          <form onSubmit={handleAddPayment} className="space-y-4">
            {paymentError && <div className="text-sm text-red-600 bg-red-50 dark:bg-red-500/10 rounded-lg px-3 py-2">{paymentError}</div>}
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Fournisseur <strong>{paymentOpen.supplier_name || paymentOpen.suppliers?.name}</strong> — solde dû :{' '}
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
        onConfirm={handleCancelPurchase}
        loading={cancelPurchase.isPending}
        message={`Annuler l'achat "${confirmCancel?.purchase_number}" ? Les quantités seront retirées du stock.`}
      />
    </div>
  )
}
