import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Upload, Download, FileSpreadsheet, CheckCircle2, AlertTriangle } from 'lucide-react'
import Modal from '../../components/Modal'
import { DetailActions, Callout } from '../../components/Detail'
import { useToast } from '../../context/ToastContext'
import { supabase } from '../../lib/supabase'
import { currency } from '../../lib/constants'
import { formatQty } from '../../utils/quantity'
import { analyzeImport, readSpreadsheet, applyImport, downloadImportTemplate } from '../../utils/productImport'

const ACTION_BADGE = {
  create: { label: 'Nouveau', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400' },
  update: { label: 'Mise à jour', cls: 'bg-blue-50 text-[#1d4fb8] dark:bg-blue-500/15 dark:text-blue-300' },
  error: { label: 'Erreur', cls: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400' },
}

// Import du catalogue : 1. choisir le fichier · 2. vérifier l'aperçu · 3. importer
export default function ProductImport({ open, onClose, products, categories }) {
  const toast = useToast()
  const queryClient = useQueryClient()
  const inputRef = useRef(null)
  const [fileName, setFileName] = useState('')
  const [analysis, setAnalysis] = useState(null)
  const [readError, setReadError] = useState('')
  const [progress, setProgress] = useState(null)
  const [result, setResult] = useState(null)

  const reset = () => {
    setFileName('')
    setAnalysis(null)
    setReadError('')
    setProgress(null)
    setResult(null)
    if (inputRef.current) inputRef.current.value = ''
  }
  const close = () => {
    if (progress) return // import en cours : on ne ferme pas
    reset()
    onClose()
  }

  const handleFile = async (file) => {
    if (!file) return
    reset()
    setFileName(file.name)
    try {
      const rows = await readSpreadsheet(file)
      if (!rows.length) return setReadError('Le fichier ne contient aucune ligne.')
      setAnalysis(analyzeImport(rows, products))
    } catch {
      setReadError('Fichier illisible : utilisez un fichier Excel (.xlsx, .xls) ou CSV.')
    }
  }

  const counts = analysis
    ? {
        create: analysis.rows.filter((r) => r.action === 'create').length,
        update: analysis.rows.filter((r) => r.action === 'update').length,
        error: analysis.rows.filter((r) => r.action === 'error').length,
      }
    : null

  const handleImport = async () => {
    setProgress({ done: 0, total: counts.create + counts.update })
    try {
      const res = await applyImport(supabase, analysis.rows, categories, (done, total) => setProgress({ done, total }))
      setResult(res)
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      queryClient.invalidateQueries({ queryKey: ['stock_movements'] })
      if (!res.failures.length) toast.success(`${res.created} produit(s) créé(s), ${res.updated} mis à jour.`)
    } catch (err) {
      toast.error(err.message || 'Import interrompu.')
    } finally {
      setProgress(null)
    }
  }

  return (
    <Modal open={open} onClose={close} icon={Upload} title="Importer des produits depuis Excel" maxWidth="max-w-3xl">
      <div className="space-y-4">
        {result ? (
          <div className="space-y-4">
            <div className="flex flex-col items-center text-center gap-2 py-2">
              <CheckCircle2 size={40} className="text-emerald-500" />
              <p className="font-semibold">Import terminé</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {result.created} produit(s) créé(s) · {result.updated} mis à jour
                {result.failures.length > 0 && ` · ${result.failures.length} en échec`}
              </p>
            </div>
            {result.failures.length > 0 && (
              <div className="rounded-xl border border-red-200 dark:border-red-500/30 max-h-48 overflow-y-auto text-sm">
                {result.failures.map((f) => (
                  <p key={`${f.line}-${f.name}`} className="px-3 py-2 border-b last:border-0 border-red-100 dark:border-red-500/20">
                    Ligne {f.line} · <strong>{f.name}</strong> : {f.error}
                  </p>
                ))}
              </div>
            )}
            <DetailActions>
              <button className="btn-secondary" onClick={reset}>Importer un autre fichier</button>
              <button className="btn-primary" onClick={close}>Terminer</button>
            </DetailActions>
          </div>
        ) : (
          <>
            <ol className="grid sm:grid-cols-3 gap-2 text-sm">
              {['Téléchargez le modèle (ou exportez votre catalogue)', 'Remplissez-le dans Excel', 'Choisissez le fichier et vérifiez'].map((step, i) => (
                <li key={step} className="flex gap-2 rounded-xl bg-gray-50 dark:bg-white/[0.04] p-3">
                  <span className="h-6 w-6 shrink-0 rounded-full bg-brand-900 text-white text-xs font-bold flex items-center justify-center">{i + 1}</span>
                  <span className="text-gray-600 dark:text-gray-300">{step}</span>
                </li>
              ))}
            </ol>

            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-secondary" onClick={() => downloadImportTemplate()}>
                <Download size={15} /> Télécharger le modèle
              </button>
              <label className="btn-primary cursor-pointer">
                <Upload size={15} /> Choisir un fichier
                <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" className="sr-only" onChange={(e) => handleFile(e.target.files?.[0])} />
              </label>
              {fileName && <span className="self-center text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1.5"><FileSpreadsheet size={15} /> {fileName}</span>}
            </div>

            <Callout tone="gray" title="Comment c'est importé">
              Colonnes reconnues : Nom, Catégorie, Unité, Prix achat, Prix vente, Stock, Seuil. Un produit qui existe déjà (même nom) voit ses prix, son unité, sa catégorie et son seuil mis à jour — son stock ne change pas (utilisez Stock ou Inventaire). Les catégories inconnues sont créées.
            </Callout>

            {readError && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{readError}</p>}

            {analysis?.missingColumns.length > 0 && (
              <Callout tone="red" title="Colonnes obligatoires introuvables">
                Le fichier doit contenir au moins les colonnes « Nom » et « Prix vente ». Téléchargez le modèle pour voir le format attendu.
              </Callout>
            )}

            {analysis && analysis.rows.length > 0 && (
              <>
                <div className="flex flex-wrap gap-2 text-sm">
                  <span className={`badge ${ACTION_BADGE.create.cls}`}>{counts.create} nouveau(x)</span>
                  <span className={`badge ${ACTION_BADGE.update.cls}`}>{counts.update} mise(s) à jour</span>
                  {counts.error > 0 && <span className={`badge ${ACTION_BADGE.error.cls}`}><AlertTriangle size={12} /> {counts.error} ligne(s) en erreur, ignorée(s)</span>}
                </div>
                <div className="border border-gray-200 dark:border-white/10 rounded-xl overflow-hidden">
                  <div className="overflow-auto max-h-[42vh]">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0">
                        <tr>
                          <th className="table-th">Ligne</th>
                          <th className="table-th">Produit</th>
                          <th className="table-th">Catégorie</th>
                          <th className="table-th text-right">Achat</th>
                          <th className="table-th text-right">Vente</th>
                          <th className="table-th text-right">Stock</th>
                          <th className="table-th">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-white/[0.06]">
                        {analysis.rows.map((r) => (
                          <tr key={r.line} className={r.action === 'error' ? 'bg-red-50/50 dark:bg-red-500/5' : ''}>
                            <td className="table-td text-gray-400">{r.line}</td>
                            <td className="table-td max-w-[220px] truncate font-medium">{r.data.name}</td>
                            <td className="table-td text-gray-500">{r.data.category || '—'}</td>
                            <td className="table-td text-right">{r.data.purchase_price != null && !Number.isNaN(r.data.purchase_price) ? currency(r.data.purchase_price) : '—'}</td>
                            <td className="table-td text-right">{r.data.sale_price != null && !Number.isNaN(r.data.sale_price) ? currency(r.data.sale_price) : '—'}</td>
                            <td className="table-td text-right">
                              {r.action === 'update' ? <span className="text-gray-400" title="Le stock d'un produit existant n'est pas modifié par l'import">inchangé</span> : formatQty(r.data.stock ?? 0, r.data.unit)}
                            </td>
                            <td className="table-td">
                              <span className={`badge ${ACTION_BADGE[r.action].cls}`}>{ACTION_BADGE[r.action].label}</span>
                              {r.errors.length > 0 && <span className="block text-xs text-red-600 dark:text-red-400 mt-0.5 whitespace-normal">{r.errors.join(', ')}</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

            <DetailActions>
              <button type="button" className="btn-secondary" onClick={close} disabled={!!progress}>Annuler</button>
              <button
                type="button"
                className="btn-accent"
                disabled={!analysis || !counts || counts.create + counts.update === 0 || !!progress}
                onClick={handleImport}
              >
                <Upload size={15} />
                {progress ? `Import… ${progress.done}/${progress.total}` : counts ? `Importer ${counts.create + counts.update} produit(s)` : 'Importer'}
              </button>
            </DetailActions>
          </>
        )}
      </div>
    </Modal>
  )
}
