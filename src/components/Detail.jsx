// Briques communes des fenêtres « Détail » : même en-tête, mêmes lignes, mêmes actions partout.

/** En-tête : pastille/avatar + titre + sous-titre, badges alignés à droite */
export function DetailHeader({ avatar, title, subtitle, children }) {
  return (
    <div className="flex items-center gap-3">
      {avatar}
      <div className="min-w-0 flex-1">
        <p className="font-semibold truncate">{title}</p>
        {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center justify-end gap-1.5 shrink-0">{children}</div>}
    </div>
  )
}

/** Cadre qui regroupe des lignes libellé / valeur */
export function DetailList({ title, children }) {
  return (
    <div className="border border-gray-200 dark:border-gray-700/60 rounded-lg overflow-hidden">
      {title && (
        <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700/60">
          {title}
        </p>
      )}
      <dl className="divide-y divide-gray-100 dark:divide-gray-800">{children}</dl>
    </div>
  )
}

export function DetailRow({ label, children, strong, tone }) {
  const color = tone === 'red' ? 'text-red-500' : tone === 'emerald' ? 'text-emerald-600 dark:text-emerald-400' : ''
  return (
    <div className="flex items-center justify-between gap-4 px-3 py-2.5 text-sm">
      <dt className="text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className={`text-right tabular-nums ${strong ? 'font-semibold' : 'font-medium'} ${color}`}>{children}</dd>
    </div>
  )
}

/** Bandeau d'information (devis, annulation, remarque) */
export function Callout({ tone = 'gray', title, children }) {
  const tones = {
    gray: 'bg-gray-50 border-gray-200 text-gray-600 dark:bg-gray-800/50 dark:border-gray-700 dark:text-gray-300',
    red: 'bg-red-50 border-red-200 text-red-700 dark:bg-red-500/10 dark:border-red-500/30 dark:text-red-400',
    purple: 'bg-purple-50 border-purple-200 text-purple-700 dark:bg-purple-500/10 dark:border-purple-500/30 dark:text-purple-300',
    amber: 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-500/10 dark:border-amber-500/30 dark:text-amber-400',
  }
  return (
    <div className={`rounded-lg border px-3 py-2.5 text-sm ${tones[tone]}`}>
      {title && <p className="font-medium">{title}</p>}
      {children && <p className={`text-xs ${title ? 'mt-0.5 opacity-90' : ''}`}>{children}</p>}
    </div>
  )
}

/** Boutons d'action en pied de fenêtre */
export function DetailActions({ children }) {
  return <div className="flex flex-col-reverse sm:flex-row sm:flex-wrap sm:justify-end gap-2 pt-1">{children}</div>
}
