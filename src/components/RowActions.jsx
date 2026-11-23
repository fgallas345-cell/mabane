import { useState, useRef, useLayoutEffect, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { MoreVertical } from 'lucide-react'

const TONES = {
  gray: 'text-brand-900 dark:text-gray-200',
  emerald: 'text-emerald-700 dark:text-emerald-400',
  brand: 'text-[#1d4fb8] dark:text-blue-300',
  red: 'text-red-600 dark:text-red-400',
}

const MENU_WIDTH = 232

/**
 * Menu « ⋯ » d'actions d'une ligne de tableau.
 * items : [{ icon, label, onClick, tone, disabled }] — passer `false` pour masquer une entrée.
 * Le menu est rendu dans <body> (position fixe) : il n'est jamais coupé par le tableau.
 */
export default function RowActions({ items, label = 'Plus d’actions' }) {
  const list = items.filter(Boolean)
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const btnRef = useRef(null)
  const menuRef = useRef(null)

  const close = useCallback(() => setOpen(false), [])

  useLayoutEffect(() => {
    if (!open || !btnRef.current || !menuRef.current) return
    const r = btnRef.current.getBoundingClientRect()
    const h = menuRef.current.offsetHeight
    const left = Math.max(8, Math.min(r.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 8))
    // S'ouvre vers le haut s'il n'y a pas la place en dessous
    const top = r.bottom + 4 + h > window.innerHeight - 8 ? Math.max(8, r.top - h - 4) : r.bottom + 4
    setPos({ top, left })
  }, [open])

  useEffect(() => {
    if (!open) return
    const onDown = (e) => {
      if (menuRef.current?.contains(e.target) || btnRef.current?.contains(e.target)) return
      close()
    }
    const onKey = (e) => e.key === 'Escape' && close()
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [open, close])

  if (list.length === 0) return <span className="inline-block w-8" />

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation()
          setOpen((o) => !o)
        }}
        className={`h-9 w-9 shrink-0 rounded-xl flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 ${
          open
            ? 'bg-[#13306f] text-white'
            : 'bg-gray-100 text-brand-900 hover:bg-gray-200 dark:bg-white/[0.06] dark:text-gray-200 dark:hover:bg-white/[0.1]'
        }`}
      >
        <MoreVertical size={16} />
      </button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{ position: 'fixed', top: pos.top, left: pos.left, width: MENU_WIDTH }}
            className="z-50 card !rounded-2xl p-1.5 shadow-lift animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            {list.map((item) => (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onClick={() => {
                  close()
                  item.onClick?.()
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium rounded-xl text-left transition-colors hover:bg-gray-100 dark:hover:bg-white/[0.06] disabled:opacity-40 disabled:pointer-events-none ${
                  TONES[item.tone] || TONES.gray
                }`}
              >
                <item.icon size={16} className="shrink-0" />
                {item.label}
              </button>
            ))}
          </div>,
          document.body
        )}
    </>
  )
}
