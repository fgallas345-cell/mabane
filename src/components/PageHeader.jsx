// En-tête commun des pages : illustration, titre, sous-titre et actions (à droite).
// L'illustration est composée d'une tache bleue, d'une tuile marine portant l'icône de la page
// et d'une pastille orange : même style partout, sans image externe.

export function PageIllustration({ icon: Icon, badge: Badge, className = '' }) {
  return (
    <div className={`relative h-24 w-32 shrink-0 ${className}`} aria-hidden="true">
      <svg viewBox="0 0 128 96" className="absolute inset-0 h-full w-full">
        <ellipse cx="64" cy="52" rx="62" ry="40" fill="#dfe9fb" className="dark:opacity-20" />
        <ellipse cx="64" cy="88" rx="40" ry="5" fill="#1e3a7b" opacity="0.08" />
        <circle cx="16" cy="22" r="4" fill="#f39e26" opacity="0.6" />
        <circle cx="114" cy="30" r="3" fill="#3b6fe0" opacity="0.5" />
      </svg>
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-[55%] h-16 w-16 rounded-2xl bg-gradient-to-br from-[#2b5c94] to-[#13306f] text-white shadow-[0_10px_20px_-8px_rgba(19,48,111,0.7)] flex items-center justify-center rotate-[-4deg]">
        <Icon size={32} strokeWidth={2} />
      </div>
      {Badge && (
        <div className="absolute right-4 bottom-3 h-9 w-9 rounded-full bg-accent-500 text-white ring-4 ring-[#f3f6fb] dark:ring-darkbg flex items-center justify-center">
          <Badge size={17} strokeWidth={2.5} />
        </div>
      )}
    </div>
  )
}

export default function PageHeader({ icon, badge, title, subtitle, children }) {
  return (
    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
      <div className="flex items-center gap-4 min-w-0">
        {icon && <PageIllustration icon={icon} badge={badge} className="hidden sm:block" />}
        <div className="min-w-0">
          <h1 className="page-title">{title}</h1>
          {subtitle && <p className="page-subtitle">{subtitle}</p>}
        </div>
      </div>
      {children && <div className="flex flex-wrap items-center gap-3">{children}</div>}
    </div>
  )
}

/** Titre de section dans un panneau : pastille d'icône bleue + titre, et à droite des pastilles d'info */
export function PanelTitle({ icon: Icon, title, children }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
      <h2 className="flex items-center gap-2.5 text-lg font-bold text-brand-900 dark:text-gray-50">
        {Icon && (
          <span className="h-8 w-8 rounded-full bg-[#1d4fb8] text-white flex items-center justify-center">
            <Icon size={16} />
          </span>
        )}
        {title}
      </h2>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  )
}

/** Pastille d'information (compteur, total…) */
export function InfoChip({ tone = 'blue', children, title }) {
  const tones = {
    blue: 'bg-blue-50 text-[#1d4fb8] dark:bg-blue-500/15 dark:text-blue-200',
    red: 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400',
    amber: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
    green: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
  }
  return (
    <span title={title} className={`rounded-full px-3.5 py-1.5 text-xs font-semibold ${tones[tone]}`}>
      {children}
    </span>
  )
}
