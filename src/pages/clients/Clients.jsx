import { useSearchParams } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, Search, Phone, History, Users, MapPin, Receipt, CreditCard, Wallet } from 'lucide-react'
import { useClients } from '../../hooks/useEntities'
import { useSales, useAddSalePayment } from '../../hooks/useSales'
import Modal from '../../components/Modal'
import ActionButton from '../../components/ActionButton'
import ConfirmDialog from '../../components/ConfirmDialog'
import Pagination from '../../components/Pagination'
import { isCountedSale } from '../../utils/finance'
import { currency } from '../../lib/constants'

const emptyForm = { name: '', phone: '', address: '' }

// --- Helpers d'affichage ---

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
  const palette = AVATAR_PALETTE[hashString(name || '?') % AVATAR_PALETTE.length]
  return (
    <div className={`h-9 w-9 shrink-0 rounded-full flex items-center justify-center text-xs font-semibold ${palette.bg} ${palette.text}`}>
      {getInitials(name || '?')}
    </div>
  )
}

function LoyaltyBadge({ count }) {
  if (count < 5) return null
  return (
    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-brand-100 text-brand-700 dark:bg-brand-500/15 dark:text-brand-400">
      Fidèle
    </span>
  )
}

export default function Clients() {
  const { data: clients = [], isLoading, createItem, updateItem, deleteItem } = useClients()
  const { data: sales = [] } = useSales()
  const addPayment = useAddSalePayment()
  const [modalOpen, setModalOpen] = useState(false)
  const [historyClient, setHistoryClient] = useState(null)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [searchParams] = useSearchParams()
  const [search, setSearch] = useState(searchParams.get('q') || '')
  useEffect(() => {
    const q = searchParams.get('q')
    if (q !== null) setSearch(q)
  }, [searchParams])
  const [page, setPage] = useState(1)
  const [payingSale, setPayingSale] = useState(null)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentError, setPaymentError] = useState('')
  const pageSize = 10

  // --- Statistiques d'achat par client (calculées une fois) ---
  const clientStats = useMemo(() => {
    const map = {}
    sales.forEach((s) => {
      if (!s.client_id || !isCountedSale(s)) return // ni annulée, ni devis
      if (!map[s.client_id]) map[s.client_id] = { total: 0, count: 0, dette: 0 }
      map[s.client_id].total += Number(s.total) || 0
      map[s.client_id].count += 1
      map[s.client_id].dette += Number(s.total) - Number(s.amount_paid)
    })
    return map
  }, [sales])

  const handleAddPayment = async (e) => {
    e.preventDefault()
    setPaymentError('')
    const due = payingSale.total - payingSale.amount_paid
    if (!paymentAmount || Number(paymentAmount) <= 0) {
      setPaymentError('Entrez un montant valide.')
      return
    }
    if (Number(paymentAmount) > due) {
      setPaymentError(`Le paiement dépasse le solde dû (${currency(due)}).`)
      return
    }
    try {
      await addPayment.mutateAsync({ saleId: payingSale.id, amount: Number(paymentAmount) })
      setPayingSale(null)
      setPaymentAmount('')
    } catch (err) {
      setPaymentError(err.message)
    }
  }

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setModalOpen(true)
  }

  const openEdit = (c) => {
    setEditing(c)
    setForm({ name: c.name, phone: c.phone, address: c.address || '' })
    setModalOpen(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (editing) {
      await updateItem.mutateAsync({ id: editing.id, ...form })
    } else {
      await createItem.mutateAsync(form)
    }
    setModalOpen(false)
  }

  const handleDelete = async () => {
    await deleteItem.mutateAsync(confirmDelete.id)
    setConfirmDelete(null)
  }

  const filtered = clients.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.phone || '').toLowerCase().includes(search.toLowerCase())
  )

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize)
  const clientSales = historyClient ? sales.filter((s) => s.client_id === historyClient.id) : []
  const historyTotal = clientSales.reduce((sum, s) => sum + Number(s.total || 0), 0)
  const historyDette = clientSales
    .filter(isCountedSale)
    .reduce((sum, s) => sum + (Number(s.total) - Number(s.amount_paid)), 0)
  const totalDette = Object.values(clientStats).reduce((sum, st) => sum + st.dette, 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Clients</h1>
          <p className="page-subtitle">Gérez votre base de clients</p>
        </div>
        <button className="btn-primary" onClick={openCreate}>
          <Plus size={16} /> Nouveau client
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
            placeholder="Rechercher par nom ou téléphone..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
          />
        </div>
        {!isLoading && (
          <p className="text-xs text-gray-400 sm:ml-auto">
            {filtered.length} client{filtered.length > 1 ? 's' : ''}
            {search && ` correspondant à "${search}"`}
          </p>
        )}
      </div>

      {/* ---- État de chargement ---- */}
      {isLoading ? (
        <div className="card p-4 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-2 animate-pulse">
              <div className="h-9 w-9 rounded-full bg-gray-100 dark:bg-gray-800" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-1/4 rounded bg-gray-100 dark:bg-gray-800" />
                <div className="h-2.5 w-1/5 rounded bg-gray-100 dark:bg-gray-800" />
              </div>
              <div className="h-3 w-16 rounded bg-gray-100 dark:bg-gray-800" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 flex flex-col items-center text-center gap-3">
          <div className="h-12 w-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400">
            <Users size={20} />
          </div>
          <div>
            <p className="font-medium">{search ? 'Aucun client ne correspond' : 'Aucun client enregistré'}</p>
            <p className="text-sm text-gray-400 mt-0.5">
              {search ? 'Essayez un autre nom ou numéro.' : 'Ajoutez votre premier client pour commencer.'}
            </p>
          </div>
          {!search && (
            <button className="btn-primary mt-1" onClick={openCreate}>
              <Plus size={16} /> Nouveau client
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
                    <th className="table-th">Client</th>
                    <th className="table-th">Téléphone</th>
                    <th className="table-th">Adresse</th>
                    <th className="table-th text-right">Total achats</th>
                    <th className="table-th text-right">Dette</th>
                    <th className="table-th text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {paginated.map((c) => {
                    const stats = clientStats[c.id] || { total: 0, count: 0, dette: 0 }
                    return (
                      <tr key={c.id} className="group hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                        <td className="table-td">
                          <div className="flex items-center gap-2.5">
                            <ClientAvatar name={c.name} />
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className="text-sm font-medium truncate max-w-[160px]">{c.name}</p>
                                <LoyaltyBadge count={stats.count} />
                              </div>
                              <p className="text-xs text-gray-400">{stats.count} achat{stats.count !== 1 ? 's' : ''}</p>
                            </div>
                          </div>
                        </td>
                        <td className="table-td">
                          <a
                            href={`tel:${c.phone}`}
                            className="inline-flex items-center gap-1.5 text-gray-600 dark:text-gray-300 hover:text-brand-600 dark:hover:text-brand-400"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Phone size={13} /> {c.phone}
                          </a>
                        </td>
                        <td className="table-td">
                          {c.address ? (
                            <span className="inline-flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
                              <MapPin size={13} className="shrink-0" /> {c.address}
                            </span>
                          ) : (
                            <span className="text-gray-300 dark:text-gray-600">—</span>
                          )}
                        </td>
                        <td className="table-td text-right">
                          <span className="font-semibold tabular-nums">{currency(stats.total)}</span>
                        </td>
                        <td className="table-td text-right tabular-nums">
                          {stats.dette > 0 ? <span className="text-red-500 font-semibold">{currency(stats.dette)}</span> : <span className="text-gray-400">—</span>}
                        </td>
                        <td className="table-td">
                          <div className="flex justify-end gap-1">
                            <ActionButton icon={History} title="Historique des achats" onClick={() => setHistoryClient(c)} />
                            <ActionButton icon={Pencil} title="Modifier" onClick={() => openEdit(c)} />
                            <ActionButton icon={Trash2} title="Supprimer" onClick={() => setConfirmDelete(c)} tone="red" />
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
            {paginated.map((c) => {
              const stats = clientStats[c.id] || { total: 0, count: 0, dette: 0 }
              return (
                <div key={c.id} className="card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <ClientAvatar name={c.name} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-medium truncate">{c.name}</p>
                          <LoyaltyBadge count={stats.count} />
                        </div>
                        <a href={`tel:${c.phone}`} className="text-xs text-gray-400 inline-flex items-center gap-1">
                          <Phone size={11} /> {c.phone}
                        </a>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-semibold tabular-nums">{currency(stats.total)}</span>
                      {stats.dette > 0 && <p className="text-[10px] font-semibold text-red-500 mt-0.5">Dette : {currency(stats.dette)}</p>}
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                    <span className="text-xs text-gray-400">
                      {c.address || 'Adresse non renseignée'}
                    </span>
                    <div className="flex gap-1">
                      <ActionButton icon={History} title="Historique" onClick={() => setHistoryClient(c)} />
                      <ActionButton icon={Pencil} title="Modifier" onClick={() => openEdit(c)} />
                      <ActionButton icon={Trash2} title="Supprimer" onClick={() => setConfirmDelete(c)} tone="red" />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Modifier le client' : 'Nouveau client'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Nom</label>
            <input required className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="label">Téléphone (WhatsApp)</label>
            <input required className="input" placeholder="+221 77 000 00 00" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div>
            <label className="label">Adresse</label>
            <input className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setModalOpen(false)}>Annuler</button>
            <button type="submit" className="btn-primary">{editing ? 'Enregistrer' : 'Créer'}</button>
          </div>
        </form>
      </Modal>

      <Modal open={!!historyClient} onClose={() => setHistoryClient(null)} title={`Historique — ${historyClient?.name}`} maxWidth="max-w-lg">
        {clientSales.length === 0 ? (
          <div className="flex flex-col items-center text-center gap-2 py-6">
            <div className="h-10 w-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400">
              <Receipt size={18} />
            </div>
            <p className="text-sm text-gray-400">Aucun achat enregistré pour ce client.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm bg-gray-50 dark:bg-gray-800/60 rounded-lg px-3 py-2">
              <div>
                <p className="text-gray-400 text-xs">Total acheté</p>
                <p className="font-semibold">{currency(historyTotal)}</p>
              </div>
              <div className="text-right">
                <p className="text-gray-400 text-xs">Dette actuelle</p>
                <p className={`font-semibold ${historyDette > 0 ? 'text-red-500' : ''}`}>{currency(historyDette)}</p>
              </div>
            </div>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {clientSales.map((s) => {
                const due = Number(s.total) - Number(s.amount_paid)
                return (
                  <div key={s.id} className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/60">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-semibold px-1.5 py-0.5 rounded bg-white dark:bg-gray-900/60">{s.invoice_number}</span>
                      <p className="text-xs text-gray-400">{new Date(s.created_at).toLocaleDateString('fr-FR')}</p>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <p className="font-semibold text-sm tabular-nums">{currency(s.total)}</p>
                      {s.status === 'annulee' ? (
                        <span className="text-xs font-medium text-gray-400">Annulée</span>
                      ) : due > 0 ? (
                        <button
                          className="text-xs font-medium text-brand-600 hover:underline flex items-center gap-1"
                          onClick={() => { setPayingSale(s); setPaymentAmount(''); setPaymentError('') }}
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
        )}
      </Modal>

      {/* ---- Modal: paiement d'une dette client ---- */}
      <Modal open={!!payingSale} onClose={() => setPayingSale(null)} title="Enregistrer un paiement">
        {payingSale && (
          <form onSubmit={handleAddPayment} className="space-y-4">
            {paymentError && <div className="text-sm text-red-600 bg-red-50 dark:bg-red-500/10 rounded-lg px-3 py-2">{paymentError}</div>}
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Facture <strong>{payingSale.invoice_number}</strong> — solde dû :{' '}
              <span className="text-red-500 font-semibold">{currency(Number(payingSale.total) - Number(payingSale.amount_paid))}</span>
            </p>
            <div>
              <label className="label">Montant du paiement (FCFA)</label>
              <input
                type="number"
                min="1"
                max={Number(payingSale.total) - Number(payingSale.amount_paid)}
                required
                autoFocus
                className="input"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="btn-secondary" onClick={() => setPayingSale(null)}>Annuler</button>
              <button type="submit" className="btn-primary" disabled={addPayment.isPending}>
                {addPayment.isPending ? 'Enregistrement...' : 'Confirmer le paiement'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
        loading={deleteItem.isPending}
        message={`Supprimer le client "${confirmDelete?.name}" ?`}
      />
    </div>
  )
}