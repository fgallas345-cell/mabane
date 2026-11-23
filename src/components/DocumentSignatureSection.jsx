import { useState } from 'react'
import { PenLine, BadgeCheck, AlertTriangle } from 'lucide-react'
import SignDocumentModal from './SignDocumentModal'
import { useDocumentSignature, useRevokeDocumentSignature } from '../hooks/useSignatures'
import { useToast } from '../context/ToastContext'
import { DOC_LABELS, formatSignedAt, isSignatureCurrent } from '../utils/signature'

/**
 * État de signature d'un document : « Signé par … le … », bouton Signer (admin) ou
 * Retirer la signature (admin).
 * - amount : montant actuel du document (null si sans objet) ; s'il diffère du montant
 *   signé, la signature n'apparaît plus sur le PDF.
 * - compact : version réduite pour les lignes de liste (bons de livraison, historique).
 */
export default function DocumentSignatureSection({ docType, docId, docLabel = DOC_LABELS[docType], amount = null, isAdmin, cancelled, compact = false }) {
  const toast = useToast()
  const id = docId == null ? null : String(docId)
  const { data: signature, isLoading, error } = useDocumentSignature(docType, id)
  const revoke = useRevokeDocumentSignature()
  const [signOpen, setSignOpen] = useState(false)
  const [confirmRevoke, setConfirmRevoke] = useState(false)

  // Migration non appliquée, document sans identifiant ou chargement : on n'affiche rien
  if (!id || isLoading || error) return null
  if (!signature && (!isAdmin || cancelled)) return null

  const handleRevoke = async () => {
    try {
      await revoke.mutateAsync({ docType, docId: id })
      toast.success('Signature retirée.')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setConfirmRevoke(false)
    }
  }

  const modal = (
    <SignDocumentModal open={signOpen} onClose={() => setSignOpen(false)} docType={docType} docId={id} docLabel={docLabel} />
  )

  if (!signature) {
    return compact ? (
      <>
        <button type="button" className="text-xs btn-secondary py-1 px-2" title={`Signer ${docLabel}`} onClick={() => setSignOpen(true)}>
          <PenLine size={12} /> Signer
        </button>
        {modal}
      </>
    ) : (
      <>
        <button type="button" className="btn-secondary w-full justify-center" onClick={() => setSignOpen(true)}>
          <PenLine size={15} /> Signer {docLabel}
        </button>
        {modal}
      </>
    )
  }

  const current = !cancelled && isSignatureCurrent(signature, amount)
  const warning = cancelled
    ? 'Document annulé : la signature n’apparaît plus sur le PDF.'
    : 'Le montant a changé depuis la signature : elle n’apparaît plus sur le PDF. Retirez-la puis signez à nouveau.'
  const toneCls = current
    ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-500/10 dark:border-emerald-500/30 dark:text-emerald-300'
    : 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-500/10 dark:border-amber-500/30 dark:text-amber-300'

  const revokeControls = isAdmin && (
    confirmRevoke ? (
      <span className="inline-flex items-center gap-1.5">
        <span className="text-xs">Retirer ?</span>
        <button type="button" className="btn-secondary !py-0.5 !px-2 text-xs" onClick={() => setConfirmRevoke(false)}>Non</button>
        <button type="button" className="btn-danger !py-0.5 !px-2 text-xs" onClick={handleRevoke} disabled={revoke.isPending}>Oui</button>
      </span>
    ) : (
      <button type="button" className="text-xs underline underline-offset-2 opacity-80 hover:opacity-100" onClick={() => setConfirmRevoke(true)}>
        Retirer la signature
      </button>
    )
  )

  if (compact) {
    return (
      <span className="inline-flex items-center gap-2">
        <span
          className={`badge border ${toneCls} inline-flex items-center gap-1`}
          title={`Signé par ${signature.signer_name} le ${formatSignedAt(signature.signed_at)}${current ? '' : ` — ${warning}`}`}
        >
          {current ? <BadgeCheck size={12} /> : <AlertTriangle size={12} />} Signé
        </span>
        {revokeControls}
      </span>
    )
  }

  return (
    <div className={`rounded-xl border px-3 py-2.5 text-sm space-y-2 ${toneCls}`}>
      <div className="flex items-start gap-2">
        {current ? <BadgeCheck size={16} className="mt-0.5 shrink-0" /> : <AlertTriangle size={16} className="mt-0.5 shrink-0" />}
        <div className="min-w-0">
          <p className="font-medium">Signé par {signature.signer_name}</p>
          <p className="text-xs opacity-80">le {formatSignedAt(signature.signed_at)}</p>
          {!current && <p className="text-xs mt-1">{warning}</p>}
        </div>
      </div>
      {revokeControls && <div className="flex justify-end">{revokeControls}</div>}
    </div>
  )
}
