import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { CheckCircle2, Info, AlertTriangle, XCircle, X } from 'lucide-react'

const ToastContext = createContext(null)
let nextToastId = 1

const TOAST_DURATION = 4000

const toastStyles = {
  success: 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-500/10 dark:border-emerald-500/30 dark:text-emerald-100',
  error: 'bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-500/10 dark:border-rose-500/30 dark:text-rose-100',
  warning: 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-500/10 dark:border-amber-500/30 dark:text-amber-100',
  info: 'bg-sky-50 border-sky-200 text-sky-700 dark:bg-sky-500/10 dark:border-sky-500/30 dark:text-sky-100',
}

const toastIcons = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const closeToast = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const pushToast = useCallback((type, message, options = {}) => {
    const id = nextToastId++
    const toast = {
      id,
      type,
      message,
      duration: options.duration ?? TOAST_DURATION,
    }
    setToasts((current) => [...current, toast])

    if (toast.duration > 0) {
      window.setTimeout(() => closeToast(id), toast.duration)
    }

    return id
  }, [closeToast])

  const value = useMemo(
    () => ({
      success: (message, options) => pushToast('success', message, options),
      error: (message, options) => pushToast('error', message, options),
      warning: (message, options) => pushToast('warning', message, options),
      info: (message, options) => pushToast('info', message, options),
    }),
    [pushToast]
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed inset-x-0 top-4 z-50 flex flex-col items-center gap-3 px-4 pointer-events-none sm:top-5">
        {toasts.map((toast) => {
          const Icon = toastIcons[toast.type] || Info
          return (
            <div
              key={toast.id}
              className={`pointer-events-auto w-full max-w-xl rounded-2xl border px-4 py-3 shadow-lg backdrop-blur-sm ${toastStyles[toast.type]}`}
              role="status"
              aria-live="polite"
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  <Icon size={18} />
                </div>
                <div className="min-w-0 text-sm leading-snug">{toast.message}</div>
                <button
                  type="button"
                  onClick={() => closeToast(toast.id)}
                  className="ml-auto text-gray-500 hover:text-gray-700 dark:text-gray-300 dark:hover:text-white"
                  aria-label="Fermer la notification"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}
