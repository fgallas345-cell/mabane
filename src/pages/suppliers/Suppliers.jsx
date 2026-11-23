import { useEffect, useMemo, useState } from 'react'
import PageHeader, { PanelTitle, InfoChip } from '../../components/PageHeader'
import StatCard from '../../components/StatCard'
import { Plus, Pencil, Trash2, Search, Phone, Truck, Mail, MapPin, User, Package, Wallet, StickyNote, History, CreditCard, Building2, Handshake, ShoppingBasket } from 'lucide-react'
import { useSuppliers } from '../../hooks/useEntities'
import { useProducts } from '../../hooks/useProducts'
import { usePurchases, useAddPurchasePayment } from '../../hooks/usePurchases'
import { useToast } from '../../context/ToastContext'
import { supabase } from '../../lib/supabase'
import Modal from '../../components/Modal'
import ConfirmDialog from '../../components/ConfirmDialog'
import Pagination from '../../components/Pagination'
import { currency } from '../../lib/constants'
import { formatQty } from '../../utils/quantity'

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

const emptyForm = { name: '', phone: '', email: '', address: '', contact_person: '', payment_terms: '', notes: '' }

// --- Helpers d'affichage ---

const ICON_PALETTE = [
  { bg: 'bg-blue-50 dark:bg-blue-500/10', text: 'text-blue-600 dark:text-blue-400', ring: 'group-hover:ring-blue-200 dark:group-hover:ring-blue-500/30' },
  { bg: 'bg-emerald-50 dark:bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400', ring: 'group-hover:ring-emerald-200 dark:group-hover:ring-emerald-500/30' },
  { bg: 'bg-amber-50 dark:bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400', ring: 'group-hover:ring-amber-200 dark:group-hover:ring-amber-500/30' },
  { bg: 'bg-violet-50 dark:bg-violet-500/10', text: 'text-violet-600 dark:text-violet-400', ring: 'group-hover:ring-violet-200 dark:group-hover:ring-violet-500/30' },
  { bg: 'bg-cyan-50 dark:bg-cyan-500/10', text: 'text-cyan-600 dark:text-cyan-400', ring: 'group-hover:ring-cyan-200 dark:group-hover:ring-cyan-500/30' },
  { bg: 'bg-rose-50 dark:bg-rose-500/10', text: 'text-rose-600 dark:text-rose-400', ring: 'group-hover:ring-rose-200 dark:group-hover:ring-rose-500/30' },
]

function hashString(str) {
  let hash = 0
  for (let i = 0; i < str.length; i++) hash = (hash << 5) - hash + str.charCodeAt(i)
  return Math.abs(hash)
}

function InfoRow({ icon: Icon, children }) {
  return (
    <p className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
      <Icon size={13} className="shrink-0 text-gray-400" /> <span className="truncate">{children}</span>
    </p>
  )
}

export default function Suppliers() {
  const { data: suppliers = [], isLoading, createItem, updateItem, deleteItem, invalidate } = useSuppliers()
  const { data: products = [] } = useProducts()
  const { data: purchases = [] } = usePurchases()
  const toast = useToast()
  const addPayment = useAddPurchasePayment()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [selectedProductIds, setSelectedProductIds] = useState([])
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [historySupplier, setHistorySupplier] = useState(null)
  const [payingPurchase, setPayingPurchase] = useState(null)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentError, setPaymentError] = useState('')
  const pageSize = 9

  const overview = useMemo(() => {
    const start = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    const valid = purchases.filter((pu) => pu.status !== 'annulee')
    const month = valid.filter((pu) => new Date(pu.created_at) >= start)
    const debtBySupplier = new Map()
    valid.forEach((pu) => {
      const due = Number(pu.total) - Number(pu.amount_paid)
      if (due > 0 && pu.supplier_id) debtBySupplier.set(pu.supplier_id, (debtBySupplier.get(pu.supplier_id) || 0) + due)
    })
    return {
      withProducts: suppliers.filter((s) => (s.supplier_products || []).length > 0).length,
      linkedProducts: new Set(suppliers.flatMap((s) => (s.supplier_products || []).map((sp) => sp.product_id))).size,
      monthTotal: month.reduce((sum, pu) => sum + Number(pu.total || 0), 0),
      monthSuppliers: new Set(month.map((pu) => pu.supplier_id || pu.supplier_name)).size,
      debt: valid.reduce((sum, pu) => sum + Math.max(0, Number(pu.total) - Number(pu.amount_paid)), 0),
      debtors: debtBySupplier.size,
    }
  }, [suppliers, purchases])

  const supplierStats = (supplierId) => {
    const list = purchases.filter((p) => p.supplier_id === supplierId)
    const active = list.filter((p) => p.status !== 'annulee')
    const totalAchats = active.reduce((sum, p) => sum + Number(p.total), 0)
    const dette = active.reduce((sum, p) => sum + (Number(p.total) - Number(p.amount_paid)), 0)
    return { list, totalAchats, dette }
  }

  const handleAddPayment = async (e) => {
    e.preventDefault()
    setPaymentError('')
    const due = payingPurchase.total - payingPurchase.amount_paid
    if (!paymentAmount || Number(paymentAmount) <= 0) {
      const message = 'Entrez un montant valide.'
      setPaymentError(message)
      toast.error(message)
      return
    }
    if (Number(paymentAmount) > due) {
      const message = `Le paiement dépasse le solde dû (${currency(due)}).`
      setPaymentError(message)
      toast.error(message)
      return
    }
    try {
      await addPayment.mutateAsync({ purchaseId: payingPurchase.id, amount: Number(paymentAmount) })
      setPayingPurchase(null)
      setPaymentAmount('')
    } catch (err) {
      const message = err.message || 'Erreur lors de l’ajout du paiement.'
      setPaymentError(message)
      toast.error(message)
    }
  }

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setSelectedProductIds([])
    setError('')
    setModalOpen(true)
  }

  const openEdit = (s) => {
    setEditing(s)
    setForm({
      name: s.name,
      phone: s.phone || '',
      email: s.email || '',
      address: s.address || '',
      contact_person: s.contact_person || '',
      payment_terms: s.payment_terms || '',
      notes: s.notes || '',
    })
    setSelectedProductIds(
      (s.supplier_products || [])
        .map((item) => item.product_id)
        .filter(Boolean)
    )
    setError('')
    setModalOpen(true)
  }

  const syncSupplierProducts = async (supplierId, productIds) => {
    const currentIds = (editing?.supplier_products || []).map((item) => item.product_id).filter(Boolean)
    const deletedIds = currentIds.filter((id) => !productIds.includes(id))
    const addedIds = productIds.filter((id) => !currentIds.includes(id))

    if (deletedIds.length) {
      const { error } = await supabase
        .from('supplier_products')
        .delete()
        .eq('supplier_id', supplierId)
        .in('product_id', deletedIds)
      if (error) throw error
    }

    if (addedIds.length) {
      const inserts = addedIds.map((product_id) => ({ supplier_id: supplierId, product_id }))
      const { error } = await supabase.from('supplier_products').insert(inserts)
      if (error) throw error
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      const message = 'L’adresse email n’est pas valide.'
      setError(message)
      toast.error(message)
      return
    }

    try {
      const productNames = products
        .filter((p) => selectedProductIds.includes(p.id))
        .map((p) => p.name)
        .join(', ')

      const payload = {
        ...form,
        phone: form.phone || null,
        email: form.email || null,
        address: form.address || null,
        contact_person: form.contact_person || null,
        payment_terms: form.payment_terms || null,
        products_supplied: productNames,
        notes: form.notes || null,
      }

      if (editing) {
        const updatedSupplier = await updateItem.mutateAsync({ id: editing.id, ...payload })
        await syncSupplierProducts(updatedSupplier.id, selectedProductIds)
      } else {
        const newSupplier = await createItem.mutateAsync(payload)
        await syncSupplierProducts(newSupplier.id, selectedProductIds)
      }
      await invalidate()
      setModalOpen(false)
    } catch (err) {
      const message = err.message || 'Une erreur est survenue lors de l’enregistrement du fournisseur.'
      setError(message)
      toast.error(message)
    }
  }

  const handleDelete = async () => {
    try {
      await deleteItem.mutateAsync(confirmDelete.id)
      setConfirmDelete(null)
    } catch (err) {
      const message = err.message || 'Impossible de supprimer ce fournisseur.'
      setError(message)
      toast.error(message)
    }
  }

  const filtered = suppliers.filter((s) => {
    const query = search.toLowerCase()
    const productNames = (s.supplier_products || [])
      .map((item) => item.products?.name)
      .filter(Boolean)
      .join(', ')

    return (
      s.name.toLowerCase().includes(query) ||
      (s.phone || '').toLowerCase().includes(query) ||
      (s.email || '').toLowerCase().includes(query) ||
      (s.address || '').toLowerCase().includes(query) ||
      (productNames || s.products_supplied || '').toLowerCase().includes(query) ||
      (s.contact_person || '').toLowerCase().includes(query)
    )
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize)

  return (
    <div className="space-y-6">
      <PageHeader icon={Truck} badge={Handshake} title="Fournisseurs" subtitle="Gérez vos fournisseurs, contacts, conditions de paiement et produits fournis">
        <button className="btn-cta" onClick={openCreate}>
          <Plus size={18} strokeWidth={2.5} /> Nouveau fournisseur
        </button>
      </PageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard featured icon={Building2} label="Fournisseurs" value={suppliers.length} sub={`${overview.withProducts} avec produits associés`} />
        <StatCard icon={ShoppingBasket} color="brand" label="Achats ce mois" value={currency(overview.monthTotal)} sub={`${overview.monthSuppliers} fournisseur${overview.monthSuppliers > 1 ? 's' : ''} sollicité${overview.monthSuppliers > 1 ? 's' : ''}`} />
        <StatCard icon={Package} color="violet" label="Produits référencés" value={overview.linkedProducts} sub="liés à un fournisseur" />
        <StatCard icon={Wallet} color="red" label="Dette fournisseurs" value={currency(overview.debt)} sub={`${overview.debtors} fournisseur${overview.debtors > 1 ? 's' : ''} à régler`} />
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1">
          <Search size={18} className="search-icon" />
          <input
            className="search-field"
            placeholder="Rechercher par nom, contact, email, adresse ou produit..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
          />
        </div>
      </div>

      <section className="panel overflow-hidden">
        <PanelTitle icon={Truck} title="Liste des fournisseurs">
          {!isLoading && <InfoChip>{filtered.length === suppliers.length ? `${suppliers.length} fournisseur${suppliers.length > 1 ? 's' : ''} au total` : `${filtered.length} sur ${suppliers.length}`}</InfoChip>}
        </PanelTitle>
      {/* ---- État de chargement ---- */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 px-5 pb-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="border border-gray-200 dark:border-white/[0.08] rounded-xl p-4 space-y-3 animate-pulse">
              <div className="h-9 w-9 rounded-xl bg-gray-100 dark:bg-white/[0.06]" />
              <div className="h-3 w-2/3 rounded bg-gray-100 dark:bg-white/[0.06]" />
              <div className="h-2.5 w-1/2 rounded bg-gray-100 dark:bg-white/[0.06]" />
              <div className="h-2.5 w-full rounded bg-gray-100 dark:bg-white/[0.06]" />
              <div className="h-8 w-full rounded-xl bg-gray-100 dark:bg-white/[0.06] mt-2" />
            </div>
          ))}
        </div>
      ) : suppliers.length === 0 ? (
        <div className="p-12 border-t border-gray-100 dark:border-white/[0.06] flex flex-col items-center text-center gap-3">
          <div className="h-12 w-12 rounded-full bg-gray-100 dark:bg-white/[0.06] flex items-center justify-center text-gray-400">
            <Truck size={20} />
          </div>
          <div>
            <p className="font-medium">Aucun fournisseur enregistré</p>
            <p className="text-sm text-gray-400 mt-0.5">Ajoutez vos fournisseurs pour centraliser leurs contacts et conditions.</p>
          </div>
          <button className="btn-cta mt-1" onClick={openCreate}>
            <Plus size={16} /> Nouveau fournisseur
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-12 border-t border-gray-100 dark:border-white/[0.06] flex flex-col items-center text-center gap-2">
          <div className="h-12 w-12 rounded-full bg-gray-100 dark:bg-white/[0.06] flex items-center justify-center text-gray-400">
            <Search size={20} />
          </div>
          <p className="font-medium">Aucun fournisseur ne correspond à "{search}"</p>
          <p className="text-sm text-gray-400">Essayez un autre nom, contact ou produit.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 px-5 pb-5">
            {paginated.map((s) => {
              const palette = ICON_PALETTE[hashString(s.name) % ICON_PALETTE.length]
              const { list, totalAchats, dette } = supplierStats(s.id)
              return (
                <div
                  key={s.id}
                  className={`group border border-gray-200/80 dark:border-white/[0.08] rounded-2xl p-4 flex flex-col gap-3 bg-white dark:bg-white/[0.02] transition-all hover:shadow-lift hover:-translate-y-0.5 hover:border-blue-200 dark:hover:border-blue-500/40 ring-1 ring-transparent ${palette.ring}`}
                >
                  <div className="flex items-start gap-2.5">
                    <div className={`p-2 rounded-xl shrink-0 ${palette.bg} ${palette.text}`}>
                      <Truck size={16} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{s.name}</p>
                      {s.contact_person && (
                        <p className="text-xs text-gray-400 truncate flex items-center gap-1 mt-0.5">
                          <User size={11} /> {s.contact_person}
                        </p>
                      )}
                    </div>
                  </div>

                  {(s.phone || s.email || s.address) && (
                    <div className="space-y-1">
                      {s.phone && <InfoRow icon={Phone}>{s.phone}</InfoRow>}
                      {s.email && <InfoRow icon={Mail}>{s.email}</InfoRow>}
                      {s.address && <InfoRow icon={MapPin}>{s.address}</InfoRow>}
                    </div>
                  )}

                  <div className="border-t border-gray-100 dark:border-white/[0.06] pt-2.5 space-y-2">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 flex items-center gap-1 mb-0.5">
                        <Package size={11} /> Produits fournis
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2">
                        {((s.supplier_products || []).map((item) => item.products?.name).filter(Boolean).join(', ') || s.products_supplied) || (
                          <span className="italic text-gray-300 dark:text-gray-600">Aucun produit renseigné</span>
                        )}
                      </p>
                    </div>

                    {s.payment_terms && (
                      <div className="flex items-center gap-1.5">
                        <Wallet size={12} className="text-gray-400" />
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 dark:bg-white/[0.06] text-gray-600 dark:text-gray-300">
                          {s.payment_terms}
                        </span>
                      </div>
                    )}

                    {s.notes && (
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 flex items-center gap-1 mb-0.5">
                          <StickyNote size={11} /> Notes
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">{s.notes}</p>
                      </div>
                    )}
                  </div>

                  {list.length > 0 && (
                    <div className="border-t border-gray-100 dark:border-white/[0.06] pt-2.5 flex items-center justify-between text-xs">
                      <div>
                        <p className="text-gray-400">Total acheté</p>
                        <p className="font-semibold text-gray-700 dark:text-gray-200">{currency(totalAchats)}</p>
                      </div>
                      {dette > 0 && (
                        <div className="text-right">
                          <p className="text-gray-400">Dette</p>
                          <p className="font-semibold text-red-500">{currency(dette)}</p>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex gap-2 mt-auto pt-1">
                    <button className="btn-secondary flex-1 !py-1.5" onClick={() => openEdit(s)}>
                      <Pencil size={14} /> Modifier
                    </button>
                    {list.length > 0 && (
                      <button className="btn-secondary !py-1.5 !px-3" title="Historique des achats" onClick={() => setHistorySupplier(s)}>
                        <History size={14} />
                      </button>
                    )}
                    <button className="btn-danger !py-1.5 !px-3" title="Supprimer" onClick={() => setConfirmDelete(s)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} totalItems={filtered.length} pageSize={pageSize} itemLabel="fournisseurs" />
        </>
      )}
      </section>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} icon={Truck} title={editing ? 'Modifier le fournisseur' : 'Nouveau fournisseur'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="text-sm text-red-600 bg-red-50 dark:bg-red-500/10 rounded-xl px-3 py-2">{error}</div>
          )}

          <div>
            <label className="label">Nom</label>
            <input required className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="label">Responsable</label>
            <input className="input" value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} placeholder="Nom du contact" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Téléphone</label>
              <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div>
              <label className="label">Email</label>
              <input type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">Adresse</label>
            <input className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
          <div>
            <label className="label">Produits fournis</label>
            {products.length === 0 ? (
              <p className="text-sm text-gray-500">Ajoutez d'abord des produits dans le catalogue pour pouvoir les associer aux fournisseurs.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto rounded-xl border border-gray-200 dark:border-white/10 p-2">
                {products.map((product) => (
                  <label key={product.id} className="flex items-center gap-2 rounded-xl p-2 transition hover:bg-gray-50 dark:hover:bg-white/[0.06] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedProductIds.includes(product.id)}
                      onChange={() => {
                        setSelectedProductIds((prev) =>
                          prev.includes(product.id)
                            ? prev.filter((id) => id !== product.id)
                            : [...prev, product.id]
                        )
                      }}
                      className="h-4 w-4 rounded border-gray-300 text-[#1d4fb8] focus:ring-brand-500 dark:border-gray-600 dark:bg-white/[0.06]"
                    />
                    <span className="text-sm truncate">{product.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="label">Conditions de paiement</label>
            <input className="input" value={form.payment_terms} onChange={(e) => setForm({ ...form, payment_terms: e.target.value })} placeholder="Ex: 30 jours, paiement cash" />
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea className="input" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2.5 pt-4 mt-1 border-t border-gray-100 dark:border-white/[0.06]">
            <button type="button" className="btn-secondary" onClick={() => setModalOpen(false)}>Annuler</button>
            <button type="submit" className="btn-primary">{editing ? 'Enregistrer' : 'Créer'}</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
        loading={deleteItem.isPending}
        message={`Supprimer le fournisseur "${confirmDelete?.name}" ?`}
      />

      {/* ---- Modal: historique des achats du fournisseur ---- */}
      <Modal
        open={!!historySupplier}
        onClose={() => setHistorySupplier(null)}
        icon={History} title={`Historique — ${historySupplier?.name || ''}`}
        maxWidth="max-w-lg"
      >
        {historySupplier && (() => {
          const { list, totalAchats, dette } = supplierStats(historySupplier.id)
          return (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-sm bg-gray-50 dark:bg-white/[0.04] rounded-xl p-3">
                <div>
                  <p className="text-gray-400 text-xs">Total acheté</p>
                  <p className="font-semibold">{currency(totalAchats)}</p>
                </div>
                <div className="text-right">
                  <p className="text-gray-400 text-xs">Dette actuelle</p>
                  <p className={`font-semibold ${dette > 0 ? 'text-red-500' : ''}`}>{currency(dette)}</p>
                </div>
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {list.length === 0 && <p className="text-sm text-gray-400 text-center py-6">Aucun achat enregistré pour ce fournisseur.</p>}
                {list.map((p) => {
                  const due = Number(p.total) - Number(p.amount_paid)
                  return (
                    <div key={p.id} className="border border-gray-200 dark:border-white/[0.08] rounded-xl p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500 whitespace-nowrap">{p.purchase_number}</span>
                        <span className="text-xs text-gray-400">{formatDate(p.created_at)}</span>
                      </div>
                      <div className="mt-1.5 space-y-0.5">
                        {(p.purchase_items || []).map((it) => (
                          <p key={it.id} className="text-sm text-gray-600 dark:text-gray-300">
                            {it.product_name} × {formatQty(it.quantity)} <span className="text-gray-400">({currency(it.unit_cost)}/u)</span>
                          </p>
                        ))}
                      </div>
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100 dark:border-white/[0.06]">
                        <span className="text-sm font-semibold">{currency(p.total)}</span>
                        {p.status === 'annulee' ? (
                          <span className="text-xs font-medium text-gray-400">Annulé</span>
                        ) : due > 0 ? (
                          <button
                            className="text-xs font-medium text-[#1d4fb8] hover:underline flex items-center gap-1"
                            onClick={() => { setPayingPurchase(p); setPaymentAmount(''); setPaymentError('') }}
                          >
                            <CreditCard size={12} /> Payer {currency(due)}
                          </button>
                        ) : (
                          <span className="text-xs font-medium text-emerald-600">Payé</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })()}
      </Modal>

      {/* ---- Modal: paiement d'une dette fournisseur ---- */}
      <Modal open={!!payingPurchase} onClose={() => setPayingPurchase(null)} icon={CreditCard} title="Enregistrer un paiement">
        {payingPurchase && (
          <form onSubmit={handleAddPayment} className="space-y-4">
            {paymentError && <div className="text-sm text-red-600 bg-red-50 dark:bg-red-500/10 rounded-xl px-3 py-2">{paymentError}</div>}
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Achat <strong className="whitespace-nowrap">{payingPurchase.purchase_number}</strong> — solde dû :{' '}
              <span className="text-red-500 font-semibold">{currency(Number(payingPurchase.total) - Number(payingPurchase.amount_paid))}</span>
            </p>
            <div>
              <label className="label">Montant du paiement (FCFA)</label>
              <input
                type="number"
                min="1"
                max={Number(payingPurchase.total) - Number(payingPurchase.amount_paid)}
                required
                autoFocus
                className="input text-lg font-semibold"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
              />
              <button
                type="button"
                className="badge bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-white/[0.06] dark:text-gray-300 dark:hover:bg-white/[0.1] mt-1.5"
                onClick={() => setPaymentAmount(String(Number(payingPurchase.total) - Number(payingPurchase.amount_paid)))}
              >
                Solder la totalité
              </button>
            </div>
            <div className="flex justify-end gap-2.5 pt-4 mt-1 border-t border-gray-100 dark:border-white/[0.06]">
              <button type="button" className="btn-secondary" onClick={() => setPayingPurchase(null)}>Annuler</button>
              <button type="submit" className="btn-primary" disabled={addPayment.isPending}>
                {addPayment.isPending ? 'Enregistrement...' : 'Confirmer le paiement'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  )
}
