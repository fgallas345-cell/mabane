import { Minus, Plus } from 'lucide-react'

// Quantité avec boutons − / + (gros boutons faciles à toucher, saisie directe possible).
export default function QtyStepper({ value, onChange, min = 1, max, invalid = false, label = 'Quantité' }) {
  const n = Number(value) || 0
  const set = (v) => {
    let next = Math.floor(Number(v))
    if (Number.isNaN(next)) next = min
    next = Math.max(min, next)
    if (max !== undefined && max !== null) next = Math.min(max, next)
    onChange(next)
  }
  return (
    <div className="inline-flex items-center rounded-lg border border-gray-300 dark:border-gray-700 overflow-hidden bg-white dark:bg-gray-900">
      <button
        type="button"
        aria-label="Diminuer la quantité"
        className="h-9 w-9 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30"
        disabled={n <= min}
        onClick={() => set(n - 1)}
      >
        <Minus size={15} />
      </button>
      <input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        aria-label={label}
        className={`h-9 w-14 text-center text-sm font-medium bg-transparent outline-none border-x border-gray-300 dark:border-gray-700 tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none ${invalid ? 'text-red-600' : ''}`}
        value={value}
        onFocus={(e) => e.target.select()}
        onChange={(e) => set(e.target.value)}
      />
      <button
        type="button"
        aria-label="Augmenter la quantité"
        className="h-9 w-9 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30"
        disabled={max !== undefined && max !== null && n >= max}
        onClick={() => set(n + 1)}
      >
        <Plus size={15} />
      </button>
    </div>
  )
}
