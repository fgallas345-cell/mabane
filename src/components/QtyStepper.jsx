import { useEffect, useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import { isDecimalUnit, qtyStep, roundQty, parseQty, formatQty } from '../utils/quantity'

// Quantité avec gros boutons − / + (faciles à toucher) et saisie directe.
// Pour les unités de mesure (m, kg, L…), la quantité peut être décimale (« 2,5 ») et les
// boutons avancent de 0,5 ; pour les articles à la pièce, elle reste entière.
export default function QtyStepper({ value, onChange, min, max, unit, invalid = false, label = 'Quantité' }) {
  const decimal = isDecimalUnit(unit) || !Number.isInteger(Number(value))
  const step = decimal ? qtyStep(unit) || 0.5 : 1
  const floor = min ?? (decimal ? 0.001 : 1)
  const n = Number(value) || 0
  const [draft, setDraft] = useState(formatQty(value))

  // La valeur change de l'extérieur (bouton +, autre ligne...) : on resynchronise l'affichage
  useEffect(() => {
    setDraft((d) => (roundQty(parseQty(d)) === roundQty(value) ? d : formatQty(value)))
  }, [value])

  const clamp = (v) => {
    let next = decimal ? roundQty(v) : Math.floor(v)
    if (!Number.isFinite(next)) next = floor
    next = Math.max(floor, next)
    if (max !== undefined && max !== null) next = Math.min(Number(max), next)
    return next
  }

  const commit = (v) => {
    const next = clamp(v)
    setDraft(formatQty(next))
    onChange(next)
  }

  const handleType = (text) => {
    // On laisse taper « 1, » ou « 0,2 » librement ; la valeur n'est transmise que si elle est lisible
    if (!/^\d*[.,]?\d{0,3}$/.test(text.replace(/\s/g, ''))) return
    if (!decimal && /[.,]/.test(text)) return
    setDraft(text)
    const parsed = parseQty(text)
    if (text !== '' && Number.isFinite(parsed) && parsed >= floor) onChange(clamp(parsed))
  }

  return (
    <div className={`inline-flex items-center rounded-2xl border overflow-hidden bg-white dark:bg-white/[0.03] ${invalid ? 'border-red-400' : 'border-gray-200 dark:border-white/10'}`}>
      <button
        type="button"
        aria-label="Diminuer la quantité"
        className="h-10 w-10 flex items-center justify-center bg-gray-50 text-brand-900 dark:bg-white/[0.04] dark:text-gray-200 hover:bg-blue-50 hover:text-[#1d4fb8] dark:hover:bg-white/[0.08] disabled:opacity-30"
        disabled={n - step < floor - 1e-9}
        onClick={() => commit(n - step)}
      >
        <Minus size={15} />
      </button>
      <input
        type="text"
        inputMode={decimal ? 'decimal' : 'numeric'}
        aria-label={unit && unit !== 'unité' ? `${label} (${unit})` : label}
        className={`h-10 w-16 text-center text-sm font-bold text-brand-900 dark:text-gray-100 bg-transparent outline-none border-x border-gray-200 dark:border-white/10 tabular-nums ${invalid ? 'text-red-600' : ''}`}
        value={draft}
        onFocus={(e) => e.target.select()}
        onChange={(e) => handleType(e.target.value)}
        onBlur={() => commit(parseQty(draft))}
      />
      <button
        type="button"
        aria-label="Augmenter la quantité"
        className="h-10 w-10 flex items-center justify-center bg-gray-50 text-brand-900 dark:bg-white/[0.04] dark:text-gray-200 hover:bg-blue-50 hover:text-[#1d4fb8] dark:hover:bg-white/[0.08] disabled:opacity-30"
        disabled={max !== undefined && max !== null && n + step > Number(max) + 1e-9}
        onClick={() => commit(n + step)}
      >
        <Plus size={15} />
      </button>
      {decimal && unit && <span className="px-2 text-xs font-medium text-gray-500 dark:text-gray-400 border-l border-gray-200 dark:border-white/10 h-10 flex items-center">{unit}</span>}
    </div>
  )
}
