import { useEffect, useMemo, useState } from 'react'
import PageHeader, { PanelTitle, InfoChip } from '../../components/PageHeader'
import { ClipboardCheck, Search, History, CheckCircle2, AlertTriangle, Eye, FileSpreadsheet, RotateCcw, Lock, ScanSearch, ListChecks } from 'lucide-react'
import { useProducts } from '../../hooks/useProducts'
import { useCategories } from '../../hooks/useEntities'
import { useInventories, useInventoryItems, useApplyInventory } from '../../hooks/useInventory'
import { useAuth } from '../../context/AuthContext'
import Modal from '../../components/Modal'
import StatCard from '../../components/StatCard'
import ActionButton from '../../components/ActionButton'
import { Callout, DetailActions } from '../../components/Detail'
import { currency, displayName } from '../../lib/constants'
import { formatQty, parseQty, roundQty, isDecimalUnit } from '../../utils/quantity'

const DRAFT_KEY = 'mabane-inventaire-brouillon'

// Le comptage en cours est gardé dans ce navigateur : on peut compter un rayon, fermer, reprendre plus tard
function loadDraft() {
  try {
    return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}
  } catch {
    return {}
  }
}
function saveDraft(counts) {
  try {
    if (Object.keys(counts).length) localStorage.setItem(DRAFT_KEY, JSON.stringify(counts))
    else localStorage.removeItem(DRAFT_KEY)
  } catch {
    // stockage indisponible (navigation privée) : le comptage reste en mémoire
  }
}

function GapCell({ diff, unit }) {
  if (diff === null) return <span className="text-gray-300 dark:text-gray-600">—</span>
  if (diff === 0) return <span className="badge bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">Juste</span>
  return (
    <span className={`badge ${diff > 0 ? 'bg-blue-50 text-[#1d4fb8] dark:bg-blue-500/15 dark:text-blue-300' : 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400'}`}>
      {diff > 0 ? '+' : '−'}{formatQty(Math.abs(diff), unit)}
    </span>
  )
}

export default function Inventory() {
  const { isAdmin } = useAuth()
  const { data: products = [], isLoading } = useProducts()
  const { data: categories = [] } = useCategories()
  const { data: inventories = [] } = useInventories()
  const applyInventory = useApplyInventory()

  const [tab, setTab] = useState('count') // count | history
  const [counts, setCounts] = useState(loadDraft) // { product_id: '12,5' }
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [onlyCounted, setOnlyCounted] = useState(false)
  const [notes, setNotes] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [detail, setDetail] = useState(null)
  const { data: detailItems = [], isLoading: loadingDetail } = useInventoryItems(detail?.id)

  useEffect(() => saveDraft(counts), [counts])

  // Lignes de comptage : stock théorique, compté, écart, valeur de l'écart
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return products
      .filter((p) => !categoryId || p.category_id === categoryId)
      .filter((p) => !q || p.name.toLowerCase().includes(q))
      .map((p) => {
        const raw = counts[p.id]
        const counted = raw === undefined || raw === '' ? null : parseQty(raw)
        const valid = counted !== null && Number.isFinite(counted) && counted >= 0
        const diff = valid ? roundQty(counted - Number(p.stock)) : null
        return { product: p, raw: raw ?? '', counted: valid ? counted : null, invalid: raw !== undefined && raw !== '' && !valid, diff }
      })
      .filter((r) => !onlyCounted || r.counted !== null)
  }, [products, counts, search, categoryId, onlyCounted])

  // Résumé sur TOUT le comptage (pas seulement les lignes filtrées)
  const summary = useMemo(() => {
    let counted = 0
    let gaps = 0
    let value = 0
    let invalid = 0
    for (const p of products) {
      const raw = counts[p.id]
      if (raw === undefined || raw === '') continue
      const n = parseQty(raw)
      if (!Number.isFinite(n) || n < 0) {
        invalid += 1
        continue
      }
      counted += 1
      const diff = roundQty(n - Number(p.stock))
      if (diff !== 0) {
        gaps += 1
        value += diff * Number(p.purchase_price || 0)
      }
    }
    return { counted, gaps, value, invalid }
  }, [products, counts])

  const setCount = (productId, value) => {
    setCounts((c) => {
      const next = { ...c }
      if (value === '') delete next[productId]
      else next[productId] = value
      return next
    })
  }

  const fillVisibleWithTheoretical = () => {
    setCounts((c) => {
      const next = { ...c }
      rows.forEach((r) => {
        if (next[r.product.id] === undefined) next[r.product.id] = String(Number(r.product.stock))
      })
      return next
    })
  }

  const handleValidate = async () => {
    const payload = Object.entries(counts)
      .map(([product_id, raw]) => ({ product_id, counted: parseQty(raw) }))
      .filter((c) => Number.isFinite(c.counted) && c.counted >= 0 && products.some((p) => p.id === c.product_id))
    try {
      await applyInventory.mutateAsync({ counts: payload, notes })
    } catch {
      return // toast déjà affiché
    }
    setCounts({})
    setNotes('')
    setConfirmOpen(false)
    setTab('history')
  }

  const exportDetail = async () => {
    const { downloadWorkbookSheets } = await import('../../utils/exportExcel')
    await downloadWorkbookSheets(
      [
        {
          name: detail.number,
          rows: detailItems.map((i) => ({
            Produit: i.product_name,
            Unité: i.unit || 'unité',
            'Stock théorique': Number(i.expected),
            Compté: Number(i.counted),
            Écart: Number(i.difference),
            'Prix achat': Number(i.unit_cost),
            'Valeur écart': Number(i.difference) * Number(i.unit_cost),
          })),
        },
      ],
      `inventaire-${detail.number}.xlsx`
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader icon={ClipboardCheck} badge={ScanSearch} title="Inventaire" subtitle="Comptez les rayons : les écarts avec le stock théorique sont corrigés et tracés">
        <div role="tablist" aria-label="Vue" className="flex items-center gap-1 rounded-full bg-white dark:bg-darkcard p-1.5 shadow-card border border-gray-200/70 dark:border-white/[0.06]">
          {[
            { value: 'count', label: 'Comptage', icon: ListChecks },
            { value: 'history', label: `Historique (${inventories.length})`, icon: History },
          ].map((t) => {
            const active = tab === t.value
            const TabIcon = t.icon
            return (
              <button
                key={t.value}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.value)}
                className={`flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2.5 text-sm font-semibold transition-colors ${
                  active ? 'bg-[#13306f] text-white shadow-sm' : 'text-brand-900 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/[0.06]'
                }`}
              >
                <TabIcon size={16} /> {t.label}
              </button>
            )
          })}
        </div>
      </PageHeader>

      {tab === 'count' ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <StatCard featured icon={ClipboardCheck} label="Produits comptés" value={`${summary.counted} / ${products.length}`} />
            <StatCard icon={AlertTriangle} color="amber" label="Écarts trouvés" value={summary.gaps} />
            <StatCard icon={History} color={summary.value < 0 ? 'red' : 'emerald'} label="Valeur des écarts" value={currency(summary.value)} sub="au prix d'achat" />
            <StatCard icon={Lock} color="brand" label="Validation" value={isAdmin ? 'Admin' : 'Réservée'} sub={isAdmin ? 'Vous pouvez valider' : "Seul l'admin valide"} />
          </div>

          {Object.keys(counts).length > 0 && (
            <Callout tone="amber" title="Comptage en cours">
              Votre saisie est enregistrée sur cet appareil : vous pouvez fermer la page et reprendre plus tard. Le stock n'est modifié qu'à la validation.
            </Callout>
          )}

          <div className="flex flex-col lg:flex-row lg:items-center gap-3">
            <div className="relative flex-1">
              <Search size={18} className="search-icon" />
              <input className="search-field" placeholder="Rechercher un produit…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <select className="filter-select lg:w-60" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} aria-label="Rayon / catégorie">
              <option value="">Tous les rayons</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <label className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 shrink-0">
              <input type="checkbox" className="h-4 w-4 rounded accent-brand-900" checked={onlyCounted} onChange={(e) => setOnlyCounted(e.target.checked)} />
              Seulement les produits comptés
            </label>
            <div className="flex gap-2 lg:ml-auto">
              <button type="button" className="btn-soft" onClick={fillVisibleWithTheoretical} title="Remplit les cases vides avec le stock théorique, pour ne corriger que les écarts">
                Pré-remplir
              </button>
              {Object.keys(counts).length > 0 && (
                <button type="button" className="btn-ghost" onClick={() => setCounts({})}>
                  <RotateCcw size={15} /> Tout effacer
                </button>
              )}
            </div>
          </div>

          <div className="panel overflow-hidden">
            <PanelTitle icon={ListChecks} title="Feuille de comptage">
              <InfoChip>{summary.counted} / {products.length} comptés</InfoChip>
              {summary.gaps > 0 && <InfoChip tone="amber">{summary.gaps} écart{summary.gaps > 1 ? 's' : ''}</InfoChip>}
            </PanelTitle>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-white/[0.06]">
                    <th className="table-th">Produit</th>
                    <th className="table-th text-right">Stock théorique</th>
                    <th className="table-th text-center">Quantité comptée</th>
                    <th className="table-th text-center">Écart</th>
                    <th className="table-th text-right hidden md:table-cell">Valeur écart</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/[0.06]">
                  {isLoading ? (
                    <tr><td colSpan={5} className="table-td text-center text-gray-400 py-10">Chargement…</td></tr>
                  ) : rows.length === 0 ? (
                    <tr><td colSpan={5} className="table-td text-center text-gray-400 py-10">Aucun produit ne correspond.</td></tr>
                  ) : (
                    rows.slice(0, 300).map(({ product: p, raw, invalid, diff }) => (
                      <tr key={p.id} className={diff ? 'bg-amber-50/40 dark:bg-amber-500/[0.04]' : ''}>
                        <td className="table-td">
                          <p className="font-medium max-w-[260px] truncate">{p.name}</p>
                          <p className="text-xs text-gray-400">{p.categories?.name || 'Sans catégorie'}</p>
                        </td>
                        <td className="table-td text-right tabular">{formatQty(p.stock, p.unit)}</td>
                        <td className="table-td text-center">
                          <input
                            type="text"
                            inputMode={isDecimalUnit(p.unit) ? 'decimal' : 'numeric'}
                            aria-label={`Quantité comptée pour ${p.name}`}
                            className={`input !w-28 text-center tabular ${invalid ? '!border-red-400' : ''}`}
                            placeholder="—"
                            value={raw}
                            onChange={(e) => setCount(p.id, e.target.value.replace(/[^\d.,]/g, ''))}
                          />
                        </td>
                        <td className="table-td text-center"><GapCell diff={diff} unit={p.unit} /></td>
                        <td className={`table-td text-right tabular hidden md:table-cell ${diff < 0 ? 'text-red-600 dark:text-red-400' : ''}`}>
                          {diff ? currency(diff * Number(p.purchase_price || 0)) : '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {rows.length > 300 && (
              <p className="px-5 py-3 text-xs text-center text-gray-500 border-t border-gray-100 dark:border-white/[0.06]">
                300 premiers produits affichés sur {rows.length} : filtrez par rayon ou recherchez pour voir les autres.
              </p>
            )}
          </div>

          {/* Barre de validation */}
          <div className="sticky -bottom-5 lg:-bottom-7 -mx-4 lg:-mx-8 px-4 lg:px-8 py-3 bg-white/95 dark:bg-darkcard/95 backdrop-blur border-t border-gray-200 dark:border-white/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              <strong>{summary.counted}</strong> produit(s) compté(s) · <strong>{summary.gaps}</strong> écart(s) ·{' '}
              <strong className={summary.value < 0 ? 'text-red-600 dark:text-red-400' : ''}>{currency(summary.value)}</strong>
              {summary.invalid > 0 && <span className="text-red-600 dark:text-red-400"> · {summary.invalid} saisie(s) invalide(s)</span>}
            </p>
            <button
              type="button"
              className="btn-accent"
              disabled={!isAdmin || summary.counted === 0 || summary.invalid > 0}
              title={!isAdmin ? "Seul un administrateur peut valider l'inventaire" : undefined}
              onClick={() => setConfirmOpen(true)}
            >
              <CheckCircle2 size={16} /> Valider l’inventaire
            </button>
          </div>
        </>
      ) : (
        <div className="panel overflow-hidden">
          <PanelTitle icon={History} title="Inventaires validés">
            <InfoChip>{inventories.length} inventaire{inventories.length > 1 ? 's' : ''}</InfoChip>
          </PanelTitle>
          {inventories.length === 0 ? (
            <div className="p-12 text-center">
              <ClipboardCheck size={28} className="mx-auto text-gray-300" />
              <p className="font-medium mt-2">Aucun inventaire validé</p>
              <p className="text-sm text-gray-500 mt-0.5">Comptez vos rayons dans l’onglet Comptage.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-white/[0.06]">
                    <th className="table-th">N°</th>
                    <th className="table-th">Date</th>
                    <th className="table-th text-right">Produits comptés</th>
                    <th className="table-th text-right">Écarts</th>
                    <th className="table-th text-right">Valeur des écarts</th>
                    <th className="table-th hidden md:table-cell">Par</th>
                    <th className="table-th"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/[0.06]">
                  {inventories.map((inv) => (
                    <tr key={inv.id} className="hover:bg-gray-50 dark:hover:bg-white/[0.03]">
                      <td className="table-td font-semibold">{inv.number}</td>
                      <td className="table-td text-gray-500">{new Date(inv.created_at).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })}</td>
                      <td className="table-td text-right">{inv.items_count}</td>
                      <td className="table-td text-right">{inv.gaps_count}</td>
                      <td className={`table-td text-right font-medium ${Number(inv.value_difference) < 0 ? 'text-red-600 dark:text-red-400' : ''}`}>{currency(inv.value_difference)}</td>
                      <td className="table-td text-gray-500 hidden md:table-cell">{displayName(inv.users?.full_name, '—')}</td>
                      <td className="table-td text-right"><ActionButton icon={Eye} title="Voir le détail" onClick={() => setDetail(inv)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Confirmation */}
      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} icon={ClipboardCheck} title="Valider l’inventaire" maxWidth="max-w-md">
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Le stock de <strong>{summary.counted}</strong> produit(s) va être remplacé par la quantité comptée.{' '}
            <strong>{summary.gaps}</strong> écart(s) seront enregistrés comme mouvements « Inventaire » (valeur : <strong>{currency(summary.value)}</strong>). Cette opération ne peut pas être annulée.
          </p>
          <div>
            <label className="label" htmlFor="inv-notes">Note <span className="text-gray-400 font-normal">(optionnel)</span></label>
            <input id="inv-notes" className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ex. inventaire de fin de mois, rayon électricité" />
          </div>
          <DetailActions>
            <button className="btn-secondary" onClick={() => setConfirmOpen(false)}>Retour</button>
            <button className="btn-accent" disabled={applyInventory.isPending} onClick={handleValidate}>
              {applyInventory.isPending ? 'Validation…' : 'Valider et corriger le stock'}
            </button>
          </DetailActions>
        </div>
      </Modal>

      {/* Détail d'un inventaire */}
      <Modal open={!!detail} onClose={() => setDetail(null)} icon={ClipboardCheck} title={detail ? `Inventaire ${detail.number}` : ''} maxWidth="max-w-3xl">
        {detail && (
          <div className="space-y-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {new Date(detail.created_at).toLocaleString('fr-FR')} · {detail.items_count} produit(s) compté(s) · {detail.gaps_count} écart(s)
              {detail.notes ? ` · ${detail.notes}` : ''}
            </p>
            <div className="border border-gray-200 dark:border-white/10 rounded-xl overflow-auto max-h-[55vh]">
              <table className="w-full text-sm">
                <thead className="sticky top-0">
                  <tr>
                    <th className="table-th">Produit</th>
                    <th className="table-th text-right">Théorique</th>
                    <th className="table-th text-right">Compté</th>
                    <th className="table-th text-center">Écart</th>
                    <th className="table-th text-right">Valeur</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/[0.06]">
                  {loadingDetail ? (
                    <tr><td colSpan={5} className="table-td text-center text-gray-400">Chargement…</td></tr>
                  ) : (
                    detailItems.map((i) => (
                      <tr key={i.id}>
                        <td className="table-td max-w-[240px] truncate">{i.product_name}</td>
                        <td className="table-td text-right">{formatQty(i.expected, i.unit)}</td>
                        <td className="table-td text-right">{formatQty(i.counted, i.unit)}</td>
                        <td className="table-td text-center"><GapCell diff={Number(i.difference)} unit={i.unit} /></td>
                        <td className="table-td text-right">{currency(Number(i.difference) * Number(i.unit_cost))}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <DetailActions>
              <button className="btn-secondary" disabled={!detailItems.length} onClick={exportDetail}>
                <FileSpreadsheet size={15} /> Exporter en Excel
              </button>
              <button className="btn-primary" onClick={() => setDetail(null)}>Fermer</button>
            </DetailActions>
          </div>
        )}
      </Modal>
    </div>
  )
}
