// Choix exclusif en boutons côte à côte (plus rapide à lire et à toucher qu'une case à cocher).
export default function Segmented({ options, value, onChange, label, className = '' }) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={`grid gap-1 p-1 rounded-2xl bg-gray-100 dark:bg-white/[0.06] ${className}`}
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
            className={`px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 ${
              active
                ? 'bg-[#13306f] text-white shadow-sm'
                : 'text-brand-900 dark:text-gray-300 hover:bg-white/70 dark:hover:bg-white/[0.06]'
            }`}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
