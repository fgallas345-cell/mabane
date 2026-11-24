import { useCallback, useEffect, useState } from 'react'
import {
  RefreshCw, ArrowUp, ArrowDown, Wallet, ShoppingCart, TrendingUp, FileText, Coins, Box, ChevronRight,
  LogOut, Bell, Users, BarChart3, MessageSquareText,
} from 'lucide-react'
import { callPatron, fcfa, pct, longDate } from '../lib/api'
import { supabase } from '../lib/supabase'

function Trend({ value }) {
  if (value == null) return null
  const up = value >= 0
  const Icon = up ? ArrowUp : ArrowDown
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${up ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}>
      <Icon size={13} strokeWidth={3} /> {up ? '+' : ''}{new Intl.NumberFormat('fr-FR').format(value)}%
    </span>
  )
}

/** Silhouette de bâtiments (décor de l'en-tête) */
function Skyline({ className = '' }) {
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

/** Courbe montante décorative de la carte principale */
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

const TONES = {
  blue: 'bg-blue-100 text-[#1d4fb8]',
  green: 'bg-emerald-100 text-emerald-600',
  orange: 'bg-accent-100 text-accent-600',
  red: 'bg-red-100 text-red-600',
}

function Tile({ icon: Icon, label, value, sub, tone = 'blue', onClick }) {
  return (
    <button type="button" onClick={onClick} className="relative bg-white rounded-3xl p-4 text-left shadow-[0_6px_20px_-10px_rgba(7,31,52,0.25)] border border-gray-100 active:scale-[0.98] transition">
      <span className={`h-12 w-12 rounded-full flex items-center justify-center ${TONES[tone]}`}>
        <Icon size={23} />
      </span>
      <span className="absolute right-3 top-3 h-7 w-7 rounded-full bg-gray-100 text-navy-900 flex items-center justify-center">
        <ChevronRight size={16} />
      </span>
      <p className="mt-3 text-sm text-gray-700">{label}</p>
      <p className="text-[17px] font-extrabold leading-tight tabular-nums text-navy-900 break-words">{value}</p>
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

  return (
    <div className="pb-6 bg-white min-h-full">
      {/* En-tête bleu roi */}
      <header className="safe-top relative overflow-hidden bg-gradient-to-br from-[#1d4fb8] via-[#163f9a] to-[#0d2b6b] text-white px-5 pb-24 rounded-b-[36px]">
        <Skyline className="pointer-events-none absolute right-0 top-2 h-40 w-64" />
        <div className="relative flex items-center justify-between gap-3 pt-5">
          <div className="flex items-center gap-3 min-w-0">
            <img src="/logo.png" alt="Logo Mabane" className="h-14 w-14 shrink-0 rounded-full bg-white object-cover ring-4 ring-white/20" />
            <div className="min-w-0">
              <p className="text-lg font-extrabold leading-tight truncate">
                Bonjour <span className="text-accent-400">{firstName}</span> <span aria-hidden="true">👋</span>
              </p>
              <p className="text-sm text-white/75">{dateLabel}</p>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <button type="button" aria-label={`Alertes (${alertCount})`} onClick={onOpenAlerts} className="relative h-11 w-11 rounded-full bg-white/10 ring-1 ring-white/25 flex items-center justify-center">
              <Bell size={19} className="fill-white/90" />
              {alertCount > 0 && <span className="absolute top-2 right-2.5 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-[#163f9a]" />}
            </button>
            <button type="button" aria-label="Se déconnecter" onClick={() => supabase.auth.signOut()} className="h-11 w-11 rounded-full bg-white/10 ring-1 ring-white/25 flex items-center justify-center">
              <LogOut size={19} />
            </button>
          </div>
        </div>
      </header>

      <div className="px-4 -mt-16 space-y-4 relative">
        {/* Carte principale : encaissé aujourd'hui */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#2563eb] via-[#1d4fb8] to-[#13306f] text-white p-5 shadow-[0_18px_36px_-16px_rgba(19,48,111,0.75)]">
          <HeroCurve className="pointer-events-none absolute right-0 bottom-0 h-28 w-48" />
          <div className="relative flex items-center justify-between gap-2">
            <p className="text-[15px] text-white/90 flex items-center gap-2"><Wallet size={18} /> Encaissé aujourd'hui</p>
            {today && <Trend value={pct(today.encaisse, yesterday.encaisse)} />}
          </div>
          {loading && !data ? (
            <div className="relative mt-3 h-10 w-2/3 rounded-xl bg-white/15 animate-pulse" />
          ) : (
            <p className="relative mt-2 text-[34px] font-extrabold tabular-nums leading-tight">{today ? fcfa(today.encaisse) : '—'}</p>
          )}
          {today && (
            <p className="relative text-sm text-white/80 mt-1 flex items-center gap-1.5">
              <BarChart3 size={15} /> Hier : {fcfa(yesterday.encaisse)} • {salesCount} vente{salesCount > 1 ? 's' : ''} aujourd'hui
            </p>
          )}
        </section>

        {error && (
          <div className="rounded-3xl p-4 text-sm text-red-700 bg-red-50 border border-red-200">
            {error}
            <button type="button" className="block mt-2 font-semibold underline" onClick={load}>Réessayer</button>
          </div>
        )}

        {data && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Tile icon={ShoppingCart} label="Ventes du jour" value={fcfa(today.chiffre_affaires)} sub={`Factures : ${fcfa(today.factures.montant)}`} onClick={() => onAsk("Ventes d'aujourd'hui vs hier")} />
              <Tile icon={TrendingUp} tone="green" label="Bénéfice du mois" value={fcfa(month.benefice)} sub={`Marge : ${fcfa(month.marge_brute)}`} onClick={() => onAsk('Bénéfice du mois')} />
              <Tile icon={FileText} tone="orange" label="Ventes du mois" value={fcfa(month.chiffre_affaires)} sub={`Dépenses : ${fcfa(month.depenses)}`} onClick={() => onAsk('Ce mois vs le mois dernier')} />
              <Tile icon={Coins} tone="red" label="Dettes clients" value={fcfa(data.dettes.total_du)} sub={`${data.dettes.nombre_clients} client${data.dettes.nombre_clients > 1 ? 's' : ''}`} onClick={() => onAsk('Qui me doit de l’argent ?')} />
            </div>

            {data.stock.faible > 0 && (
              <button type="button" onClick={() => onAsk('Produits à commander')} className="w-full rounded-3xl bg-blue-50/80 border border-blue-100 p-4 flex items-center gap-3 text-left active:scale-[0.98] transition">
                <span className="h-12 w-12 shrink-0 rounded-full bg-blue-100 text-[#1d4fb8] flex items-center justify-center"><Box size={24} /></span>
                <span className="flex-1 min-w-0">
                  <span className="block font-extrabold text-navy-900">{data.stock.faible} produit{data.stock.faible > 1 ? 's' : ''} à commander</span>
                  <span className="block text-sm text-gray-600">{data.stock.rupture} en rupture de stock</span>
                </span>
                <ChevronRight size={22} className="text-[#1d4fb8]" />
              </button>
            )}

            {data.dettes.top.length > 0 && (
              <section className="bg-white rounded-3xl p-4 shadow-[0_6px_20px_-10px_rgba(7,31,52,0.25)] border border-gray-100">
                <div className="flex items-center justify-between mb-1">
                  <h2 className="font-extrabold text-navy-900 flex items-center gap-2">
                    <span className="h-9 w-9 rounded-full bg-blue-50 text-[#1d4fb8] flex items-center justify-center"><Users size={18} /></span>
                    Ceux qui doivent le plus
                  </h2>
                  <button type="button" className="text-sm font-semibold text-[#1d4fb8] flex items-center" onClick={onOpenAlerts}>
                    Tout voir <ChevronRight size={16} />
                  </button>
                </div>
                <ul className="divide-y divide-gray-100">
                  {data.dettes.top.map((c) => (
                    <li key={c.client + c.plus_ancienne} className="flex items-center justify-between gap-3 py-2.5">
                      <span className="min-w-0">
                        <span className="block text-sm font-bold uppercase truncate text-navy-900">{c.client}</span>
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

        {/* Questions rapides */}
        <section className="bg-white rounded-3xl p-4 shadow-[0_6px_20px_-10px_rgba(7,31,52,0.25)] border border-gray-100">
          <div className="flex items-center justify-between">
            <h2 className="font-extrabold text-navy-900 flex items-center gap-2">
              <span className="h-9 w-9 rounded-full bg-accent-100 text-accent-600 flex items-center justify-center"><MessageSquareText size={18} /></span>
              Questions rapides
            </h2>
            <button type="button" aria-label="Actualiser les chiffres" onClick={load} className="h-9 w-9 rounded-full bg-gray-100 text-navy-900 flex items-center justify-center">
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {QUICK.map((q) => (
              <button key={q} type="button" onClick={() => onAsk(q)} className="rounded-full border border-gray-200 bg-[#f7f9fc] px-3.5 py-2 text-sm font-medium text-navy-900 active:bg-blue-50">
                {q}
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
