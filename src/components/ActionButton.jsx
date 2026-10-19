// Petit bouton icône des tableaux (voir, modifier, supprimer...).
const TONES = {
  gray: 'text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200',
  emerald: 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10',
  brand: 'text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-500/10',
  red: 'text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10',
}

export default function ActionButton({ icon: Icon, title, onClick, disabled, tone = 'gray' }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      className={`p-2 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:opacity-30 disabled:pointer-events-none ${TONES[tone] || TONES.gray}`}
    >
      <Icon size={16} />
    </button>
  )
}
