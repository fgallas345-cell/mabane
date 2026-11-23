// Briques communes des fenêtres « Détail » : même en-tête, mêmes lignes, mêmes actions partout.

/** En-tête : pastille/avatar + titre + sous-titre, badges alignés à droite */
export function DetailHeader({ avatar, title, subtitle, children }) {
  return (
    <div className="flex items-center gap-3">
      {avatar}
      <div className="min-w-0 flex-1">
        <p className="text-lg font-bold text-brand-900 dark:text-gray-50 truncate">{title}</p>
        {subtitle && <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center justify-end gap-1.5 shrink-0">{children}</div>}
    </div>
  )
}

/** Cadre qui regroupe des lignes libellé / valeur */
export function DetailList({ title, children }) {
  return (
    <div className="border border-gray-200/80 dark:border-white/[0.08] rounded-2xl overflow-hidden bg-white dark:bg-white/[0.02]">
      {title && (
        <p className="px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-brand-900 dark:text-gray-300 bg-gray-50/80 dark:bg-white/[0.03] border-b border-gray-200/80 dark:border-white/[0.08]">
          {title}
        </p>
      )}
      <dl className="divide-y divide-gray-100 dark:divide-white/[0.06]">{children}</dl>
    </div>
  )
}

export function DetailRow({ label, children, strong, tone }) {
  const color = tone === 'red' ? 'text-red-600 dark:text-red-400' : tone === 'emerald' ? 'text-emerald-600 dark:text-emerald-400' : 'text-brand-900 dark:text-gray-100'
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
      <dt className="text-gray-600 dark:text-gray-400">{label}</dt>
      <dd className={`text-right tabular-nums ${strong ? 'font-extrabold text-base' : 'font-semibold'} ${color}`}>{children}</dd>
    </div>
  )
}

/** Bandeau d'information (devis, annulation, remarque) */
export function Callout({ tone = 'gray', title, children }) {
  const tones = {
    gray: 'bg-gray-50 border-gray-200 text-gray-600 dark:bg-white/[0.04] dark:border-white/10 dark:text-gray-300',
    blue: 'bg-blue-50 border-blue-200 text-[#1d4fb8] dark:bg-blue-500/10 dark:border-blue-500/30 dark:text-blue-200',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-500/10 dark:border-emerald-500/30 dark:text-emerald-300',
    red: 'bg-red-50 border-red-200 text-red-700 dark:bg-red-500/10 dark:border-red-500/30 dark:text-red-400',
    purple: 'bg-purple-50 border-purple-200 text-purple-700 dark:bg-purple-500/10 dark:border-purple-500/30 dark:text-purple-300',
    amber: 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-500/10 dark:border-amber-500/30 dark:text-amber-400',
  }
  return (
    <div className={`rounded-2xl border px-4 py-3 text-sm ${tones[tone]}`}>
      {title && <p className="font-bold">{title}</p>}
      {children && <p className={`text-xs ${title ? 'mt-0.5 opacity-90' : ''}`}>{children}</p>}
    </div>
  )
}

/** Boutons d'action en pied de fenêtre */
export function DetailActions({ children }) {
  return <div className="flex flex-col-reverse sm:flex-row sm:flex-wrap sm:justify-end gap-2.5 pt-4 mt-1 border-t border-gray-100 dark:border-white/[0.06]">{children}</div>
}
