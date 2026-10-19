// Choix exclusif en boutons côte à côte (plus rapide à lire et à toucher qu'une case à cocher).
export default function Segmented({ options, value, onChange, label, className = '' }) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={`grid gap-1 p-1 rounded-lg bg-gray-100 dark:bg-gray-800 ${className}`}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            className={`px-3 py-2 rounded-md text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
              active
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
