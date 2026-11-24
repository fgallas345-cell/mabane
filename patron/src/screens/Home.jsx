import { useCallback, useEffect, useState } from 'react'
import { RefreshCw, ArrowUp, ArrowDown, Wallet, ShoppingCart, TrendingUp, Receipt, HandCoins, PackageX, MessageSquareText, ChevronRight, LogOut } from 'lucide-react'
import { callPatron, fcfa, pct, longDate } from '../lib/api'
import { supabase } from '../lib/supabase'

function Trend({ value, onDark }) {
  if (value == null) return <span className={onDark ? 'text-white/60 text-xs' : 'text-gray-400 text-xs'}>pas de comparaison</span>
  const up = value >= 0
  const Icon = up ? ArrowUp : ArrowDown
  const tone = onDark ? (up ? 'bg-emerald-400/20 text-emerald-200' : 'bg-red-400/25 text-red-100') : up ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-bold ${tone}`}>
      <Icon size={12} strokeWidth={3} /> {up ? '+' : ''}{value}%
    </span>
  )
}

function Tile({ icon: Icon, label, value, sub, tone = 'blue', onClick }) {
  const tones = {
    blue: 'bg-blue-50 text-navy-500',
    green: 'bg-emerald-50 text-emerald-600',
    red: 'bg-red-50 text-red-600',
    amber: 'bg-amber-50 text-amber-600',
    orange: 'bg-accent-100 text-accent-600',
  }
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag type={onClick ? 'button' : undefined} onClick={onClick} className="card p-4 text-left active:scale-[0.98] transition">
      <span className={`h-10 w-10 rounded-2xl flex items-center justify-center ${tones[tone]}`}>
        <Icon size={20} />
      </span>
      <p className="mt-3 text-xs text-gray-500">{label}</p>
      <p className="text-lg font-extrabold leading-tight tabular-nums break-words">{value}</p>
      {sub && <p className="text-[11px] text-gray-500 mt-0.5">{sub}</p>}
    </Tag>
  )
}

// Libellés identiques aux questions toutes prêtes (lib/answers.js)
const QUICK = ["Ventes d'aujourd'hui vs hier", 'Qui me doit de l’argent ?', 'Produits à commander', 'Bénéfice du mois']

export default function Home({ firstName, onAsk, onOpenAlerts, onAlertCount }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await callPatron('kpis')
      setData(res)
      onAlertCount?.(res.stock.faible + res.dettes.nombre_clients)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [onAlertCount])

  // Chargement + rafraîchissement automatique toutes les 2 minutes quand l'écran est visible
  useEffect(() => {
    load()
    const id = setInterval(() => document.visibilityState === 'visible' && load(), 120_000)
    const onVisible = () => document.visibilityState === 'visible' && load()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [load])

  const today = data?.aujourdhui
  const yesterday = data?.hier
  const month = data?.mois

  return (
    <div className="pb-6">
      {/* En-tête marine */}
      <header className="safe-top bg-gradient-to-b from-[#071f34] to-[#0d2b4f] text-white px-5 pb-20 rounded-b-[32px]">
        <div className="flex items-center justify-between pt-4">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="" className="h-11 w-11 rounded-2xl bg-white object-cover" />
            <div>
              <p className="text-lg font-extrabold leading-tight">Bonjour {firstName} 👋</p>
              <p className="text-xs text-white/70 capitalize">{longDate()}</p>
            </div>
          </div>
          <div className="flex gap-1.5">
            <button type="button" aria-label="Actualiser" onClick={load} className="h-10 w-10 rounded-2xl bg-white/10 flex items-center justify-center">
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            </button>
            <button type="button" aria-label="Se déconnecter" onClick={() => supabase.auth.signOut()} className="h-10 w-10 rounded-2xl bg-white/10 flex items-center justify-center">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      <div className="px-4 -mt-14 space-y-4">
        {/* Carte principale : encaissé aujourd'hui */}
        <section className="rounded-3xl bg-gradient-to-br from-navy-600 to-navy-800 text-white p-5 shadow-[0_14px_30px_-14px_rgba(19,48,111,0.7)]">
          <div className="flex items-center justify-between">
            <p className="text-sm text-white/80 flex items-center gap-2"><Wallet size={16} /> Encaissé aujourd'hui</p>
            {today && <Trend value={pct(today.encaisse, yesterday.encaisse)} onDark />}
          </div>
          {loading && !data ? (
            <div className="mt-2 h-9 w-2/3 rounded-xl bg-white/15 animate-pulse" />
          ) : (
            <p className="mt-1 text-[32px] font-extrabold tabular-nums leading-tight">{today ? fcfa(today.encaisse) : '—'}</p>
          )}
          {today && (
            <p className="text-xs text-white/70 mt-1">
              Hier : {fcfa(yesterday.encaisse)} · {today.factures.nombre + today.caisse_rapide.nombre} vente{today.factures.nombre + today.caisse_rapide.nombre > 1 ? 's' : ''} aujourd'hui
            </p>
          )}
        </section>

        {error && (
          <div className="card p-4 text-sm text-red-700 bg-red-50 border-red-200">
            {error}
            <button type="button" className="block mt-2 font-semibold underline" onClick={load}>Réessayer</button>
          </div>
        )}

        {data && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Tile icon={ShoppingCart} label="Ventes du jour" value={fcfa(today.chiffre_affaires)} sub={`Factures ${fcfa(today.factures.montant)}`} />
              <Tile icon={TrendingUp} tone="green" label="Bénéfice du mois" value={fcfa(month.benefice)} sub={`Marge ${fcfa(month.marge_brute)}`} />
              <Tile icon={Receipt} tone="orange" label="Ventes du mois" value={fcfa(month.chiffre_affaires)} sub={`Dépenses ${fcfa(month.depenses)}`} />
              <Tile icon={HandCoins} tone="red" label="Dettes clients" value={fcfa(data.dettes.total_du)} sub={`${data.dettes.nombre_clients} client${data.dettes.nombre_clients > 1 ? 's' : ''}`} onClick={onOpenAlerts} />
            </div>

            {data.stock.faible > 0 && (
              <button type="button" onClick={onOpenAlerts} className="card w-full p-4 flex items-center gap-3 text-left active:scale-[0.98] transition">
                <span className="h-10 w-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center"><PackageX size={20} /></span>
                <span className="flex-1">
                  <span className="block font-bold">{data.stock.faible} produit{data.stock.faible > 1 ? 's' : ''} à commander</span>
                  <span className="block text-xs text-gray-500">{data.stock.rupture} en rupture de stock</span>
                </span>
                <ChevronRight size={18} className="text-gray-400" />
              </button>
            )}

            {data.dettes.top.length > 0 && (
              <section className="card p-4">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="font-bold">Ceux qui doivent le plus</h2>
                  <button type="button" className="text-sm font-semibold text-navy-500" onClick={onOpenAlerts}>Tout voir</button>
                </div>
                <ul className="divide-y divide-gray-100">
                  {data.dettes.top.map((c) => (
                    <li key={c.client + c.plus_ancienne} className="flex items-center justify-between gap-3 py-2.5">
                      <span className="min-w-0">
                        <span className="block text-sm font-bold uppercase truncate">{c.client}</span>
                        <span className="block text-xs text-gray-500">{c.factures} facture{c.factures > 1 ? 's' : ''} · depuis le {new Date(c.plus_ancienne).toLocaleDateString('fr-FR')}</span>
                      </span>
                      <span className="text-sm font-extrabold text-red-600 tabular-nums whitespace-nowrap">{fcfa(c.reste)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}

        {/* Questions rapides → assistant */}
        <section className="card p-4">
          <h2 className="font-bold flex items-center gap-2"><MessageSquareText size={18} className="text-accent-500" /> Questions rapides</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {QUICK.map((q) => (
              <button key={q} type="button" onClick={() => onAsk(q)} className="rounded-full border border-gray-200 bg-[#f7f9fc] px-3.5 py-2 text-sm font-medium active:bg-blue-50">
                {q}
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
