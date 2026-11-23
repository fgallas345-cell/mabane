import { useId, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ShoppingCart, FileText, Box, Users, ArrowRight, ArrowUp, ArrowDown, BarChart3, PieChart, Wallet,
  TrendingUp, ShoppingBag, HandCoins, CheckCircle2, AlertTriangle, Trophy, Package, CalendarDays,
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { useDashboard, useDashboardTrends } from '../../hooks/useDashboard'
import { currency, displayName } from '../../lib/constants'
import { useAuth } from '../../context/AuthContext'
import { formatQty } from '../../utils/quantity'
import { PERIODS, periodRange, sumBetween, dailySeries, trendPct } from '../../utils/dashboardPeriods'

// Couleurs de la charte pour le graphique
const NAVY = '#1e3a7b'
const ORANGE = '#f39e26'

const compact = (v) => new Intl.NumberFormat('fr-FR', { notation: 'compact' }).format(v)
const capitalize = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)

// ---------------------------------------------------------------------------
// Illustration de la boutique (en-tête)
// ---------------------------------------------------------------------------
function ShopIllustration({ className = '' }) {
  return (
    <svg viewBox="0 0 160 112" className={className} aria-hidden="true">
      <ellipse cx="80" cy="60" rx="76" ry="50" fill="#dfe9fb" className="dark:opacity-20" />
      <rect x="40" y="40" width="80" height="56" rx="4" fill="#ffffff" stroke="#1e3a7b" strokeWidth="2.5" />
      <rect x="36" y="18" width="88" height="10" rx="3" fill="#1e3a7b" />
      {/* Auvent rayé */}
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <path key={i} d={`M${36 + i * 11} 28 h11 v12 a5.5 5.5 0 0 1 -11 0 z`} fill={i % 2 ? '#ffffff' : '#f39e26'} stroke="#1e3a7b" strokeWidth="1.5" />
      ))}
      {/* Vitrine */}
      <rect x="48" y="55" width="30" height="24" rx="2" fill="#9cc2f5" stroke="#1e3a7b" strokeWidth="2" />
      <path d="M52 74 l8 -10 M58 76 l12 -14" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" opacity="0.8" />
      {/* Porte */}
      <rect x="86" y="55" width="24" height="41" rx="2" fill="#f39e26" stroke="#1e3a7b" strokeWidth="2" />
      <rect x="90" y="60" width="16" height="14" rx="1.5" fill="#fde9cc" />
      <circle cx="106" cy="80" r="1.6" fill="#1e3a7b" />
      {/* Arbre */}
      <rect x="21" y="80" width="3" height="16" rx="1.5" fill="#7a4a1d" />
      <circle cx="22.5" cy="74" r="10" fill="#22a35a" />
      <circle cx="17" cy="79" r="6" fill="#1c8c4c" />
      {/* Lampe */}
      <rect x="132" y="66" width="3" height="30" rx="1.5" fill="#1e3a7b" />
      <path d="M127 62 h13 l-3 6 h-7 z" fill="#f39e26" stroke="#1e3a7b" strokeWidth="1.5" />
      <rect x="30" y="95" width="112" height="3" rx="1.5" fill="#1e3a7b" opacity="0.15" />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Mini-courbe en aire (cartes d'indicateurs)
// ---------------------------------------------------------------------------
function Sparkline({ values, color, className = '' }) {
  const id = useId().replace(/:/g, '')
  const w = 150
  const h = 56
  const pts = values.length > 1 ? values : [0, ...(values.length ? values : [0])]
  const max = Math.max(...pts)
  const min = Math.min(...pts)
  const span = max - min || 1
  const xy = pts.map((v, i) => [(i / (pts.length - 1)) * w, h - 6 - ((v - min) / span) * (h - 14)])
  // Courbe lissée (Catmull-Rom → Bézier)
  let d = `M${xy[0][0]},${xy[0][1]}`
  for (let i = 0; i < xy.length - 1; i++) {
    const p0 = xy[i - 1] || xy[i]
    const p1 = xy[i]
    const p2 = xy[i + 1]
    const p3 = xy[i + 2] || p2
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6]
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]
    d += ` C${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${p2[0]},${p2[1]}`
  }
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`spark-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.28" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${d} L${w},${h} L0,${h} Z`} fill={`url(#spark-${id})`} />
      <path d={d} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

function Trend({ pct, compareLabel }) {
  if (pct == null) {
    return <span className="text-xs text-gray-400">Pas de comparaison ({compareLabel})</span>
  }
  const up = pct >= 0
  return (
    <span className="flex items-center gap-1.5">
      <span className={`flex items-center gap-0.5 text-sm font-bold ${up ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
        {up ? <ArrowUp size={15} strokeWidth={3} /> : <ArrowDown size={15} strokeWidth={3} />}
        {up ? '+' : ''}{pct}%
      </span>
      <span className="text-xs text-gray-400">vs {compareLabel}</span>
    </span>
  )
}

// ---------------------------------------------------------------------------
// Cartes du haut : « Vendre » mise en avant + 3 raccourcis avec leur indicateur
// ---------------------------------------------------------------------------
function SellCard({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1d4fb8] via-[#1a3f95] to-[#13306f] p-5 text-left text-white shadow-[0_14px_30px_-12px_rgba(29,79,184,0.65)] transition-transform hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 min-h-[156px]"
    >
      <svg viewBox="0 0 200 90" className="absolute right-0 bottom-0 w-3/5 h-auto opacity-90" aria-hidden="true">
        <path d="M10 80 C 50 78, 70 60, 95 64 S 140 50, 150 40 S 180 18, 192 8" fill="none" stroke="#4f8bff" strokeWidth="4" strokeLinecap="round" />
        <path d="M180 6 L194 6 L192 20" fill="none" stroke="#4f8bff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div className="relative flex items-start justify-between">
        <span className="h-14 w-14 rounded-full bg-white/15 ring-1 ring-white/25 flex items-center justify-center">
          <ShoppingCart size={26} />
        </span>
        <span className="h-10 w-10 rounded-full bg-[#2f6bea] flex items-center justify-center transition-transform group-hover:translate-x-0.5">
          <ArrowRight size={19} />
        </span>
      </div>
      <p className="relative mt-5 text-xl font-bold">Vendre</p>
      <p className="relative text-sm text-white/80">Caisse rapide, sans facture</p>
    </button>
  )
}

const TONES = {
  blue: { chip: 'bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300', line: '#3b6fe0' },
  violet: { chip: 'bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300', line: '#8b5cf6' },
  green: { chip: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300', line: '#22c55e' },
}

function ActionCard({ icon: Icon, tone, title, hint, caption, value, trend, spark, onClick, loading }) {
  const t = TONES[tone]
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative overflow-hidden card !rounded-3xl p-5 text-left transition-all hover:shadow-lift hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 min-h-[156px]"
    >
      <div className="flex items-start gap-3.5">
        <span className={`h-14 w-14 shrink-0 rounded-full flex items-center justify-center ${t.chip}`}>
          <Icon size={24} />
        </span>
        <span className="min-w-0 pt-1">
          <span className="block font-bold text-brand-900 dark:text-gray-50">{title}</span>
          <span className="block text-xs text-gray-500 dark:text-gray-400 truncate">{hint}</span>
        </span>
      </div>
      {loading ? (
        <div className="mt-4 h-12 w-2/3 rounded-xl bg-gray-100 dark:bg-white/[0.06] animate-pulse" />
      ) : (
        <div className="relative mt-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">{caption}</p>
          <p className="text-2xl font-extrabold tracking-tight text-brand-900 dark:text-gray-50 tabular leading-tight">{value}</p>
          <div className="mt-1">{trend}</div>
        </div>
      )}
      {spark && <Sparkline values={spark} color={t.line} className="pointer-events-none absolute right-0 bottom-0 h-14 w-1/2" />}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Graphique, bilan, stock faible, meilleures ventes
// ---------------------------------------------------------------------------
function WeekTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const total = payload.reduce((s, p) => s + Number(p.value || 0), 0)
  return (
    <div className="card px-3 py-2 text-sm shadow-lift">
      <p className="font-semibold mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: p.fill }} />
          {p.name} : <span className="font-semibold tabular">{currency(p.value)}</span>
        </p>
      ))}
      <p className="mt-1 pt-1 border-t border-gray-100 dark:border-white/10 font-semibold tabular">Total : {currency(total)}</p>
    </div>
  )
}

function SectionTitle({ icon: Icon, iconClass, children, action, onAction }) {
  return (
    <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-3">
      <h2 className="flex items-center gap-2.5 text-lg font-bold text-brand-900 dark:text-gray-50">
        <Icon size={22} className={iconClass} /> {children}
      </h2>
      {action && (
        <button type="button" onClick={onAction} className="flex items-center gap-1 text-sm font-semibold text-blue-700 dark:text-blue-300 hover:underline">
          {action} <ArrowRight size={15} />
        </button>
      )}
    </div>
  )
}

function BilanRow({ icon: Icon, chip, label, value, valueClass, onClick }) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`w-full flex items-center gap-3.5 py-3 border-b last:border-0 border-gray-100 dark:border-white/[0.06] text-left ${onClick ? 'hover:bg-gray-50/70 dark:hover:bg-white/[0.03] rounded-xl' : ''}`}
    >
      <span className={`h-10 w-10 shrink-0 rounded-xl flex items-center justify-center ${chip}`}>
        <Icon size={19} />
      </span>
      <span className="flex-1 text-[15px] font-medium text-gray-700 dark:text-gray-200">{label}</span>
      <span className={`text-lg font-extrabold tabular ${valueClass}`}>{currency(value)}</span>
    </Tag>
  )
}

function ProductThumb({ src }) {
  return src ? (
    <img src={src} alt="" loading="lazy" className="h-10 w-10 shrink-0 rounded-xl object-cover bg-gray-50 dark:bg-white/[0.04]" />
  ) : (
    <span className="h-10 w-10 shrink-0 rounded-xl bg-gray-100 dark:bg-white/[0.06] text-gray-400 flex items-center justify-center">
      <Package size={18} />
    </span>
  )
}

export default function Dashboard() {
  const { data, isLoading, isError, error, refetch } = useDashboard()
  const { data: trends, isLoading: trendsLoading, isError: trendsError } = useDashboardTrends()
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [period, setPeriod] = useState('today')

  const firstName = profile?.full_name ? displayName(profile.full_name).split(' ')[0] : ''
  const periodInfo = PERIODS.find((p) => p.key === period)

  const kpis = useMemo(() => {
    if (!trends) return null
    const r = periodRange(period)
    const make = (rows) => {
      const cur = sumBetween(rows, r.start, r.end)
      const prev = sumBetween(rows, r.prevStart, r.prevEnd)
      return { cur, pct: trendPct(cur, prev), spark: dailySeries(rows, r.sparkStart, r.sparkEnd) }
    }
    // Courbe clients : total cumulé jour après jour (croissance du fichier)
    const newClients = make(trends.clients)
    const before = sumBetween(trends.clients, new Date(0), r.sparkStart)
    let acc = before
    const clientSpark = newClients.spark.map((n) => (acc += n))
    return {
      cash: make(trends.cash),
      purchases: make(trends.purchases),
      clients: { total: trends.clients.length, added: newClients.cur, spark: clientSpark },
    }
  }, [trends, period])

  const header = (
    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        <ShopIllustration className="hidden sm:block h-24 w-36 shrink-0" />
        <div>
          <h1 className="text-2xl sm:text-[30px] font-extrabold tracking-tight text-brand-900 dark:text-gray-50">
            Bonjour{firstName ? `, ${firstName}` : ''} <span aria-hidden="true">👋</span>
          </h1>
          <p className="text-[15px] text-gray-600 dark:text-gray-400 mt-1">Voici un aperçu de l'activité de votre boutique aujourd'hui.</p>
        </div>
      </div>
      <div role="tablist" aria-label="Période des indicateurs" className="flex items-center gap-1 self-start lg:self-auto rounded-full bg-white dark:bg-darkcard p-1.5 shadow-card border border-gray-200/70 dark:border-white/[0.06] overflow-x-auto">
        {PERIODS.map((p) => {
          const active = p.key === period
          return (
            <button
              key={p.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setPeriod(p.key)}
              className={`flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2.5 text-sm font-semibold transition-colors ${
                active ? 'bg-[#13306f] text-white shadow-sm' : 'text-brand-900 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/[0.06]'
              }`}
            >
              {active && <CalendarDays size={16} />} {p.label}
            </button>
          )
        })}
      </div>
    </div>
  )

  const topCards = (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      <SellCard onClick={() => navigate('/petites-ventes')} />
      <ActionCard
        icon={FileText}
        tone="blue"
        title="Nouvelle facture"
        hint="Ou un devis pour un client"
        caption={`Encaissé · ${periodInfo.label.toLowerCase()}`}
        value={kpis ? currency(kpis.cash.cur) : '—'}
        trend={kpis ? <Trend pct={kpis.cash.pct} compareLabel={periodInfo.compare} /> : trendsError && <span className="text-xs text-red-500">Chiffres indisponibles</span>}
        spark={kpis?.cash.spark}
        loading={trendsLoading}
        onClick={() => navigate('/ventes?nouveau=1')}
      />
      <ActionCard
        icon={Box}
        tone="violet"
        title="Entrée de stock"
        hint="Réception de marchandise"
        caption={`Achats · ${periodInfo.label.toLowerCase()}`}
        value={kpis ? currency(kpis.purchases.cur) : '—'}
        trend={kpis ? <Trend pct={kpis.purchases.pct} compareLabel={periodInfo.compare} /> : trendsError && <span className="text-xs text-red-500">Chiffres indisponibles</span>}
        spark={kpis?.purchases.spark}
        loading={trendsLoading}
        onClick={() => navigate('/stock?nouveau=1')}
      />
      <ActionCard
        icon={Users}
        tone="green"
        title="Nouveau client"
        hint="Ajouter au fichier clients"
        caption="Clients enregistrés"
        value={kpis ? kpis.clients.total : '—'}
        trend={
          kpis && (
            <span className={`flex items-center gap-1 text-sm font-bold ${kpis.clients.added > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400'}`}>
              <ArrowUp size={15} strokeWidth={3} /> +{kpis.clients.added}
              <span className="text-xs font-normal text-gray-400">{periodInfo.key === 'today' ? "aujourd'hui" : periodInfo.label.toLowerCase()}</span>
            </span>
          )
        }
        spark={kpis?.clients.spark}
        loading={trendsLoading}
        onClick={() => navigate('/clients?nouveau=1')}
      />
    </div>
  )

  if (isLoading) {
    return (
      <div className="space-y-6">
        {header}
        {topCards}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="card !rounded-3xl h-[330px] lg:col-span-2 animate-pulse" />
          <div className="card !rounded-3xl h-[330px] animate-pulse" />
        </div>
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="space-y-6">
        {header}
        <div className="card p-8 text-center space-y-3">
          <p className="font-medium">Impossible de charger le tableau de bord.</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">{error?.message}</p>
          <button className="btn-secondary" onClick={() => refetch()}>Réessayer</button>
        </div>
      </div>
    )
  }

  const lowStockList = (data.lowStock || []).slice().sort((a, b) => (a.stock ?? 0) - (b.stock ?? 0))
  const topProducts = (data.topProducts || []).slice(0, 5)
  const topMax = Math.max(1, ...topProducts.map((p) => p.quantity))
  const week = (data.weekSeries || []).map((d) => ({ ...d, label: capitalize(d.label) }))
  const weekTotal = week.reduce((s, d) => s + d.factures + d.caisse, 0)

  return (
    <div className="space-y-6">
      {header}
      {topCards}

      {/* 7 derniers jours + bilan du mois */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <section className="card !rounded-3xl lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5">
            <div>
              <h2 className="flex items-center gap-2.5 text-lg font-bold text-brand-900 dark:text-gray-50">
                <BarChart3 size={22} className="text-[#1e3a7b] dark:text-blue-300" /> Encaissements des 7 derniers jours
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 ml-8">Total : <strong className="tabular">{currency(weekTotal)}</strong></p>
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-300">
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: NAVY }} /> Factures</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: ORANGE }} /> Caisse rapide</span>
            </div>
          </div>
          <div className="p-4 pt-4">
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={week} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
                <CartesianGrid stroke="currentColor" className="text-gray-100 dark:text-white/[0.06]" />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#4b5563' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#4b5563' }} axisLine={false} tickLine={false} tickFormatter={compact} width={48} />
                <Tooltip content={<WeekTooltip />} cursor={{ fill: 'rgba(30,58,123,0.06)' }} />
                <Bar dataKey="factures" name="Factures" stackId="a" fill={NAVY} maxBarSize={46} radius={[3, 3, 0, 0]} />
                <Bar dataKey="caisse" name="Caisse rapide" stackId="a" fill={ORANGE} radius={[3, 3, 0, 0]} maxBarSize={46} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="card !rounded-3xl flex flex-col">
          <SectionTitle icon={PieChart} iconClass="text-[#1e3a7b] dark:text-blue-300" action="Voir plus" onAction={() => navigate('/finances')}>
            Bilan du mois
          </SectionTitle>
          <div className="px-5">
            <BilanRow icon={Wallet} chip="bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300" label="Encaissements" value={data.totalMonth} valueClass="text-brand-900 dark:text-gray-50" />
            <BilanRow icon={TrendingUp} chip="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300" label="Marge brute" value={data.grossMarginMonth} valueClass="text-emerald-600 dark:text-emerald-400" />
            <BilanRow icon={ShoppingBag} chip="bg-red-50 text-red-500 dark:bg-red-500/15 dark:text-red-300" label="Dépenses" value={data.totalExpensesMonth} valueClass="text-red-600 dark:text-red-400" />
            <BilanRow
              icon={HandCoins}
              chip="bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300"
              label={`Dettes clients (${data.debtClients})`}
              value={data.debtTotal}
              valueClass="text-amber-700 dark:text-amber-400"
              onClick={() => navigate('/clients')}
            />
          </div>
          <div className={`relative overflow-hidden mx-4 mb-4 mt-2 rounded-2xl px-4 py-4 flex items-center gap-3.5 ${data.profitMonth >= 0 ? 'bg-emerald-50 dark:bg-emerald-500/10' : 'bg-red-50 dark:bg-red-500/10'}`}>
            {data.profitMonth >= 0 ? (
              <CheckCircle2 size={36} className="shrink-0 text-white fill-emerald-500" />
            ) : (
              <AlertTriangle size={32} className="shrink-0 text-red-500" />
            )}
            <div className="relative">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Bénéfice réel (marge − dépenses)</p>
              <p className={`text-2xl font-extrabold tabular ${data.profitMonth >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>{currency(data.profitMonth)}</p>
            </div>
            <svg viewBox="0 0 80 40" className="hidden sm:block absolute right-3 bottom-2 h-10 w-20 opacity-60" aria-hidden="true">
              {[8, 14, 11, 20, 17, 27].map((h, i) => (
                <rect key={i} x={i * 13} y={40 - h} width="9" height={h} rx="2" fill={data.profitMonth >= 0 ? '#86efac' : '#fca5a5'} />
              ))}
              <path d="M4 26 L30 20 L44 24 L74 6" fill="none" stroke={data.profitMonth >= 0 ? '#16a34a' : '#dc2626'} strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
        </section>
      </div>

      {/* Stock faible + meilleures ventes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="card !rounded-3xl">
          <SectionTitle
            icon={AlertTriangle}
            iconClass="text-amber-500 fill-amber-100 dark:fill-amber-500/20"
            action={lowStockList.length > 0 ? `Voir tout (${lowStockList.length})` : null}
            onAction={() => navigate('/stock')}
          >
            Stock faible
          </SectionTitle>
          {lowStockList.length === 0 ? (
            <p className="px-5 pb-8 pt-4 text-sm text-center text-gray-500 dark:text-gray-400">Tout est en ordre : aucun produit sous son seuil d'alerte.</p>
          ) : (
            <ul className="px-5 pb-3 divide-y divide-gray-100 dark:divide-white/[0.06]">
              {lowStockList.slice(0, 6).map((p) => (
                <li key={p.id} className="flex items-center gap-3.5 py-2.5">
                  <ProductThumb src={p.image_url} />
                  <span className="flex-1 min-w-0 text-sm font-bold uppercase text-brand-900 dark:text-gray-100 truncate">{p.name}</span>
                  <span className={`badge shrink-0 px-3 py-1 font-semibold ${Number(p.stock) <= 0 ? 'bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400' : 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-400'}`}>
                    {Number(p.stock) <= 0 ? 'Rupture' : `${formatQty(p.stock)} restant${Number(p.stock) > 1 ? 's' : ''}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card !rounded-3xl">
          <SectionTitle icon={Trophy} iconClass="text-accent-500 fill-accent-200 dark:fill-accent-500/30" action="Voir tout" onAction={() => navigate('/rapports')}>
            Meilleures ventes du mois
          </SectionTitle>
          {topProducts.length === 0 ? (
            <p className="px-5 pb-8 pt-4 text-sm text-center text-gray-500 dark:text-gray-400">Aucune vente ce mois-ci.</p>
          ) : (
            <ul className="px-5 pb-5 pt-1 space-y-3">
              {topProducts.map((p, i) => (
                <li key={p.name} className="flex items-center gap-3.5">
                  <span className="h-8 w-8 shrink-0 rounded-full bg-gray-100 dark:bg-white/[0.06] text-sm font-bold text-brand-900 dark:text-gray-200 flex items-center justify-center">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-sm font-bold uppercase text-brand-900 dark:text-gray-100 truncate">{p.name}</span>
                      <span className="shrink-0 text-sm text-gray-600 dark:text-gray-400 tabular">{formatQty(p.quantity)} · {currency(p.revenue)}</span>
                    </div>
                    <div className="mt-1.5 h-2 rounded-full bg-gray-100 dark:bg-white/[0.06] overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-accent-500 to-accent-400" style={{ width: `${(p.quantity / topMax) * 100}%` }} />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
