import { useEffect, useState, useMemo } from 'react'
import PageHeader, { PanelTitle, InfoChip } from '../../components/PageHeader'
import { Plus, TrendingUp, TrendingDown, Wallet, FileSpreadsheet, Search, Receipt, Trash2, Pencil, Eye, Landmark, Coins, Percent } from 'lucide-react'
import { useExpenses } from '../../hooks/useEntities'
import { useSales } from '../../hooks/useSales'
import { useSmallSales } from '../../hooks/useSmallSales'
import { useAuth } from '../../context/AuthContext'
import StatCard from '../../components/StatCard'
import Modal from '../../components/Modal'
import ActionButton from '../../components/ActionButton'
import { DetailHeader, DetailList, DetailRow, DetailActions } from '../../components/Detail'
import ConfirmDialog from '../../components/ConfirmDialog'
import Pagination from '../../components/Pagination'
import { currency } from '../../lib/constants'
import { exportSalesToExcel, exportExpensesToExcel } from '../../utils/exportExcel'
import { getSaleGrossMargin, getSmallSaleGrossMargin, isCountedSale } from '../../utils/finance'

const emptyForm = { label: '', amount: '', category: '' }

// --- Helpers d'affichage ---

const CATEGORY_PALETTE = [
  { bg: 'bg-blue-100 dark:bg-blue-500/15', text: 'text-blue-700 dark:text-blue-400' },
  { bg: 'bg-violet-100 dark:bg-violet-500/15', text: 'text-violet-700 dark:text-violet-400' },
  { bg: 'bg-amber-100 dark:bg-amber-500/15', text: 'text-amber-700 dark:text-amber-400' },
  { bg: 'bg-cyan-100 dark:bg-cyan-500/15', text: 'text-cyan-700 dark:text-cyan-400' },
  { bg: 'bg-rose-100 dark:bg-rose-500/15', text: 'text-rose-700 dark:text-rose-400' },
]

function hashString(str) {
  let hash = 0
  for (let i = 0; i < str.length; i++) hash = (hash << 5) - hash + str.charCodeAt(i)
  return Math.abs(hash)
}

function CategoryBadge({ name }) {
  if (!name) return <span className="text-sm text-gray-300 dark:text-gray-600">—</span>
  const palette = CATEGORY_PALETTE[hashString(name) % CATEGORY_PALETTE.length]
  return <span className={`badge ${palette.bg} ${palette.text}`}>{name}</span>
}

function formatRelativeDate(dateStr) {
  const date = new Date(dateStr)
  const now = new Date()
  const isSameDay = date.toDateString() === now.toDateString()
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  const isYesterday = date.toDateString() === yesterday.toDateString()

  if (isSameDay) return "Aujourd'hui"
  if (isYesterday) return 'Hier'
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function Finances() {
  const { user } = useAuth()
  const { data: expenses = [], isLoading, createItem, updateItem, deleteItem } = useExpenses()
  const { data: sales = [] } = useSales()
  const { data: smallSales = [] } = useSmallSales()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [detailExpense, setDetailExpense] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const pageSize = 10

  // Même périmètre que le Dashboard : ni annulées, ni devis (un devis n'est pas une vente)
  const activeSales = useMemo(
    () => sales.filter(isCountedSale),
    [sales]
  )
  const totalRevenue = useMemo(
    () =>
      activeSales.reduce((sum, s) => sum + Number(s.total), 0) +
      smallSales.reduce((sum, s) => sum + Number(s.total), 0),
    [activeSales, smallSales]
  )
  const grossMargin = useMemo(
    () =>
      activeSales.reduce((sum, s) => sum + getSaleGrossMargin(s), 0) +
      smallSales.reduce((sum, s) => sum + getSmallSaleGrossMargin(s), 0),
    [activeSales, smallSales]
  )
  const totalExpenses = useMemo(() => expenses.reduce((sum, e) => sum + Number(e.amount), 0), [expenses])
  const profit = grossMargin - totalExpenses

  const filteredExpenses = expenses.filter(
    (e) =>
      e.label.toLowerCase().includes(search.toLowerCase()) ||
      (e.category || '').toLowerCase().includes(search.toLowerCase())
  )

  const totalPages = Math.max(1, Math.ceil(filteredExpenses.length / pageSize))

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const paginatedExpenses = filteredExpenses.slice((page - 1) * pageSize, page * pageSize)

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setModalOpen(true)
  }

  const openEdit = (expense) => {
    setEditing(expense)
    setForm({
      label: expense.label || '',
      amount: expense.amount || '',
      category: expense.category || '',
    })
    setModalOpen(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (editing) {
      await updateItem.mutateAsync({ id: editing.id, ...form, amount: Number(form.amount), user_id: user?.id })
    } else {
      await createItem.mutateAsync({ ...form, amount: Number(form.amount), user_id: user?.id })
    }
    setModalOpen(false)
    setEditing(null)
    setForm(emptyForm)
  }

  const handleDelete = async () => {
    await deleteItem.mutateAsync(confirmDelete.id)
    if (detailExpense?.id === confirmDelete.id) setDetailExpense(null)
    setConfirmDelete(null)
  }

  return (
    <div className="space-y-6">
      <PageHeader icon={Landmark} badge={Coins} title="Finances & dépenses" subtitle="Recettes, dépenses et bénéfice réel de la boutique">
        <button className="btn-soft" onClick={() => exportSalesToExcel(activeSales)}>
          <FileSpreadsheet size={17} /> Export ventes
        </button>
        <button className="btn-cta" onClick={openCreate}>
          <Plus size={18} strokeWidth={2.5} /> Nouvelle dépense
        </button>
      </PageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard featured icon={TrendingUp} label="Chiffre d'affaires (facturé)" value={currency(totalRevenue)} sub="factures confirmées" />
        <StatCard icon={Percent} color="brand" label="Marge brute" value={currency(grossMargin)} sub="ventes − coût d'achat" />
        <StatCard icon={TrendingDown} color="red" label="Dépenses totales" value={currency(totalExpenses)} sub={`${expenses.length} dépense${expenses.length > 1 ? 's' : ''}`} />
        <StatCard icon={Wallet} color={profit >= 0 ? 'emerald' : 'red'} label="Bénéfice réel" value={currency(profit)} sub="marge − dépenses" />
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1">
          <Search size={18} className="search-icon" />
          <input
            className="search-field"
            placeholder="Rechercher par libellé ou catégorie..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
          />
        </div>
      </div>

      <section className="panel overflow-hidden">
        <PanelTitle icon={Receipt} title="Dépenses">
          {!isLoading && expenses.length > 0 && <InfoChip tone="red">{filteredExpenses.length === expenses.length ? `${expenses.length} dépense${expenses.length > 1 ? 's' : ''}` : `${filteredExpenses.length} sur ${expenses.length}`}</InfoChip>}
          {expenses.length > 0 && (
            <button type="button" className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 hover:bg-gray-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.1] px-3.5 py-1.5 text-xs font-semibold text-brand-900 dark:text-gray-200" onClick={() => exportExpensesToExcel(expenses)}>
              <FileSpreadsheet size={13} /> Exporter en Excel
            </button>
          )}
        </PanelTitle>
      {/* ---- État de chargement ---- */}
      {isLoading ? (
        <div className="p-4 space-y-3 border-t border-gray-100 dark:border-white/[0.06]">
          <div className="h-4 w-24 rounded bg-gray-100 dark:bg-white/[0.06] mb-2" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-2 animate-pulse">
              <div className="h-8 w-8 rounded-full bg-gray-100 dark:bg-white/[0.06]" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-1/4 rounded bg-gray-100 dark:bg-white/[0.06]" />
                <div className="h-2.5 w-1/6 rounded bg-gray-100 dark:bg-white/[0.06]" />
              </div>
              <div className="h-3 w-14 rounded bg-gray-100 dark:bg-white/[0.06]" />
            </div>
          ))}
        </div>
      ) : expenses.length === 0 ? (
        <div className="p-12 border-t border-gray-100 dark:border-white/[0.06] flex flex-col items-center text-center gap-3">
          <div className="h-12 w-12 rounded-full bg-gray-100 dark:bg-white/[0.06] flex items-center justify-center text-gray-400">
            <Receipt size={20} />
          </div>
          <div>
            <p className="font-medium">Aucune dépense enregistrée</p>
            <p className="text-sm text-gray-400 mt-0.5">Ajoutez vos dépenses pour suivre votre bénéfice réel.</p>
          </div>
          <button className="btn-cta mt-1" onClick={openCreate}>
            <Plus size={16} /> Nouvelle dépense
          </button>
        </div>
      ) : filteredExpenses.length === 0 ? (
        <div className="p-12 border-t border-gray-100 dark:border-white/[0.06] flex flex-col items-center text-center gap-2">
          <div className="h-12 w-12 rounded-full bg-gray-100 dark:bg-white/[0.06] flex items-center justify-center text-gray-400">
            <Search size={20} />
          </div>
          <p className="font-medium">Aucune dépense ne correspond à "{search}"</p>
          <p className="text-sm text-gray-400">Essayez un autre libellé ou une autre catégorie.</p>
        </div>
      ) : (
        <>
          {/* ---- Tableau (desktop / tablette) ---- */}
          <div className="hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-white/[0.08] bg-gray-50/60 dark:bg-white/[0.03]">
                    <th className="table-th">Libellé</th>
                    <th className="table-th">Catégorie</th>
                    <th className="table-th text-right">Montant</th>
                    <th className="table-th">Date</th>
                    <th className="table-th text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/[0.06]">
                  {paginatedExpenses.map((e) => (
                    <tr key={e.id} className="group hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-colors">
                      <td className="table-td">
                        <div className="flex items-center gap-2.5">
                          <div className="h-8 w-8 rounded-full bg-red-50 dark:bg-red-500/10 flex items-center justify-center text-red-500 shrink-0">
                            <TrendingDown size={14} />
                          </div>
                          <span className="font-bold text-brand-900 dark:text-gray-100 truncate max-w-[200px]">{e.label}</span>
                        </div>
                      </td>
                      <td className="table-td">
                        <CategoryBadge name={e.category} />
                      </td>
                      <td className="table-td text-right">
                        <span className="text-red-600 dark:text-red-400 font-semibold tabular-nums">-{currency(e.amount)}</span>
                      </td>
                      <td className="table-td">
                        <span className="text-sm text-gray-500 dark:text-gray-400">{formatRelativeDate(e.created_at)}</span>
                      </td>
                      <td className="table-td">
                        <div className="flex justify-end gap-1">
                          <ActionButton icon={Eye} title="Voir le détail" onClick={() => setDetailExpense(e)} />
                          <ActionButton icon={Pencil} title="Modifier" onClick={() => openEdit(e)} />
                          <ActionButton icon={Trash2} title="Supprimer" onClick={() => setConfirmDelete(e)} tone="red" />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ---- Vue cartes (mobile) ---- */}
          <div className="md:hidden divide-y divide-gray-100 dark:divide-white/[0.06] border-t border-gray-100 dark:border-white/[0.06]">
            <div className="flex items-center justify-between px-1">
              <h3 className="font-semibold text-sm">Dépenses</h3>
              <button className="text-xs text-[#1d4fb8] hover:underline flex items-center gap-1" onClick={() => exportExpensesToExcel(expenses)}>
                <FileSpreadsheet size={12} /> Exporter
              </button>
            </div>
            {paginatedExpenses.map((e) => (
              <div key={e.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="h-9 w-9 rounded-full bg-red-50 dark:bg-red-500/10 flex items-center justify-center text-red-500 shrink-0">
                      <TrendingDown size={15} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-brand-900 dark:text-gray-100 truncate">{e.label}</p>
                      <div className="mt-0.5"><CategoryBadge name={e.category} /></div>
                    </div>
                  </div>
                  <span className="text-red-600 dark:text-red-400 font-semibold tabular-nums shrink-0">-{currency(e.amount)}</span>
                </div>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100 dark:border-white/[0.06]">
                  <span className="text-xs text-gray-400">{formatRelativeDate(e.created_at)}</span>
                  <div className="flex gap-1">
                    <ActionButton icon={Eye} title="Voir le détail" onClick={() => setDetailExpense(e)} />
                    <ActionButton icon={Pencil} title="Modifier" onClick={() => openEdit(e)} />
                    <ActionButton icon={Trash2} title="Supprimer" onClick={() => setConfirmDelete(e)} tone="red" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} totalItems={filteredExpenses.length} pageSize={pageSize} itemLabel="dépenses" />
        </>
      )}
      </section>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} icon={Receipt} title={editing ? 'Modifier la dépense' : 'Nouvelle dépense'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Libellé</label>
            <input required className="input" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="Transport, électricité..." />
          </div>
          <div>
            <label className="label">Montant (FCFA)</label>
            <input type="number" min="0" required className="input" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          </div>
          <div>
            <label className="label">Catégorie</label>
            <input className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Fonctionnement, achat..." />
          </div>
          <div className="flex justify-end gap-2.5 pt-4 mt-1 border-t border-gray-100 dark:border-white/[0.06]">
            <button type="button" className="btn-secondary" onClick={() => setModalOpen(false)}>Annuler</button>
            <button type="submit" className="btn-primary" disabled={createItem.isPending || updateItem.isPending}>
              {editing ? 'Enregistrer' : 'Créer'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={!!detailExpense} onClose={() => setDetailExpense(null)} icon={Receipt} title="Détail de la dépense">
        {detailExpense && (
          <div className="space-y-4">
            <DetailHeader
              avatar={
                <div className="h-10 w-10 rounded-full bg-red-50 dark:bg-red-500/10 flex items-center justify-center text-red-500 shrink-0">
                  <TrendingDown size={18} />
                </div>
              }
              title={detailExpense.label}
              subtitle={new Date(detailExpense.created_at).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })}
            />
            <DetailList>
              <DetailRow label="Catégorie"><CategoryBadge name={detailExpense.category} /></DetailRow>
              <DetailRow label="Montant" strong tone="red">- {currency(detailExpense.amount)}</DetailRow>
            </DetailList>
            <DetailActions>
              <button className="btn-danger" onClick={() => setConfirmDelete(detailExpense)}>
                <Trash2 size={15} /> Supprimer
              </button>
              <button className="btn-secondary" onClick={() => { openEdit(detailExpense); setDetailExpense(null) }}>
                <Pencil size={15} /> Modifier
              </button>
            </DetailActions>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
        loading={deleteItem.isPending}
        message={`Supprimer la dépense "${confirmDelete?.label}" ? Cette action est irréversible.`}
      />
    </div>
  )
}
