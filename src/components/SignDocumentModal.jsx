import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PenLine, Lock } from 'lucide-react'
import Modal from './Modal'
import PinInput from './PinInput'
import { useMySignature, useSignDocument } from '../hooks/useSignatures'
import { useToast } from '../context/ToastContext'

/**
 * Demande le code PIN puis appose la signature de l'utilisateur connecté sur le document.
 * onSigned(signature) est appelé après succès (ex. pour proposer le téléchargement).
 */
export default function SignDocumentModal({ open, onClose, docType, docId, docLabel, onSigned }) {
  const toast = useToast()
  const { data: mine, isLoading } = useMySignature(open)
  const sign = useSignDocument()
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setPin('')
      setError('')
    }
  }, [open])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (pin.length !== 4) return setError('Saisissez les 4 chiffres de votre code PIN.')
    setError('')
    try {
      const signature = await sign.mutateAsync({ docType, docId, pin })
      toast.success('Document signé. Le PDF inclut maintenant votre signature.')
      onClose()
      onSigned?.(signature)
    } catch (err) {
      setPin('')
      setError(err.message)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Signer le document" icon={PenLine} maxWidth="max-w-sm">
      {isLoading ? (
        <p className="text-sm text-gray-400">Chargement…</p>
      ) : !mine?.configured ? (
        <div className="space-y-3 text-sm">
          <p>Vous n'avez pas encore enregistré de signature.</p>
          <Link to="/parametres" className="btn-primary w-full justify-center" onClick={onClose}>
            Configurer ma signature
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-white p-3 flex justify-center">
            <img src={mine.image} alt="Votre signature" className="h-16 object-contain" />
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Votre signature sera apposée sur <span className="font-medium text-gray-700 dark:text-gray-200">{docLabel}</span>.
          </p>
          <PinInput id="sign-pin" label="Code PIN" value={pin} onChange={setPin} autoFocus disabled={sign.isPending} />
          {error && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400 flex items-start gap-1.5">
              <Lock size={14} className="mt-0.5 shrink-0" /> {error}
            </p>
          )}
          <div className="flex gap-2">
            <button type="button" className="btn-secondary flex-1" onClick={onClose}>Annuler</button>
            <button type="submit" className="btn-primary flex-1" disabled={sign.isPending || pin.length !== 4}>
              <PenLine size={15} /> {sign.isPending ? 'Signature…' : 'Signer'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  )
}
