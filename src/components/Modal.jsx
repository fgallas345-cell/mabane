import { createPortal } from 'react-dom'
import { useEffect, useId, useRef } from 'react'
import { X } from 'lucide-react'

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

// icon / subtitle (optionnels) : en-tête enrichi avec une pastille d'icône et une ligne d'aide
export default function Modal({ open, onClose, title, children, maxWidth = 'max-w-lg', icon: Icon, subtitle }) {
  const panelRef = useRef(null)
  const titleId = useId()
  // onClose est souvent une fonction inline (nouvelle à chaque rendu) : on la garde dans une ref
  // pour que l'effet ci-dessous ne se relance pas (et ne vole pas le focus) à chaque frappe.
  const onCloseRef = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose })

  // Échap pour fermer, Tab piégé dans la boîte de dialogue, focus initial sur le premier champ
  useEffect(() => {
    if (!open) return
    const previouslyFocused = document.activeElement
    const panel = panelRef.current
    // Focus initial sur le premier champ du contenu (jamais sur le bouton « Fermer »),
    // sinon sur la fenêtre elle-même : pas d'anneau de focus parasite à l'ouverture
    const firstField = [...(panel?.querySelectorAll(FOCUSABLE) || [])].find((el) => !el.hasAttribute('data-modal-close'))
    if (firstField) firstField.focus()
    else panel?.focus()

    const onKeyDown = (e) => {
      // Fenêtres empilées (ex. saisie du PIN au-dessus d'un détail) : seule celle du dessus réagit
      const dialogs = document.querySelectorAll('[role="dialog"]')
      if (dialogs.length && dialogs[dialogs.length - 1] !== panel) return
      if (e.key === 'Escape') {
        e.stopPropagation()
        onCloseRef.current?.()
        return
      }
      if (e.key !== 'Tab' || !panel) return
      const focusables = Array.from(panel.querySelectorAll(FOCUSABLE))
      if (focusables.length === 0) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      previouslyFocused?.focus?.()
    }
  }, [open])

  if (!open) return null
  // Rendue à la racine du document : sinon l'espacement des pages (space-y-*) décale le voile
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/50 animate-fade-in" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`relative w-full ${maxWidth} card !rounded-none !rounded-t-3xl sm:!rounded-3xl p-5 sm:p-6 max-h-[92vh] sm:max-h-[90vh] overflow-y-auto animate-pop-in focus:outline-none`}
      >
        <div className={`flex ${Icon ? 'items-start' : 'items-center'} justify-between gap-3 mb-4`}>
          {Icon ? (
            <div className="flex items-center gap-3.5 min-w-0">
              <span className="h-12 w-12 shrink-0 rounded-full bg-[#13306f] text-white flex items-center justify-center">
                <Icon size={22} />
              </span>
              <div className="min-w-0">
                <h3 id={titleId} className="text-xl font-bold tracking-tight text-brand-900 dark:text-gray-50">{title}</h3>
                {subtitle && <p className="text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>}
              </div>
            </div>
          ) : (
            <h3 id={titleId} className="text-lg font-semibold tracking-tight">{title}</h3>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            data-modal-close
            className="h-9 w-9 shrink-0 rounded-xl flex items-center justify-center bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-brand-900 dark:bg-white/[0.06] dark:text-gray-300 dark:hover:bg-white/[0.1] dark:hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  )
}
