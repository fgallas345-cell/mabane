import { useMemo, useState } from 'react'
import PageHeader, { PanelTitle, InfoChip } from '../../components/PageHeader'
import { useProducts } from '../../hooks/useProducts'
import StatCard from '../../components/StatCard'
import { Plus, Pencil, Trash2, Tags, Search, FolderTree, Package, PackageSearch, Trophy, LayoutGrid } from 'lucide-react'
import { useCategories } from '../../hooks/useEntities'
import Modal from '../../components/Modal'
import ConfirmDialog from '../../components/ConfirmDialog'

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

export default function Categories() {
  const { data: categories = [], isLoading, createItem, updateItem, deleteItem } = useCategories()
  const { data: products = [] } = useProducts()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ name: '', description: '' })
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [search, setSearch] = useState('')

  const openCreate = () => {
    setEditing(null)
    setForm({ name: '', description: '' })
    setModalOpen(true)
  }

  const openEdit = (cat) => {
    setEditing(cat)
    setForm({ name: cat.name, description: cat.description || '' })
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

  const filtered = categories.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))

  // Nombre de produits par catégorie
  const countByCategory = useMemo(() => {
    const map = new Map()
    products.forEach((pr) => pr.category_id && map.set(pr.category_id, (map.get(pr.category_id) || 0) + 1))
    return map
  }, [products])
  const overview = useMemo(() => {
    let biggest = null
    categories.forEach((c) => {
      const count = countByCategory.get(c.id) || 0
      if (count > 0 && (!biggest || count > biggest.count)) biggest = { name: c.name, count }
    })
    const classified = products.filter((pr) => pr.category_id).length
    return { classified, unclassified: products.length - classified, biggest }
  }, [categories, products, countByCategory])

  return (
    <div className="space-y-6">
      <PageHeader icon={Tags} badge={FolderTree} title="Catégories" subtitle="Organisez vos produits par catégorie">
        <button className="btn-cta" onClick={openCreate}>
          <Plus size={18} strokeWidth={2.5} /> Nouvelle catégorie
        </button>
      </PageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard featured icon={Tags} label="Catégories" value={categories.length} sub="pour classer le catalogue" />
        <StatCard icon={Package} color="emerald" label="Produits classés" value={overview.classified} sub={`sur ${products.length} produits`} />
        <StatCard icon={PackageSearch} color="amber" label="Sans catégorie" value={overview.unclassified} sub="à ranger" />
        <StatCard icon={Trophy} color="accent" label="Plus grande catégorie" value={overview.biggest?.name || '—'} sub={overview.biggest ? `${overview.biggest.count} produit${overview.biggest.count > 1 ? 's' : ''}` : 'aucun produit classé'} />
      </div>

      {categories.length > 0 && (
        <div className="relative">
          <Search size={18} className="search-icon" />
          <input
            className="search-field"
            placeholder="Rechercher une catégorie..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      )}

      <section className="panel overflow-hidden">
        <PanelTitle icon={LayoutGrid} title="Toutes les catégories">
          {!isLoading && <InfoChip>{filtered.length === categories.length ? `${categories.length} catégorie${categories.length > 1 ? 's' : ''}` : `${filtered.length} sur ${categories.length}`}</InfoChip>}
        </PanelTitle>
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 px-5 pb-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="border border-gray-200 dark:border-white/[0.08] rounded-xl p-4 space-y-3 animate-pulse">
              <div className="h-9 w-9 rounded-xl bg-gray-100 dark:bg-white/[0.06]" />
              <div className="h-3 w-2/3 rounded bg-gray-100 dark:bg-white/[0.06]" />
              <div className="h-2.5 w-full rounded bg-gray-100 dark:bg-white/[0.06]" />
              <div className="h-8 w-full rounded-xl bg-gray-100 dark:bg-white/[0.06] mt-2" />
            </div>
          ))}
        </div>
      ) : categories.length === 0 ? (
        <div className="p-12 border-t border-gray-100 dark:border-white/[0.06] flex flex-col items-center text-center gap-3">
          <div className="h-12 w-12 rounded-full bg-gray-100 dark:bg-white/[0.06] flex items-center justify-center text-gray-400">
            <Tags size={20} />
          </div>
          <div>
            <p className="font-medium">Aucune catégorie pour le moment</p>
            <p className="text-sm text-gray-400 mt-0.5">Créez des catégories pour mieux organiser votre catalogue.</p>
          </div>
          <button className="btn-cta mt-1" onClick={openCreate}>
            <Plus size={16} /> Nouvelle catégorie
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-12 border-t border-gray-100 dark:border-white/[0.06] flex flex-col items-center text-center gap-2">
          <div className="h-12 w-12 rounded-full bg-gray-100 dark:bg-white/[0.06] flex items-center justify-center text-gray-400">
            <Search size={20} />
          </div>
          <p className="font-medium">Aucune catégorie ne correspond à "{search}"</p>
          <p className="text-sm text-gray-400">Essayez un autre nom.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 px-5 pb-5">
          {filtered.map((cat) => {
            const palette = ICON_PALETTE[hashString(cat.name) % ICON_PALETTE.length]
            return (
              <div
                key={cat.id}
                className={`group border border-gray-200/80 dark:border-white/[0.08] rounded-2xl p-4 flex flex-col gap-2 bg-white dark:bg-white/[0.02] transition-all hover:shadow-lift hover:-translate-y-0.5 hover:border-blue-200 dark:hover:border-blue-500/40 ring-1 ring-transparent ${palette.ring}`}
              >
                <div className="flex items-center gap-2.5">
                  <div className={`p-2 rounded-xl ${palette.bg} ${palette.text}`}>
                    <Tags size={16} />
                  </div>
                  <p className="font-bold text-brand-900 dark:text-gray-100 truncate flex-1">{cat.name}</p>
                  <span className="shrink-0 rounded-full bg-blue-50 dark:bg-blue-500/15 px-2.5 py-0.5 text-xs font-semibold text-[#1d4fb8] dark:text-blue-200">
                    {countByCategory.get(cat.id) || 0} produit{(countByCategory.get(cat.id) || 0) > 1 ? 's' : ''}
                  </span>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 flex-1 line-clamp-2">
                  {cat.description || <span className="italic text-gray-300 dark:text-gray-600">Aucune description</span>}
                </p>
                <div className="flex gap-2 mt-2">
                  <button className="btn-secondary flex-1 !py-1.5" onClick={() => openEdit(cat)}>
                    <Pencil size={14} /> Modifier
                  </button>
                  <button className="btn-danger !py-1.5 !px-3" title="Supprimer" onClick={() => setConfirmDelete(cat)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
      </section>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} icon={Tags} title={editing ? 'Modifier la catégorie' : 'Nouvelle catégorie'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Nom</label>
            <input required className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2.5 pt-4 mt-1 border-t border-gray-100 dark:border-white/[0.06]">
            <button type="button" className="btn-secondary" onClick={() => setModalOpen(false)}>Annuler</button>
            <button type="submit" className="btn-primary" disabled={createItem.isPending || updateItem.isPending}>
              {editing ? 'Enregistrer' : 'Créer'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
        loading={deleteItem.isPending}
        message={`Supprimer la catégorie "${confirmDelete?.name}" ? Les produits associés ne seront pas supprimés.`}
      />
    </div>
  )
}