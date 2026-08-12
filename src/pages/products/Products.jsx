import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Search, Package, ImagePlus, FileSpreadsheet, AlertTriangle, TrendingUp, Truck, Eye } from 'lucide-react'
import { useProducts, uploadProductImage } from '../../hooks/useProducts'
import { useCategories } from '../../hooks/useEntities'
import { usePurchases } from '../../hooks/usePurchases'
import { useToast } from '../../context/ToastContext'
import Modal from '../../components/Modal'
import ConfirmDialog from '../../components/ConfirmDialog'
import Pagination from '../../components/Pagination'
import { currency } from '../../lib/constants'
import { exportProductsToExcel } from '../../utils/exportExcel'

// Regroupe, pour un produit donné, l'historique d'achats par fournisseur
// (utile quand plusieurs fournisseurs livrent le même produit à des prix différents)
function getProductSupplierHistory(purchases, productId) {
  const map = new Map()
  for (const p of purchases) {
    if (p.status === 'annulee') continue
    for (const item of p.purchase_items || []) {
      if (item.product_id !== productId) continue
      const key = p.supplier_id || p.supplier_name
      const existing = map.get(key)
      const entry = {
        supplier_name: p.supplier_name || p.suppliers?.name || 'Fournisseur inconnu',
        last_date: p.created_at,
        last_price: item.unit_cost,
        total_quantity: item.quantity,
      }
      if (!existing || new Date(p.created_at) > new Date(existing.last_date)) {
        map.set(key, { ...entry, total_quantity: (existing?.total_quantity || 0) + item.quantity })
      } else {
        map.set(key, { ...existing, total_quantity: existing.total_quantity + item.quantity })
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => new Date(b.last_date) - new Date(a.last_date))
}

const emptyForm = {
  name: '',
  category_id: '',
  purchase_price: '',
  sale_price: '',
  stock: '',
  alert_threshold: 5,
  unit: 'unité',
  image_url: '',
}

// --- Helpers d'affichage ---

const CATEGORY_PALETTE = [
  { bg: 'bg-blue-100 dark:bg-blue-500/15', text: 'text-blue-700 dark:text-blue-400' },
  { bg: 'bg-emerald-100 dark:bg-emerald-500/15', text: 'text-emerald-700 dark:text-emerald-400' },
  { bg: 'bg-amber-100 dark:bg-amber-500/15', text: 'text-amber-700 dark:text-amber-400' },
  { bg: 'bg-violet-100 dark:bg-violet-500/15', text: 'text-violet-700 dark:text-violet-400' },
  { bg: 'bg-cyan-100 dark:bg-cyan-500/15', text: 'text-cyan-700 dark:text-cyan-400' },
]

function hashString(str) {
  let hash = 0
  for (let i = 0; i < str.length; i++) hash = (hash << 5) - hash + str.charCodeAt(i)
  return Math.abs(hash)
}

function CategoryBadge({ name }) {
  if (!name) return <span className="text-sm text-gray-400">Sans catégorie</span>
  const palette = CATEGORY_PALETTE[hashString(name) % CATEGORY_PALETTE.length]
  return (
    <span className={`badge ${palette.bg} ${palette.text}`}>{name}</span>
  )
}

function StockBadge({ stock, threshold, unit }) {
  const low = stock <= threshold
  return (
    <span
      className={`inline-flex items-center gap-1 badge ${
        low
          ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400'
          : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400'
      }`}
    >
      {low && <AlertTriangle size={11} />}
      {stock} {unit}
    </span>
  )
}

function MarginPill({ purchase, sale }) {
  const margin = sale - purchase
  if (!purchase && !sale) return null
  const pct = purchase > 0 ? Math.round((margin / purchase) * 100) : null
  const positive = margin >= 0
  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] font-medium ${
        positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'
      }`}
    >
      <TrendingUp size={11} className={positive ? '' : 'rotate-180'} />
      {pct !== null ? `${pct > 0 ? '+' : ''}${pct}%` : currency(margin)}
    </span>
  )
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

export default function Products() {
  const toast = useToast()
  const { data: products = [], isLoading, createItem, updateItem, deleteItem } = useProducts()
  const { data: categories = [] } = useCategories()
  const { data: purchases = [] } = usePurchases()
  const [modalOpen, setModalOpen] = useState(false)
  const [detailProduct, setDetailProduct] = useState(null)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [search, setSearch] = useState('')
  const [uploading, setUploading] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 10

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setModalOpen(true)
  }

  const openEdit = (p) => {
    setEditing(p)
    setForm({
      name: p.name,
      category_id: p.category_id || '',
      purchase_price: p.purchase_price,
      sale_price: p.sale_price,
      stock: p.stock,
      alert_threshold: p.alert_threshold,
      unit: p.unit || 'unité',
      image_url: p.image_url || '',
    })
    setModalOpen(true)
  }

  const handleImageChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    try {
      const url = await uploadProductImage(file)
      setForm((f) => ({ ...f, image_url: url }))
    } catch (err) {
      toast.error("Erreur lors de l'upload de l'image : " + err.message)
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const payload = {
      ...form,
      category_id: form.category_id || null,
      purchase_price: Number(form.purchase_price) || 0,
      sale_price: Number(form.sale_price) || 0,
      stock: Number(form.stock) || 0,
      alert_threshold: Number(form.alert_threshold) || 0,
    }
    if (editing) {
      await updateItem.mutateAsync({ id: editing.id, ...payload })
    } else {
      await createItem.mutateAsync(payload)
    }
    setModalOpen(false)
  }

  const handleDelete = async () => {
    await deleteItem.mutateAsync(confirmDelete.id)
    if (detailProduct?.id === confirmDelete.id) setDetailProduct(null)
    setConfirmDelete(null)
  }

  const filtered = products.filter((p) => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase())
    const matchCat = !categoryFilter || p.category_id === categoryFilter
    return matchSearch && matchCat
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Produits</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">Gérez votre catalogue de produits</p>
        </div>
        <button className="btn-primary" onClick={openCreate}>
          <Plus size={16} /> Nouveau produit
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="input pl-9"
            placeholder="Rechercher un produit..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
          />
        </div>
        <select className="input sm:w-56" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
          <option value="">Toutes les catégories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <button
          className="text-sm text-brand-600 hover:underline flex items-center gap-1.5 shrink-0 sm:px-2"
          onClick={() => exportProductsToExcel(filtered)}
        >
          <FileSpreadsheet size={14} /> Exporter
        </button>
      </div>

      {!isLoading && filtered.length > 0 && (
        <p className="text-xs text-gray-400 -mt-2">
          {filtered.length} produit{filtered.length > 1 ? 's' : ''}
          {search && ` correspondant à "${search}"`}
        </p>
      )}

      {/* ---- État de chargement ---- */}
      {isLoading ? (
        <div className="card p-4 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-2 animate-pulse">
              <div className="h-10 w-10 rounded-lg bg-gray-100 dark:bg-gray-800" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-1/3 rounded bg-gray-100 dark:bg-gray-800" />
                <div className="h-2.5 w-1/5 rounded bg-gray-100 dark:bg-gray-800" />
              </div>
              <div className="h-3 w-14 rounded bg-gray-100 dark:bg-gray-800" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 flex flex-col items-center text-center gap-3">
          <div className="h-12 w-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400">
            <Package size={20} />
          </div>
          <div>
            <p className="font-medium">{search || categoryFilter ? 'Aucun produit ne correspond' : 'Aucun produit enregistré'}</p>
            <p className="text-sm text-gray-400 mt-0.5">
              {search || categoryFilter ? 'Essayez un autre nom ou une autre catégorie.' : 'Ajoutez votre premier produit pour commencer.'}
            </p>
          </div>
          {!search && !categoryFilter && (
            <button className="btn-primary mt-1" onClick={openCreate}>
              <Plus size={16} /> Nouveau produit
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
                    <th className="table-th">Produit</th>
                    <th className="table-th">Catégorie</th>
                    <th className="table-th text-right">Prix achat</th>
                    <th className="table-th text-right">Prix vente</th>
                    <th className="table-th">Stock</th>
                    <th className="table-th text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {paginated.map((p) => (
                    <tr key={p.id} className="group hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                      <td className="table-td">
                        <div className="flex items-center gap-3">
                          {p.image_url ? (
                            <img src={p.image_url} alt={p.name} className="h-10 w-10 rounded-lg object-cover shrink-0" />
                          ) : (
                            <div className="h-10 w-10 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400 shrink-0">
                              <Package size={18} />
                            </div>
                          )}
                          <span className="font-medium truncate max-w-[200px]">{p.name}</span>
                        </div>
                      </td>
                      <td className="table-td">
                        <CategoryBadge name={p.categories?.name} />
                      </td>
                      <td className="table-td text-right">
                        <span className="tabular-nums text-gray-500 dark:text-gray-400">{currency(p.purchase_price)}</span>
                      </td>
                      <td className="table-td text-right">
                        <div className="flex flex-col items-end">
                          <span className="tabular-nums font-semibold">{currency(p.sale_price)}</span>
                          <MarginPill purchase={p.purchase_price} sale={p.sale_price} />
                        </div>
                      </td>
                      <td className="table-td">
                        <StockBadge stock={p.stock} threshold={p.alert_threshold} unit={p.unit} />
                      </td>
                      <td className="table-td">
                        <div className="flex justify-end gap-1">
                          <ActionButton icon={Eye} title="Voir le détail" onClick={() => setDetailProduct(p)} />
                          <ActionButton icon={Pencil} title="Modifier" onClick={() => openEdit(p)} />
                          <ActionButton icon={Trash2} title="Supprimer" onClick={() => setConfirmDelete(p)} tone="red" />
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
            {paginated.map((p) => (
              <div key={p.id} className="card p-4">
                <div className="flex items-start gap-3">
                  {p.image_url ? (
                    <img src={p.image_url} alt={p.name} className="h-12 w-12 rounded-lg object-cover shrink-0" />
                  ) : (
                    <div className="h-12 w-12 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400 shrink-0">
                      <Package size={20} />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{p.name}</p>
                    <div className="mt-1">
                      <CategoryBadge name={p.categories?.name} />
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <ActionButton icon={Eye} title="Voir le détail" onClick={() => setDetailProduct(p)} />
                    <ActionButton icon={Pencil} title="Modifier" onClick={() => openEdit(p)} />
                    <ActionButton icon={Trash2} title="Supprimer" onClick={() => setConfirmDelete(p)} tone="red" />
                  </div>
                </div>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                  <StockBadge stock={p.stock} threshold={p.alert_threshold} unit={p.unit} />
                  <div className="text-right">
                    <p className="tabular-nums font-semibold">{currency(p.sale_price)}</p>
                    <div className="flex items-center gap-1.5 justify-end">
                      <span className="text-[11px] text-gray-400">Achat {currency(p.purchase_price)}</span>
                      <MarginPill purchase={p.purchase_price} sale={p.sale_price} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Modifier le produit' : 'Nouveau produit'} maxWidth="max-w-xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center gap-4">
            <label className="h-16 w-16 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center cursor-pointer overflow-hidden shrink-0">
              {form.image_url ? (
                <img src={form.image_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <ImagePlus size={20} className="text-gray-400" />
              )}
              <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
            </label>
            <p className="text-xs text-gray-400">{uploading ? 'Téléversement...' : 'Cliquez sur le cadre pour ajouter une photo du produit'}</p>
          </div>

          <div>
            <label className="label">Nom du produit</label>
            <input required className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Catégorie</label>
              <select className="input" value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
                <option value="">Sans catégorie</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Unité</label>
              <input className="input" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="unité, sac, mètre..." />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Prix d'achat (FCFA)</label>
              <input type="number" min="0" required className="input" value={form.purchase_price} onChange={(e) => setForm({ ...form, purchase_price: e.target.value })} />
            </div>
            <div>
              <label className="label">Prix de vente (FCFA)</label>
              <input type="number" min="0" required className="input" value={form.sale_price} onChange={(e) => setForm({ ...form, sale_price: e.target.value })} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Stock initial</label>
              <input type="number" min="0" required className="input" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
            </div>
            <div>
              <label className="label">Seuil d'alerte</label>
              <input type="number" min="0" required className="input" value={form.alert_threshold} onChange={(e) => setForm({ ...form, alert_threshold: e.target.value })} />
            </div>
          </div>

          {editing && (() => {
            const history = getProductSupplierHistory(purchases, editing.id)
            if (history.length === 0) return null
            return (
              <div className="border-t border-gray-200 dark:border-gray-700/60 pt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 flex items-center gap-1.5 mb-2">
                  <Truck size={12} /> Fournisseurs ayant livré ce produit
                </p>
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {history.map((h, i) => (
                    <div key={i} className="flex items-center justify-between text-sm bg-gray-50 dark:bg-gray-800/60 rounded-lg px-3 py-2">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{h.supplier_name}</p>
                        <p className="text-xs text-gray-400">Dernier achat le {new Date(h.last_date).toLocaleDateString('fr-FR')} · {h.total_quantity} {editing.unit || 'unité'}(s) au total</p>
                      </div>
                      <span className="font-semibold shrink-0 ml-2">{currency(h.last_price)}</span>
                    </div>
                  ))}
                </div>
                {history.length > 1 && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                    💡 {history.length} fournisseurs différents pour ce produit — comparez les derniers prix ci-dessus avant votre prochain achat.
                  </p>
                )}
              </div>
            )
          })()}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setModalOpen(false)}>Annuler</button>
            <button type="submit" className="btn-primary" disabled={createItem.isPending || updateItem.isPending || uploading}>
              {editing ? 'Enregistrer' : 'Créer'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={!!detailProduct} onClose={() => setDetailProduct(null)} title="Détail du produit" maxWidth="max-w-lg">
        {detailProduct && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              {detailProduct.image_url ? (
                <img src={detailProduct.image_url} alt={detailProduct.name} className="h-14 w-14 rounded-lg object-cover shrink-0" />
              ) : (
                <div className="h-14 w-14 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400 shrink-0">
                  <Package size={22} />
                </div>
              )}
              <div className="min-w-0">
                <p className="font-semibold truncate">{detailProduct.name}</p>
                <CategoryBadge name={detailProduct.categories?.name} />
              </div>
            </div>
            <div className="border border-gray-200 dark:border-gray-700/60 rounded-lg divide-y divide-gray-100 dark:divide-gray-800">
              <div className="flex justify-between p-3 text-sm"><span className="text-gray-500">Prix d'achat</span><span className="font-medium">{currency(detailProduct.purchase_price)}</span></div>
              <div className="flex justify-between p-3 text-sm"><span className="text-gray-500">Prix de vente</span><span className="font-medium">{currency(detailProduct.sale_price)}</span></div>
              <div className="flex justify-between p-3 text-sm"><span className="text-gray-500">Stock</span><StockBadge stock={detailProduct.stock} threshold={detailProduct.alert_threshold} unit={detailProduct.unit} /></div>
              <div className="flex justify-between p-3 text-sm"><span className="text-gray-500">Seuil d'alerte</span><span>{detailProduct.alert_threshold} {detailProduct.unit || 'unité'}</span></div>
            </div>
            <div className="flex justify-end gap-2">
              <button className="btn-secondary" onClick={() => { openEdit(detailProduct); setDetailProduct(null) }}>
                <Pencil size={15} /> Modifier
              </button>
              <button className="btn-danger" onClick={() => setConfirmDelete(detailProduct)}>
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
        message={`Supprimer le produit "${confirmDelete?.name}" ? Cette action est irréversible.`}
      />
    </div>
  )
}
