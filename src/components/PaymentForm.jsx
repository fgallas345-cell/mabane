import { Check } from 'lucide-react'
import { currency } from '../lib/constants'

const NO_SPIN = '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none'
const CHIP = 'rounded-full border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-brand-900 dark:text-gray-200 hover:border-blue-300 hover:bg-blue-50 dark:hover:bg-white/[0.08]'

/**
 * Formulaire de paiement d'un reste dû (facture client ou achat fournisseur), même présentation
 * que le paiement des factures : récapitulatif en carte, montant en grand, raccourcis, aperçu du reste.
 * Le parent garde l'état (amount / setAmount) et la soumission (onSubmit).
 */
export default function PaymentForm({ partyLabel, partyName, documentLabel, total, paid, amount, setAmount, error, pending, onSubmit, onCancel }) {
  const due = Number(total || 0) - Number(paid || 0)
  const value = Number(amount || 0)
  const after = Math.max(0, due - value)
  const tooMuch = value > due

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="rounded-2xl bg-gradient-to-br from-[#1a3f95] to-[#0d2550] text-white p-4 shadow-[0_14px_30px_-14px_rgba(19,48,111,0.7)]">
        <p className="text-xs text-white/70">{partyLabel}</p>
        <p className="font-bold uppercase truncate">{partyName || '—'}</p>
        {documentLabel && <p className="text-xs text-white/70 mt-0.5">{documentLabel}</p>}
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-white/10 px-2 py-2">
            <p className="text-[11px] text-white/70">Total</p>
            <p className="text-sm font-bold tabular-nums">{currency(total)}</p>
          </div>
          <div className="rounded-xl bg-white/10 px-2 py-2">
            <p className="text-[11px] text-white/70">Déjà payé</p>
            <p className="text-sm font-bold tabular-nums">{currency(paid)}</p>
          </div>
          <div className="rounded-xl bg-red-500/30 px-2 py-2">
            <p className="text-[11px] text-white/80">Reste dû</p>
            <p className="text-sm font-extrabold tabular-nums">{currency(due)}</p>
          </div>
        </div>
      </div>

      <div>
        <label className="label" htmlFor="payment-form-amount">Montant du paiement</label>
        <div className="relative">
          <input
            id="payment-form-amount"
            type="number"
            inputMode="numeric"
            min="1"
            max={due}
            required
            autoFocus
            className={`input !rounded-2xl !py-3.5 pr-20 text-2xl font-extrabold tabular-nums ${NO_SPIN} ${tooMuch ? '!border-red-400' : ''}`}
            placeholder="0"
            value={amount}
            onFocus={(e) => e.target.select()}
            onChange={(e) => setAmount(e.target.value)}
          />
          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400">FCFA</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-2">
          <button type="button" className={CHIP} onClick={() => setAmount(String(due))}>
            Tout solder · {currency(due)}
          </button>
          {due > 1 && (
            <button type="button" className={CHIP} onClick={() => setAmount(String(Math.round(due / 2)))}>
              Moitié · {currency(Math.round(due / 2))}
            </button>
          )}
          {value > 0 && (
            <span className={`ml-auto rounded-full px-3 py-1.5 text-xs font-semibold tabular-nums ${
              tooMuch
                ? 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400'
                : after === 0
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
                  : 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400'
            }`}>
              {tooMuch ? `Dépasse le reste dû de ${currency(value - due)}` : after === 0 ? 'Ce sera soldé' : `Il restera ${currency(after)}`}
            </span>
          )}
        </div>
      </div>

      {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 rounded-xl px-3 py-2">{error}</p>}

      <div className="sticky -bottom-5 sm:-bottom-6 -mx-5 sm:-mx-6 -mb-5 sm:-mb-6 px-5 sm:px-6 py-4 bg-white/95 dark:bg-darkcard/95 backdrop-blur border-t border-gray-200 dark:border-white/[0.08] flex gap-3">
        <button type="button" className="btn-secondary !rounded-2xl !px-5" onClick={onCancel}>Annuler</button>
        <button type="submit" className="btn-cta flex-1" disabled={pending || tooMuch}>
          <Check size={18} strokeWidth={2.75} />
          {pending ? 'Enregistrement...' : value > 0 && !tooMuch ? `Payer ${currency(value)}` : 'Confirmer le paiement'}
        </button>
      </div>
    </form>
  )
}
