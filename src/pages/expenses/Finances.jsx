import { useEffect, useState, useMemo } from 'react'
import { Plus, TrendingUp, TrendingDown, Wallet, FileSpreadsheet, Search, Receipt, Trash2, Pencil, Eye } from 'lucide-react'
import { useExpenses } from '../../hooks/useEntities'
import { useSales } from '../../hooks/useSales'
import { useSmallSales } from '../../hooks/useSmallSales'
import { useAuth } from '../../context/AuthContext'
import StatCard from '../../components/StatCard'
import Modal from '../../components/Modal'
import ConfirmDialog from '../../components/ConfirmDialog'
import Pagination from '../../components/Pagination'
import { currency } from '../../lib/constants'
import { exportSalesToExcel, exportExpensesToExcel } from '../../utils/exportExcel'

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

function getSaleGrossMargin(sale) {
  const itemsMargin = (sale.sale_items || []).reduce((sum, item) => {
    const purchasePrice = Number(item.purchase_price ?? 0)
    const unitPrice = Number(item.unit_price ?? 0)
    const quantity = Number(item.quantity ?? 0)
    return sum + (unitPrice - purchasePrice) * quantity
  }, 0)
  return itemsMargin - Number(sale.discount || 0)
}

function getSmallSaleGrossMargin(sale) {
  const itemsMargin = (sale.small_sale_items || []).reduce((sum, item) => {
    const purchasePrice = Number(item.purchase_price ?? 0)
    const unitPrice = Number(item.unit_price ?? 0)
    const quantity = Number(item.quantity ?? 0)
    return sum + (unitPrice - purchasePrice) * quantity
  }, 0)
  return itemsMargin - Number(sale.discount || 0)
}

function ActionButton({ icon: Icon, title, onClick, tone = 'gray' }) {
  const tones = {
    gray: 'text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200',
    red: 'text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10',
  }
  return (
    <button type="button" title={title} onClick={onClick} className={`p-2 rounded-lg transition-colors ${tones[tone]}`}>
      <Icon size={15} />
    </button>
  )
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

  const activeSales = useMemo(() => sales.filter((sale) => sale.status !== 'annulee'), [sales])
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Finances</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">Recettes, dépenses et bénéfices</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => exportSalesToExcel(sales)}>
            <FileSpreadsheet size={16} /> Export ventes
          </button>
          <button className="btn-primary" onClick={openCreate}>
            <Plus size={16} /> Nouvelle dépense
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={TrendingUp} label="Recettes totales" value={currency(totalRevenue)} color="emerald" />
        <StatCard icon={TrendingDown} label="Dépenses totales" value={currency(totalExpenses)} color="red" />
        <StatCard icon={Wallet} label="Bénéfice réel" value={currency(profit)} color={profit >= 0 ? 'emerald' : 'red'} />
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="input pl-9"
            placeholder="Rechercher par libellé ou catégorie..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
          />
        </div>
        {!isLoading && expenses.length > 0 && (
          <p className="text-xs text-gray-400 sm:ml-auto">
            {filteredExpenses.length} dépense{filteredExpenses.length > 1 ? 's' : ''}
            {search && ` correspondant à "${search}"`}
          </p>
        )}
      </div>

      {/* ---- État de chargement ---- */}
      {isLoading ? (
        <div className="card p-4 space-y-3">
          <div className="h-4 w-24 rounded bg-gray-100 dark:bg-gray-800 mb-2" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-2 animate-pulse">
              <div className="h-8 w-8 rounded-full bg-gray-100 dark:bg-gray-800" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-1/4 rounded bg-gray-100 dark:bg-gray-800" />
                <div className="h-2.5 w-1/6 rounded bg-gray-100 dark:bg-gray-800" />
              </div>
              <div className="h-3 w-14 rounded bg-gray-100 dark:bg-gray-800" />
            </div>
          ))}
        </div>
      ) : expenses.length === 0 ? (
        <div className="card p-12 flex flex-col items-center text-center gap-3">
          <div className="h-12 w-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400">
            <Receipt size={20} />
          </div>
          <div>
            <p className="font-medium">Aucune dépense enregistrée</p>
            <p className="text-sm text-gray-400 mt-0.5">Ajoutez vos dépenses pour suivre votre bénéfice réel.</p>
          </div>
          <button className="btn-primary mt-1" onClick={openCreate}>
            <Plus size={16} /> Nouvelle dépense
          </button>
        </div>
      ) : filteredExpenses.length === 0 ? (
        <div className="card p-12 flex flex-col items-center text-center gap-2">
          <div className="h-12 w-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400">
            <Search size={20} />
          </div>
          <p className="font-medium">Aucune dépense ne correspond à "{search}"</p>
          <p className="text-sm text-gray-400">Essayez un autre libellé ou une autre catégorie.</p>
        </div>
      ) : (
        <>
          {/* ---- Tableau (desktop / tablette) ---- */}
          <div className="card hidden md:block overflow-hidden">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700/60 flex items-center justify-between">
              <h3 className="font-semibold">Dépenses</h3>
              <button className="text-sm text-brand-600 hover:underline flex items-center gap-1.5" onClick={() => exportExpensesToExcel(expenses)}>
                <FileSpreadsheet size={13} /> Exporter en Excel
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700/60 bg-gray-50/60 dark:bg-gray-800/40">
                    <th className="table-th">Libellé</th>
                    <th className="table-th">Catégorie</th>
                    <th className="table-th text-right">Montant</th>
                    <th className="table-th">Date</th>
                    <th className="table-th text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {paginatedExpenses.map((e) => (
                    <tr key={e.id} className="group hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                      <td className="table-td">
                        <div className="flex items-center gap-2.5">
                          <div className="h-8 w-8 rounded-full bg-red-50 dark:bg-red-500/10 flex items-center justify-center text-red-500 shrink-0">
                            <TrendingDown size={14} />
                          </div>
                          <span className="font-medium truncate max-w-[200px]">{e.label}</span>
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
          <div className="md:hidden space-y-2.5">
            <div className="flex items-center justify-between px-1">
              <h3 className="font-semibold text-sm">Dépenses</h3>
              <button className="text-xs text-brand-600 hover:underline flex items-center gap-1" onClick={() => exportExpensesToExcel(expenses)}>
                <FileSpreadsheet size={12} /> Exporter
              </button>
            </div>
            {paginatedExpenses.map((e) => (
              <div key={e.id} className="card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="h-9 w-9 rounded-full bg-red-50 dark:bg-red-500/10 flex items-center justify-center text-red-500 shrink-0">
                      <TrendingDown size={15} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{e.label}</p>
                      <div className="mt-0.5"><CategoryBadge name={e.category} /></div>
                    </div>
                  </div>
                  <span className="text-red-600 dark:text-red-400 font-semibold tabular-nums shrink-0">-{currency(e.amount)}</span>
                </div>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
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

          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Modifier la dépense' : 'Nouvelle dépense'}>
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
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setModalOpen(false)}>Annuler</button>
            <button type="submit" className="btn-primary" disabled={createItem.isPending || updateItem.isPending}>
              {editing ? 'Enregistrer' : 'Créer'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={!!detailExpense} onClose={() => setDetailExpense(null)} title="Détail de la dépense">
        {detailExpense && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-red-50 dark:bg-red-500/10 flex items-center justify-center text-red-500 shrink-0">
                <TrendingDown size={18} />
              </div>
              <div>
                <p className="font-semibold">{detailExpense.label}</p>
                <p className="text-xs text-gray-400">{formatRelativeDate(detailExpense.created_at)}</p>
              </div>
            </div>
            <div className="border border-gray-200 dark:border-gray-700/60 rounded-lg divide-y divide-gray-100 dark:divide-gray-800">
              <div className="flex justify-between p-3 text-sm"><span className="text-gray-500">Catégorie</span><CategoryBadge name={detailExpense.category} /></div>
              <div className="flex justify-between p-3 text-sm"><span className="text-gray-500">Montant</span><span className="font-semibold text-red-600 dark:text-red-400">-{currency(detailExpense.amount)}</span></div>
            </div>
            <div className="flex justify-end gap-2">
              <button className="btn-secondary" onClick={() => { openEdit(detailExpense); setDetailExpense(null) }}>
                <Pencil size={15} /> Modifier
              </button>
              <button className="btn-danger" onClick={() => setConfirmDelete(detailExpense)}>
                <Trash2 size={15} /> Supprimer
              </button>
            </div>
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
