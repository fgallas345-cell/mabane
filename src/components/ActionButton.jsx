// Petit bouton icône des tableaux (voir, modifier, supprimer...).
const TONES = {
  gray: 'bg-gray-100 text-brand-900 hover:bg-gray-200 dark:bg-white/[0.06] dark:text-gray-200 dark:hover:bg-white/[0.1]',
  emerald: 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:hover:bg-emerald-500/20',
  brand: 'bg-blue-50 text-[#1d4fb8] hover:bg-blue-100 dark:bg-blue-500/10 dark:text-blue-300 dark:hover:bg-blue-500/20',
  red: 'bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20',
}

export default function ActionButton({ icon: Icon, title, onClick, disabled, tone = 'gray' }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      className={`h-9 w-9 shrink-0 rounded-xl flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 disabled:opacity-30 disabled:pointer-events-none ${TONES[tone] || TONES.gray}`}
    >
      <Icon size={16} />
    </button>
  )
}
