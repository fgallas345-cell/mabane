import { useEffect, useMemo, useState } from 'react'
import PageHeader, { PanelTitle, InfoChip } from '../../components/PageHeader'
import StatCard from '../../components/StatCard'
import { useSearchParams } from 'react-router-dom'
import { Plus, ArrowUpRight, ArrowDownRight, Search, Package, History, AlertTriangle, Eye, Pencil, Trash2, Boxes, ArrowLeftRight } from 'lucide-react'
import { useProducts } from '../../hooks/useProducts'
import { useStockMovements, useAddStockEntry, useAddStockExit, useUpdateStockMovement, useDeleteStockMovement } from '../../hooks/useSales'
import { useAuth } from '../../context/AuthContext'
import Modal from '../../components/Modal'
import ActionButton from '../../components/ActionButton'
import { DetailHeader, DetailList, DetailRow, Callout, DetailActions } from '../../components/Detail'
import ConfirmDialog from '../../components/ConfirmDialog'
import SearchableSelect from '../../components/SearchableSelect'
import QtyStepper from '../../components/QtyStepper'
import Segmented from '../../components/Segmented'
import { formatQty } from '../../utils/quantity'
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
      {isEntry ? '+' : '−'}{formatQty(quantity)}
    </span>
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
  const productOptions = useMemo(
    () =>
      products.map((p) => ({
        value: p.id,
        label: p.name,
        searchText: p.name,
        content: (
          <span className="flex items-center justify-between gap-3">
            <span className="truncate font-medium">{p.name}</span>
            <span className={`shrink-0 text-xs tabular-nums ${Number(p.stock) <= Number(p.alert_threshold) ? 'text-amber-600' : 'text-gray-400'}`}>stock : {formatQty(p.stock)}</span>
          </span>
        ),
      })),
    [products]
  )
  const { data: movements = [], isLoading } = useStockMovements()
  const addEntry = useAddStockEntry()
  const addExit = useAddStockExit()
  const updateMovement = useUpdateStockMovement()
  const deleteMovement = useDeleteStockMovement()

  const [modalOpen, setModalOpen] = useState(false)
  const [detailMovement, setDetailMovement] = useState(null)
  const [editing, setEditing] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [productId, setProductId] = useState('')
  const selectedProduct = products.find((p) => p.id === productId)
  const [movementType, setMovementType] = useState('entree')
  const [newType, setNewType] = useState('entree') // formulaire de création : entree | sortie
  const [quantity, setQuantity] = useState('')
  const [reason, setReason] = useState('')
  const [formError, setFormError] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 10

  // Les plus urgents d'abord (rupture, puis stock le plus bas)
  const lowStock = products.filter((p) => Number(p.stock) <= Number(p.alert_threshold)).sort((a, b) => Number(a.stock) - Number(b.stock))
  const [showAllLow, setShowAllLow] = useState(false)

  const filteredMovements = movements.filter(
    (m) =>
      (m.products?.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (m.reason || '').toLowerCase().includes(search.toLowerCase())
  )

  const totalPages = Math.max(1, Math.ceil(filteredMovements.length / pageSize))

  const monthStats = useMemo(() => {
    const start = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    const inMonth = movements.filter((m) => new Date(m.created_at) >= start)
    return {
      count: inMonth.length,
      entries: inMonth.filter((m) => m.type === 'entree').length,
      exits: inMonth.filter((m) => m.type !== 'entree').length,
    }
  }, [movements])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const paginatedMovements = filteredMovements.slice((page - 1) * pageSize, page * pageSize)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFormError('')
    if (!productId) {
      setFormError('Choisissez un produit.')
      return
    }
    const qty = Number(quantity) || 1 // le sélecteur affiche 1 tant que rien n'est saisi
    if (newType === 'sortie' && selectedProduct && qty > Number(selectedProduct.stock)) {
      setFormError(`Stock insuffisant (disponible : ${formatQty(selectedProduct.stock)}).`)
      return
    }
    try {
      if (newType === 'sortie') await addExit.mutateAsync({ productId, quantity: qty, reason })
      else await addEntry.mutateAsync({ productId, quantity: qty, reason, userId: user?.id })
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

  const openNew = () => {
    setNewType('entree')
    setProductId('')
    setQuantity('')
    setReason('')
    setFormError('')
    setModalOpen(true)
  }

  // Raccourci du tableau de bord : /stock?nouveau=1
  const [searchParams, setSearchParams] = useSearchParams()
  useEffect(() => {
    if (searchParams.get('nouveau') === '1') {
      setNewType('entree')
      setModalOpen(true)
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, setSearchParams])

  const handleDelete = async () => {
    try {
      await deleteMovement.mutateAsync(confirmDelete.id)
    } catch {
      return // toast déjà affiché par le hook
    }
    if (detailMovement?.id === confirmDelete.id) setDetailMovement(null)
    setConfirmDelete(null)
  }

  return (
    <div className="space-y-6">
      <PageHeader icon={Boxes} badge={ArrowLeftRight} title="Gestion du stock" subtitle="Suivez les entrées, sorties et alertes de stock">
        <button className="btn-cta" onClick={openNew}>
          <Plus size={18} strokeWidth={2.5} /> Mouvement de stock
        </button>
      </PageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard featured icon={ArrowLeftRight} label="Mouvements ce mois" value={monthStats.count} sub={`${movements.length} au total`} />
        <StatCard icon={ArrowUpRight} color="emerald" label="Entrées ce mois" value={monthStats.entries} sub="mouvements d'entrée" />
        <StatCard icon={ArrowDownRight} color="red" label="Sorties ce mois" value={monthStats.exits} sub="mouvements de sortie" />
        <StatCard icon={AlertTriangle} color="amber" label="Stock faible" value={lowStock.length} sub={`${lowStock.filter((x) => Number(x.stock) <= 0).length} en rupture`} />
      </div>

      {lowStock.length > 0 && (
        <div className="panel p-5 bg-gradient-to-br from-white to-amber-50/70 dark:from-darkcard dark:to-amber-500/5">
          <p className="text-lg font-bold text-brand-900 dark:text-gray-50 mb-3 flex items-center gap-2.5">
            <AlertTriangle size={22} className="text-amber-500 fill-amber-100 dark:fill-amber-500/20" /> Stock faible
            <span className="rounded-full bg-amber-100 dark:bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-800 dark:text-amber-400">
              {lowStock.length} produit{lowStock.length > 1 ? 's' : ''}
            </span>
          </p>
          <div className="flex flex-wrap gap-2">
            {(showAllLow ? lowStock : lowStock.slice(0, 12)).map((p) => (
              <span
                key={p.id}
                className={`inline-flex items-center gap-1.5 text-xs font-semibold bg-white dark:bg-white/[0.04] border rounded-full pl-2.5 pr-3 py-1.5 ${Number(p.stock) <= 0 ? 'border-red-200 text-red-600 dark:border-red-500/30 dark:text-red-400' : 'border-amber-200 text-amber-800 dark:border-amber-500/30 dark:text-amber-400'}`}
              >
                <Package size={11} />
                {p.name}
                <span className="opacity-60">· {formatQty(p.stock)}</span>
              </span>
            ))}
            {lowStock.length > 12 && (
              <button type="button" className="text-xs font-semibold text-amber-800 dark:text-amber-400 underline underline-offset-2 px-1" onClick={() => setShowAllLow((v) => !v)}>
                {showAllLow ? 'Réduire' : `Voir les ${lowStock.length}`}
              </button>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1">
          <Search size={18} className="search-icon" />
          <input
            className="search-field"
            placeholder="Rechercher produit ou motif..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
          />
        </div>
      </div>

      <section className="panel overflow-hidden">
        <PanelTitle icon={History} title="Historique des mouvements">
          {!isLoading && <InfoChip>{filteredMovements.length === movements.length ? `${movements.length} mouvement${movements.length > 1 ? 's' : ''} au total` : `${filteredMovements.length} sur ${movements.length}`}</InfoChip>}
        </PanelTitle>
      {/* ---- État de chargement ---- */}
      {isLoading ? (
        <div className="p-4 space-y-3 border-t border-gray-100 dark:border-white/[0.06]">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-2 animate-pulse">
              <div className="h-8 w-8 rounded-full bg-gray-100 dark:bg-white/[0.06]" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-1/4 rounded bg-gray-100 dark:bg-white/[0.06]" />
                <div className="h-2.5 w-1/3 rounded bg-gray-100 dark:bg-white/[0.06]" />
              </div>
              <div className="h-3 w-10 rounded bg-gray-100 dark:bg-white/[0.06]" />
            </div>
          ))}
        </div>
      ) : filteredMovements.length === 0 ? (
        <div className="p-12 border-t border-gray-100 dark:border-white/[0.06] flex flex-col items-center text-center gap-3">
          <div className="h-12 w-12 rounded-full bg-gray-100 dark:bg-white/[0.06] flex items-center justify-center text-gray-400">
            <History size={20} />
          </div>
          <div>
            <p className="font-medium">{search ? 'Aucun mouvement ne correspond' : 'Aucun mouvement enregistré'}</p>
            <p className="text-sm text-gray-400 mt-0.5">
              {search ? 'Essayez un autre nom de produit ou motif.' : 'Les entrées et sorties de stock apparaîtront ici.'}
            </p>
          </div>
          {!search && (
            <button className="btn-cta mt-1" onClick={openNew}>
              <Plus size={16} /> Mouvement de stock
            </button>
          )}
        </div>
      ) : (
        <>
          {/* ---- Tableau (desktop / tablette) ---- */}
          <div className="hidden md:block">
            <div className="p-4 border-b border-gray-200 dark:border-white/[0.08]">
              <h3 className="font-semibold">Historique des mouvements</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-white/[0.08] bg-gray-50/60 dark:bg-white/[0.03]">
                    <th className="table-th">Produit</th>
                    <th className="table-th">Type</th>
                    <th className="table-th text-right">Quantité</th>
                    <th className="table-th">Motif</th>
                    <th className="table-th">Date</th>
                    <th className="table-th text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/[0.06]">
                  {paginatedMovements.map((m) => (
                    <tr key={m.id} className="hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-colors">
                      <td className="table-td">
                        <div className="flex items-center gap-2.5">
                          <div className="h-8 w-8 rounded-full bg-gray-100 dark:bg-white/[0.06] flex items-center justify-center text-gray-400 shrink-0">
                            <Package size={14} />
                          </div>
                          <span className="font-bold text-brand-900 dark:text-gray-100 truncate max-w-[180px]">{m.products?.name || '—'}</span>
                        </div>
                      </td>
                      <td className="table-td">
                        <MovementTypeBadge type={m.type} />
                      </td>
                      <td className="table-td text-right">
                        <QuantitySigned type={m.type} quantity={m.quantity} />
                      </td>
                      <td className="table-td whitespace-normal max-w-[320px]">
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
          <div className="md:hidden divide-y divide-gray-100 dark:divide-white/[0.06] border-t border-gray-100 dark:border-white/[0.06]">
            {paginatedMovements.map((m) => (
              <div key={m.id} className="p-4" onClick={() => setDetailMovement(m)}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="h-9 w-9 rounded-full bg-gray-100 dark:bg-white/[0.06] flex items-center justify-center text-gray-400 shrink-0">
                      <Package size={15} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-brand-900 dark:text-gray-100 truncate">{m.products?.name || '—'}</p>
                      <p className="text-xs text-gray-400 truncate">{m.reason || 'Aucun motif renseigné'}</p>
                    </div>
                  </div>
                  <QuantitySigned type={m.type} quantity={m.quantity} />
                </div>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100 dark:border-white/[0.06]">
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

          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} totalItems={filteredMovements.length} pageSize={pageSize} itemLabel="mouvements" />
        </>
      )}
      </section>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} icon={ArrowLeftRight} title={newType === 'sortie' ? 'Nouvelle sortie de stock' : 'Nouvelle entrée de stock'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Type de mouvement</label>
            <Segmented
              label="Type de mouvement"
              value={newType}
              onChange={(v) => { setNewType(v); setReason(''); setFormError('') }}
              options={[
                { value: 'entree', label: 'Entrée' },
                { value: 'sortie', label: 'Sortie' },
              ]}
            />
          </div>
          <div>
            <label className="label">Produit</label>
            <SearchableSelect
              value={productId}
              onChange={setProductId}
              options={productOptions}
              placeholder="Tapez le nom du produit..."
              emptyMessage="Aucun produit trouvé"
              autoFocus
            />
          </div>

          <div>
            <label className="label">{newType === 'sortie' ? 'Quantité sortie' : 'Quantité reçue'}</label>
            <div className="flex items-center gap-3">
              <QtyStepper value={quantity === '' ? 1 : quantity} unit={selectedProduct?.unit} onChange={(q) => setQuantity(q)} />
              {selectedProduct && (
                <p className="text-sm text-gray-500 dark:text-gray-400 tabular-nums">
                  Stock : {formatQty(selectedProduct.stock)} → <strong className={newType === 'sortie' ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}>{Number(selectedProduct.stock) + (newType === 'sortie' ? -1 : 1) * (Number(quantity) || 1)}</strong> {selectedProduct.unit || ''}
                </p>
              )}
            </div>
          </div>

          <div>
            <label className="label" htmlFor="stock-reason">Motif</label>
            <input id="stock-reason" className="input" placeholder={newType === 'sortie' ? 'Casse, perte, usage interne...' : 'Achat fournisseur, réapprovisionnement...'} value={reason} onChange={(e) => setReason(e.target.value)} />
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {(newType === 'sortie' ? ['Casse', 'Perte / vol', 'Usage interne', 'Inventaire'] : ['Réapprovisionnement', 'Retour client', 'Inventaire', 'Don / échantillon']).map((r) => (
                <button key={r} type="button" className="badge bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-white/[0.06] dark:text-gray-300 dark:hover:bg-white/[0.1]" onClick={() => setReason(r)}>
                  {r}
                </button>
              ))}
            </div>
          </div>

          {formError && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{formError}</p>}

          <DetailActions>
            <button type="button" className="btn-secondary" onClick={() => setModalOpen(false)}>Annuler</button>
            <button type="submit" className="btn-primary" disabled={addEntry.isPending || addExit.isPending || !productId}>
              {addEntry.isPending || addExit.isPending ? 'Enregistrement...' : newType === 'sortie' ? 'Enregistrer la sortie' : 'Enregistrer l’entrée'}
            </button>
          </DetailActions>
        </form>
      </Modal>

      <Modal open={!!editing} onClose={closeEdit} icon={Pencil} title="Modifier le mouvement">
        {editing && (
          <form onSubmit={handleUpdate} className="space-y-4">
            {formError && <div className="text-sm text-red-600 bg-red-50 dark:bg-red-500/10 rounded-xl px-3 py-2">{formError}</div>}
            <div>
              <label className="label">Produit</label>
              <select required className="input" value={productId} onChange={(e) => setProductId(e.target.value)}>
                <option value="">Sélectionner un produit...</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} (stock actuel: {formatQty(p.stock)})</option>
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
                <input type="number" min="0.001" step="any" required className="input" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="label">Motif</label>
              <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2.5 pt-4 mt-1 border-t border-gray-100 dark:border-white/[0.06]">
              <button type="button" className="btn-secondary" onClick={closeEdit}>Annuler</button>
              <button type="submit" className="btn-primary" disabled={updateMovement.isPending}>
                {updateMovement.isPending ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      <Modal open={!!detailMovement} onClose={() => setDetailMovement(null)} icon={History} title="Détail du mouvement">
        {detailMovement && (
          <div className="space-y-4">
            <DetailHeader
              avatar={
                <div className="h-10 w-10 rounded-xl bg-gray-100 dark:bg-white/[0.06] flex items-center justify-center text-gray-400 shrink-0">
                  <Package size={18} />
                </div>
              }
              title={detailMovement.products?.name || 'Produit supprimé'}
              subtitle={new Date(detailMovement.created_at).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })}
            />
            <DetailList>
              <DetailRow label="Type"><MovementTypeBadge type={detailMovement.type} /></DetailRow>
              <DetailRow label="Quantité"><QuantitySigned type={detailMovement.type} quantity={detailMovement.quantity} /></DetailRow>
              <DetailRow label="Motif">{detailMovement.reason || '—'}</DetailRow>
            </DetailList>
            {canEdit(detailMovement) ? (
              <DetailActions>
                <button className="btn-danger" onClick={() => setConfirmDelete(detailMovement)}>
                  <Trash2 size={15} /> Supprimer
                </button>
                <button className="btn-secondary" onClick={() => { openEdit(detailMovement); setDetailMovement(null) }}>
                  <Pencil size={15} /> Modifier
                </button>
              </DetailActions>
            ) : (
              <Callout tone="gray">
                {isSystemMovement(detailMovement)
                  ? 'Mouvement généré par un document (vente, achat, livraison…) : corrigez ou annulez le document lui-même.'
                  : 'Seul un administrateur peut corriger un mouvement de stock.'}
              </Callout>
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
