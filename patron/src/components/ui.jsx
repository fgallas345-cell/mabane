// Briques visuelles communes à tous les écrans de « Mabane Patron »
import { AlertCircle } from 'lucide-react'

/** Silhouette de bâtiments, en décor des en-têtes bleus */
export function Skyline({ className = '' }) {
  return (
    <svg viewBox="0 0 220 120" className={className} aria-hidden="true">
      <g fill="#ffffff" opacity="0.08">
        <rect x="10" y="60" width="26" height="60" rx="2" />
        <rect x="40" y="30" width="34" height="90" rx="2" />
        <rect x="78" y="48" width="22" height="72" rx="2" />
        <rect x="104" y="12" width="40" height="108" rx="2" />
        <rect x="148" y="40" width="28" height="80" rx="2" />
        <rect x="180" y="66" width="30" height="54" rx="2" />
      </g>
      <g fill="#ffffff" opacity="0.1">
        {[0, 1, 2, 3, 4, 5].map((r) => [0, 1, 2].map((c) => <rect key={`${r}-${c}`} x={110 + c * 11} y={22 + r * 14} width="6" height="8" rx="1" />))}
        {[0, 1, 2, 3, 4].map((r) => [0, 1].map((c) => <rect key={`b${r}-${c}`} x={46 + c * 14} y={40 + r * 14} width="7" height="8" rx="1" />))}
      </g>
    </svg>
  )
}

/** Logo Mabane dans un cercle blanc */
export function Logo({ className = 'h-14 w-14' }) {
  return <img src="/logo.png" alt="Logo Mabane" className={`${className} shrink-0 rounded-full bg-white object-cover ring-4 ring-white/20`} />
}

/** Icône dans un cercle blanc (à la place du logo) */
export function HeaderIcon({ icon: Icon }) {
  return (
    <span className="h-14 w-14 shrink-0 rounded-full bg-white text-navy-700 flex items-center justify-center ring-4 ring-white/20">
      <Icon size={26} className="fill-navy-700/90" />
    </span>
  )
}

/**
 * En-tête commun : dégradé bleu roi → marine, silhouette de bâtiments, bas en vague.
 * - visual : <Logo /> ou <HeaderIcon icon={...} />
 * - title / subtitle : texte (title peut contenir du JSX)
 * - actions : boutons ronds à droite (classe .header-btn)
 * - overlap : espace sous l'en-tête pour une carte qui chevauche (accueil)
 */
export function ScreenHeader({ visual, title, subtitle, actions, overlap = false }) {
  return (
    <header className={`safe-top relative overflow-hidden bg-gradient-to-br from-navy-500 via-navy-600 to-navy-800 text-white px-5 ${overlap ? 'pb-24' : 'pb-10'}`}>
      <Skyline className="pointer-events-none absolute right-0 top-2 h-36 w-60" />
      <div className="relative flex items-center gap-3 pt-5">
        {visual}
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-extrabold leading-tight truncate">{title}</h1>
          {subtitle && <p className="text-sm text-white/75 leading-snug">{subtitle}</p>}
        </div>
        {actions && <div className="flex gap-2 shrink-0">{actions}</div>}
      </div>
      <svg viewBox="0 0 400 40" preserveAspectRatio="none" className="absolute inset-x-0 -bottom-px h-8 w-full" aria-hidden="true">
        <path d="M0 40 L0 22 C 90 4, 200 34, 300 16 S 380 8, 400 14 L400 40 Z" fill="#f3f6fb" />
      </svg>
    </header>
  )
}

/** Message d'erreur avec bouton « Réessayer » */
export function ErrorBox({ message, onRetry }) {
  return (
    <div role="alert" className="rounded-3xl p-4 text-sm text-red-700 bg-red-50 border border-red-200 flex gap-2.5">
      <AlertCircle size={18} className="shrink-0 mt-0.5" />
      <div>
        {message}
        {onRetry && (
          <button type="button" className="block mt-1.5 font-semibold underline" onClick={onRetry}>
            Réessayer
          </button>
        )}
      </div>
    </div>
  )
}

/** Liste vide */
export function Empty({ children }) {
  return <p className="card p-6 text-center text-sm text-gray-500">{children}</p>
}

/** « … » animé pendant un calcul */
export function TypingDots({ label = 'Je calcule…' }) {
  return (
    <div className="card px-5 py-4 flex items-center gap-1.5 w-fit" aria-label={label}>
      {[0, 1, 2].map((d) => (
        <span key={d} className="h-2 w-2 rounded-full bg-navy-500 animate-bounce" style={{ animationDelay: `${d * 0.15}s` }} />
      ))}
      <span className="ml-2 text-xs text-gray-500">{label}</span>
    </div>
  )
}
