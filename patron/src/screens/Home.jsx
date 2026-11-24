import { useCallback, useEffect, useState } from 'react'
import {
  RefreshCw, ArrowUp, ArrowDown, Wallet, ShoppingCart, TrendingUp, FileText, Coins, Box, ChevronRight,
  LogOut, Bell, Users, BarChart3, MessageSquareText,
} from 'lucide-react'
import { callPatron, fcfa, pct, longDate } from '../lib/api'
import { supabase } from '../lib/supabase'
import { ScreenHeader, Logo, ErrorBox } from '../components/ui'
import { CHIP_TONES } from '../components/tones'

function Trend({ value }) {
  if (value == null) return null
  const up = value >= 0
  const Icon = up ? ArrowUp : ArrowDown
  return (
    <span className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2 min-[380px]:px-2.5 py-1 text-[11px] min-[380px]:text-xs font-bold text-white ${up ? 'bg-emerald-500' : 'bg-red-500'}`}>
      <Icon size={13} strokeWidth={3} /> {up ? '+' : ''}{new Intl.NumberFormat('fr-FR').format(value)}%
    </span>
  )
}

/** Courbe montante décorative de la grande carte */
function HeroCurve({ className = '' }) {
  return (
    <svg viewBox="0 0 160 90" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="hero-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3b82f6" stopOpacity="0.55" />
          <stop offset="1" stopColor="#3b82f6" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d="M0 80 C 30 76, 50 60, 75 58 S 120 30, 160 8 L160 90 L0 90 Z" fill="url(#hero-area)" />
      <path d="M0 80 C 30 76, 50 60, 75 58 S 120 30, 160 8" fill="none" stroke="#60a5fa" strokeWidth="2.5" opacity="0.8" />
      <path d="M112 62 L126 48 L134 56 L148 42" fill="none" stroke="#93c5fd" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M140 42 L148 42 L148 50" fill="none" stroke="#93c5fd" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function Tile({ icon: Icon, label, value, sub, tone = 'blue', onClick }) {
  return (
    <button type="button" onClick={onClick} className="card relative p-3.5 min-[380px]:p-4 text-left active:scale-[0.98] transition min-w-0">
      <span className={`icon-chip h-12 w-12 ${CHIP_TONES[tone]}`}>
        <Icon size={23} />
      </span>
      <span className="mini-btn absolute right-3 top-3 !h-7 !w-7">
        <ChevronRight size={16} />
      </span>
      <p className="mt-3 text-sm text-gray-600">{label}</p>
      <p className="text-[clamp(14px,4.4vw,17px)] font-extrabold leading-tight tabular-nums text-navy-900">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </button>
  )
}

// Libellés identiques aux questions toutes prêtes (lib/answers.js)
const QUICK = ["Ventes d'aujourd'hui vs hier", 'Qui me doit de l’argent ?', 'Produits à commander', 'Bénéfice du mois']

export default function Home({ firstName, onAsk, onOpenAlerts, onAlertCount, alertCount = 0 }) {
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
  const salesCount = today ? today.factures.nombre + today.caisse_rapide.nombre : 0
  const dateLabel = longDate().replace(/(^|\s)\p{L}/gu, (m) => m.toUpperCase())
  // Petit écran : date courte sur une ligne (« Mar. 24 nov. »)
  const shortDate = new Date().toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/^\p{L}/u, (m) => m.toUpperCase())

  return (
    <div className="pb-6 min-h-full">
      <ScreenHeader
        overlap
        visual={<Logo />}
        title={<>Bonjour <span className="text-accent-400">{firstName}</span> <span aria-hidden="true">👋</span></>}
        subtitle={
          <>
            <span className="min-[380px]:hidden">{shortDate}</span>
            <span className="max-[379px]:hidden">{dateLabel}</span>
          </>
        }
        actions={
          <>
            <button type="button" aria-label={`Alertes (${alertCount})`} onClick={onOpenAlerts} className="header-btn relative">
              <Bell size={19} className="fill-white/90" />
              {alertCount > 0 && <span className="absolute top-2 right-2.5 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-navy-600" />}
            </button>
            <button type="button" aria-label="Se déconnecter" onClick={() => supabase.auth.signOut()} className="header-btn">
              <LogOut size={19} />
            </button>
          </>
        }
      />

      <div className="px-3 min-[380px]:px-4 -mt-16 space-y-3 min-[380px]:space-y-4 relative">
        {/* Grande carte : encaissé aujourd'hui */}
        <section className="hero p-5">
          <HeroCurve className="pointer-events-none absolute right-0 bottom-0 h-28 w-48" />
          <div className="relative flex items-center justify-between gap-2">
            <p className="min-w-0 text-[14px] min-[380px]:text-[15px] text-white/90 flex items-center gap-2 whitespace-nowrap"><Wallet size={18} className="shrink-0" /> Encaissé aujourd'hui</p>
            {today && <Trend value={pct(today.encaisse, yesterday.encaisse)} />}
          </div>
          {loading && !data ? (
            <div className="relative mt-3 h-10 w-2/3 rounded-xl bg-white/15 animate-pulse" />
          ) : (
            <p className="relative mt-2 text-[clamp(26px,9vw,34px)] font-extrabold tabular-nums leading-tight">{today ? fcfa(today.encaisse) : '—'}</p>
          )}
          {today && (
            <p className="relative text-[13px] min-[380px]:text-sm text-white/80 mt-1 flex items-start gap-1.5 pr-10">
              <BarChart3 size={15} className="shrink-0 mt-0.5" /> Hier : {fcfa(yesterday.encaisse)} • {salesCount} vente{salesCount > 1 ? 's' : ''} aujourd'hui
            </p>
          )}
        </section>

        {error && <ErrorBox message={error} onRetry={load} />}

        {loading && !data && (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="card h-36 animate-pulse" />)}
          </div>
        )}

        {data && (
          <>
            <div className="grid grid-cols-2 gap-2.5 min-[380px]:gap-3">
              <Tile icon={ShoppingCart} label="Ventes du jour" value={fcfa(today.chiffre_affaires)} sub={`Factures : ${fcfa(today.factures.montant)}`} onClick={() => onAsk("Ventes d'aujourd'hui vs hier")} />
              <Tile icon={TrendingUp} tone="green" label="Bénéfice du mois" value={fcfa(month.benefice)} sub={`Marge : ${fcfa(month.marge_brute)}`} onClick={() => onAsk('Bénéfice du mois')} />
              <Tile icon={FileText} tone="orange" label="Ventes du mois" value={fcfa(month.chiffre_affaires)} sub={`Dépenses : ${fcfa(month.depenses)}`} onClick={() => onAsk('Ce mois vs le mois dernier')} />
              <Tile icon={Coins} tone="red" label="Dettes clients" value={fcfa(data.dettes.total_du)} sub={`${data.dettes.nombre_clients} client${data.dettes.nombre_clients > 1 ? 's' : ''}`} onClick={() => onAsk('Qui me doit de l’argent ?')} />
            </div>

            {data.stock.faible > 0 && (
              <button type="button" onClick={() => onAsk('Produits à commander')} className="w-full rounded-3xl bg-blue-50 border border-blue-100 p-4 flex items-center gap-3 text-left active:scale-[0.98] transition">
                <span className={`icon-chip h-12 w-12 ${CHIP_TONES.blue}`}><Box size={24} /></span>
                <span className="flex-1 min-w-0">
                  <span className="block title-sm">{data.stock.faible} produit{data.stock.faible > 1 ? 's' : ''} à commander</span>
                  <span className="block text-sm text-gray-600">{data.stock.rupture} en rupture de stock</span>
                </span>
                <ChevronRight size={22} className="text-navy-500" />
              </button>
            )}

            {data.dettes.top.length > 0 && (
              <section className="card p-4">
                <div className="flex items-center justify-between mb-1">
                  <h2 className="title-sm flex items-center gap-2">
                    <span className={`icon-chip h-9 w-9 ${CHIP_TONES.blue}`}><Users size={18} /></span>
                    Ceux qui doivent le plus
                  </h2>
                  <button type="button" className="text-sm font-semibold text-navy-500 flex items-center" onClick={onOpenAlerts}>
                    Tout voir <ChevronRight size={16} />
                  </button>
                </div>
                <ul className="divide-y divide-gray-100">
                  {data.dettes.top.map((c) => (
                    <li key={c.client + c.plus_ancienne} className="flex items-center justify-between gap-3 py-2.5">
                      <span className="min-w-0">
                        <span className="block text-sm font-extrabold uppercase truncate text-navy-900">{c.client}</span>
                        <span className="block text-xs text-gray-500">{c.factures} facture{c.factures > 1 ? 's' : ''} : depuis le {new Date(c.plus_ancienne).toLocaleDateString('fr-FR')}</span>
                      </span>
                      <span className="text-sm amount-red whitespace-nowrap">{fcfa(c.reste)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}

        {/* Questions rapides */}
        <section className="card p-4">
          <div className="flex items-center justify-between">
            <h2 className="title-sm flex items-center gap-2">
              <span className={`icon-chip h-9 w-9 ${CHIP_TONES.orange}`}><MessageSquareText size={18} /></span>
              Questions rapides
            </h2>
            <button type="button" aria-label="Actualiser les chiffres" onClick={load} className="mini-btn !h-9 !w-9">
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {QUICK.map((q) => (
              <button key={q} type="button" onClick={() => onAsk(q)} className="chip">
                {q}
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
