import { AlertTriangle } from 'lucide-react'
import Modal from './Modal'

// confirmLabel / loadingLabel : le bouton dit ce qu'il fait ("Supprimer", "Annuler l'achat"...)
export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title = 'Confirmer',
  message,
  loading,
  confirmLabel = 'Supprimer',
  loadingLabel = 'Suppression...',
  cancelLabel = 'Retour',
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} maxWidth="max-w-sm">
      <div className="flex items-start gap-3 mb-6">
        <div className="p-2 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 shrink-0">
          <AlertTriangle size={20} />
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{message}</p>
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={onClose}>{cancelLabel}</button>
        <button type="button" className="btn-danger" onClick={onConfirm} disabled={loading}>
          {loading ? loadingLabel : confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
