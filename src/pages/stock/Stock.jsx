import { useEffect, useState } from 'react'
import { Plus, ArrowUpRight, ArrowDownRight, Search, Package, History, AlertTriangle, Eye, Pencil, Trash2 } from 'lucide-react'
import { useProducts } from '../../hooks/useProducts'
import { useStockMovements, useAddStockEntry, useUpdateStockMovement, useDeleteStockMovement } from '../../hooks/useSales'
import { useAuth } from '../../context/AuthContext'
import Modal from '../../components/Modal'
import ConfirmDialog from '../../components/ConfirmDialog'
import Pagination from '../../components/Pagination'

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

function MovementTypeBadge({ type }) {
  const isEntry = type === 'entree'
  return (
    <span
      className={`inline-flex items-center gap-1 badge ${
        isEntry
          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400'
          : 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400'
      }`}
    >
      {isEntry ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
      {isEntry ? 'Entrée' : 'Sortie'}
    </span>
  )
}

function QuantitySigned({ type, quantity }) {
  const isEntry = type === 'entree'
  return (
    <span className={`tabular-nums font-semibold ${isEntry ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
      {isEntry ? '+' : '-'}{quantity}
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

// Miroir de public.is_system_stock_movement (schema.sql) : mouvements générés par
// une vente / un achat / une livraison / une annulation → jamais corrigés à la main.
const SYSTEM_REASON = /^(Vente |Achat |Livraison |Annulation |Confirmation devis |Petite vente|Rectification |Vente rectifiée |Achat rectifié )/
const isSystemMovement = (m) => SYSTEM_REASON.test(m?.reason || '')

export default function Stock() {
  const { user, isAdmin } = useAuth()
  const canEdit = (m) => isAdmin && !isSystemMovement(m)
  const { data: products = [] } = useProducts()
  const { data: movements = [], isLoading } = useStockMovements()
  const addEntry = useAddStockEntry()
  const updateMovement = useUpdateStockMovement()
  const deleteMovement = useDeleteStockMovement()

  const [modalOpen, setModalOpen] = useState(false)
  const [detailMovement, setDetailMovement] = useState(null)
  const [editing, setEditing] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [productId, setProductId] = useState('')
  const [movementType, setMovementType] = useState('entree')
  const [quantity, setQuantity] = useState('')
  const [reason, setReason] = useState('')
  const [formError, setFormError] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 10

  const lowStock = products.filter((p) => p.stock <= p.alert_threshold)

  const filteredMovements = movements.filter(
    (m) =>
      (m.products?.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (m.reason || '').toLowerCase().includes(search.toLowerCase())
  )

  const totalPages = Math.max(1, Math.ceil(filteredMovements.length / pageSize))

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const paginatedMovements = filteredMovements.slice((page - 1) * pageSize, page * pageSize)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFormError('')
    if (!productId || !quantity) return
    try {
      await addEntry.mutateAsync({ productId, quantity: Number(quantity), reason, userId: user?.id })
      setModalOpen(false)
      setProductId('')
      setQuantity('')
      setReason('')
    } catch (err) {
      setFormError(err.message)
    }
  }

  const openEdit = (movement) => {
    setEditing(movement)
    setProductId(movement.product_id || '')
    setMovementType(movement.type || 'entree')
    setQuantity(movement.quantity || '')
    setReason(movement.reason || '')
    setFormError('')
  }

  const closeEdit = () => {
    setEditing(null)
    setProductId('')
    setMovementType('entree')
    setQuantity('')
    setReason('')
    setFormError('')
  }

  const handleUpdate = async (e) => {
    e.preventDefault()
    setFormError('')
    if (!editing || !productId || !quantity) return
    try {
      await updateMovement.mutateAsync({
        movementId: editing.id,
        productId,
        type: movementType,
        quantity: Number(quantity),
        reason,
        userId: user?.id,
      })
      closeEdit()
    } catch (err) {
      setFormError(err.message)
    }
  }

  const handleDelete = async () => {
    await deleteMovement.mutateAsync(confirmDelete.id)
    if (detailMovement?.id === confirmDelete.id) setDetailMovement(null)
    setConfirmDelete(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Gestion du stock</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">Suivez les entrées, sorties et alertes de stock</p>
        </div>
        <button className="btn-primary" onClick={() => setModalOpen(true)}>
          <Plus size={16} /> Entrée de stock
        </button>
      </div>

      {lowStock.length > 0 && (
        <div className="card p-4 bg-amber-50/60 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30">
          <p className="text-sm font-semibold text-amber-700 dark:text-amber-400 mb-2.5 flex items-center gap-2">
            <AlertTriangle size={16} /> {lowStock.length} produit{lowStock.length > 1 ? 's' : ''} en stock faible
          </p>
          <div className="flex flex-wrap gap-2">
            {lowStock.map((p) => (
              <span
                key={p.id}
                className="inline-flex items-center gap-1.5 text-xs font-medium bg-white dark:bg-gray-900/60 border border-amber-200 dark:border-amber-500/30 text-amber-800 dark:text-amber-400 rounded-full pl-2 pr-2.5 py-1"
              >
                <Package size={11} />
                {p.name}
                <span className="opacity-60">· {p.stock}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="input pl-9"
            placeholder="Rechercher produit ou motif..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
          />
        </div>
        {!isLoading && (
          <p className="text-xs text-gray-400 sm:ml-auto">
            {filteredMovements.length} mouvement{filteredMovements.length > 1 ? 's' : ''}
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
                <div className="h-2.5 w-1/3 rounded bg-gray-100 dark:bg-gray-800" />
              </div>
              <div className="h-3 w-10 rounded bg-gray-100 dark:bg-gray-800" />
            </div>
          ))}
        </div>
      ) : filteredMovements.length === 0 ? (
        <div className="card p-12 flex flex-col items-center text-center gap-3">
          <div className="h-12 w-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400">
            <History size={20} />
          </div>
          <div>
            <p className="font-medium">{search ? 'Aucun mouvement ne correspond' : 'Aucun mouvement enregistré'}</p>
            <p className="text-sm text-gray-400 mt-0.5">
              {search ? 'Essayez un autre nom de produit ou motif.' : 'Les entrées et sorties de stock apparaîtront ici.'}
            </p>
          </div>
          {!search && (
            <button className="btn-primary mt-1" onClick={() => setModalOpen(true)}>
              <Plus size={16} /> Entrée de stock
            </button>
          )}
        </div>
      ) : (
        <>
          {/* ---- Tableau (desktop / tablette) ---- */}
          <div className="card hidden md:block overflow-hidden">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700/60">
              <h3 className="font-semibold">Historique des mouvements</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700/60 bg-gray-50/60 dark:bg-gray-800/40">
                    <th className="table-th">Produit</th>
                    <th className="table-th">Type</th>
                    <th className="table-th text-right">Quantité</th>
                    <th className="table-th">Motif</th>
                    <th className="table-th">Date</th>
                    <th className="table-th text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {paginatedMovements.map((m) => (
                    <tr key={m.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                      <td className="table-td">
                        <div className="flex items-center gap-2.5">
                          <div className="h-8 w-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400 shrink-0">
                            <Package size={14} />
                          </div>
                          <span className="font-medium truncate max-w-[180px]">{m.products?.name || '—'}</span>
                        </div>
                      </td>
                      <td className="table-td">
                        <MovementTypeBadge type={m.type} />
                      </td>
                      <td className="table-td text-right">
                        <QuantitySigned type={m.type} quantity={m.quantity} />
                      </td>
                      <td className="table-td">
                        <span className="text-gray-500 dark:text-gray-400">{m.reason || '—'}</span>
                      </td>
                      <td className="table-td">
                        <span className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">{formatRelativeDate(m.created_at)}</span>
                      </td>
                      <td className="table-td">
                        <div className="flex justify-end gap-1">
                          <ActionButton icon={Eye} title="Voir le détail" onClick={() => setDetailMovement(m)} />
                          {canEdit(m) && <ActionButton icon={Pencil} title="Modifier" onClick={() => openEdit(m)} />}
                          {canEdit(m) && <ActionButton icon={Trash2} title="Supprimer" onClick={() => setConfirmDelete(m)} tone="red" />}
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
            {paginatedMovements.map((m) => (
              <div key={m.id} className="card p-4" onClick={() => setDetailMovement(m)}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="h-9 w-9 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400 shrink-0">
                      <Package size={15} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{m.products?.name || '—'}</p>
                      <p className="text-xs text-gray-400 truncate">{m.reason || 'Aucun motif renseigné'}</p>
                    </div>
                  </div>
                  <QuantitySigned type={m.type} quantity={m.quantity} />
                </div>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                  <MovementTypeBadge type={m.type} />
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <span className="text-xs text-gray-400 mr-1">{formatRelativeDate(m.created_at)}</span>
                    {canEdit(m) && <ActionButton icon={Pencil} title="Modifier" onClick={() => openEdit(m)} />}
                    {canEdit(m) && <ActionButton icon={Trash2} title="Supprimer" onClick={() => setConfirmDelete(m)} tone="red" />}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nouvelle entrée de stock">
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && <div className="text-sm text-red-600 bg-red-50 dark:bg-red-500/10 rounded-lg px-3 py-2">{formError}</div>}
          <div>
            <label className="label">Produit</label>
            <select required className="input" value={productId} onChange={(e) => setProductId(e.target.value)}>
              <option value="">Sélectionner un produit...</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name} (stock actuel: {p.stock})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Quantité reçue</label>
            <input type="number" min="1" required className="input" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          </div>
          <div>
            <label className="label">Motif</label>
            <input className="input" placeholder="Achat fournisseur, réapprovisionnement..." value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setModalOpen(false)}>Annuler</button>
            <button type="submit" className="btn-primary" disabled={addEntry.isPending}>Enregistrer</button>
          </div>
        </form>
      </Modal>

      <Modal open={!!editing} onClose={closeEdit} title="Modifier le mouvement">
        {editing && (
          <form onSubmit={handleUpdate} className="space-y-4">
            {formError && <div className="text-sm text-red-600 bg-red-50 dark:bg-red-500/10 rounded-lg px-3 py-2">{formError}</div>}
            <div>
              <label className="label">Produit</label>
              <select required className="input" value={productId} onChange={(e) => setProductId(e.target.value)}>
                <option value="">Sélectionner un produit...</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} (stock actuel: {p.stock})</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Type</label>
                <select className="input" value={movementType} onChange={(e) => setMovementType(e.target.value)}>
                  <option value="entree">Entrée</option>
                  <option value="sortie">Sortie</option>
                </select>
              </div>
              <div>
                <label className="label">Quantité</label>
                <input type="number" min="1" required className="input" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="label">Motif</label>
              <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="btn-secondary" onClick={closeEdit}>Annuler</button>
              <button type="submit" className="btn-primary" disabled={updateMovement.isPending}>
                {updateMovement.isPending ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      <Modal open={!!detailMovement} onClose={() => setDetailMovement(null)} title="Détail du mouvement">
        {detailMovement && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400 shrink-0">
                <Package size={18} />
              </div>
              <div className="min-w-0">
                <p className="font-medium truncate">{detailMovement.products?.name || '—'}</p>
                <p className="text-xs text-gray-400">{formatRelativeDate(detailMovement.created_at)}</p>
              </div>
            </div>
            <div className="border border-gray-200 dark:border-gray-700/60 rounded-lg divide-y divide-gray-100 dark:divide-gray-800">
              <div className="flex justify-between p-3 text-sm">
                <span className="text-gray-500">Type</span>
                <MovementTypeBadge type={detailMovement.type} />
              </div>
              <div className="flex justify-between p-3 text-sm">
                <span className="text-gray-500">Quantité</span>
                <QuantitySigned type={detailMovement.type} quantity={detailMovement.quantity} />
              </div>
              <div className="flex justify-between gap-4 p-3 text-sm">
                <span className="text-gray-500">Motif</span>
                <span className="text-right">{detailMovement.reason || '—'}</span>
              </div>
            </div>
            {canEdit(detailMovement) ? (
              <div className="flex justify-end gap-2">
                <button className="btn-secondary" onClick={() => { openEdit(detailMovement); setDetailMovement(null) }}>
                  <Pencil size={15} /> Modifier
                </button>
                <button className="btn-danger" onClick={() => setConfirmDelete(detailMovement)}>
                  <Trash2 size={15} /> Supprimer
                </button>
              </div>
            ) : (
              <p className="text-xs text-gray-400">
                {isSystemMovement(detailMovement)
                  ? 'Mouvement généré par un document (vente, achat, livraison…) : corrigez ou annulez le document lui-même.'
                  : 'Seul un administrateur peut corriger un mouvement de stock.'}
              </p>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
        loading={deleteMovement.isPending}
        message={`Supprimer ce mouvement de stock ? Le stock du produit sera automatiquement réajusté.`}
      />
    </div>
  )
}
