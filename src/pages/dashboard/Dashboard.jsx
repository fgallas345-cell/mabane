import { ShoppingBag, TrendingUp, AlertTriangle, Wallet, Package } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts'
import { useDashboard } from '../../hooks/useDashboard'
import StatCard from '../../components/StatCard'
import { currency } from '../../lib/constants'
import { useAuth } from '../../context/AuthContext'

// Palette cohérente avec la marque
const BRAND = '#2563eb'      // bleu (brand-600)
const EMERALD = '#10b981'    // vert
const RED = '#ef4444'        // rouge
const AMBER = '#f59e0b'      // ambre
const GRAY = '#e5e7eb'       // gris clair (fond des donuts)

function CurrencyTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg px-3 py-2 text-sm">
      <p className="font-medium mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.fill || p.color }}>
          {p.name} : <span className="font-semibold">{currency(p.value)}</span>
        </p>
      ))}
    </div>
  )
}

function QtyTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null
  const p = payload[0]
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg px-3 py-2 text-sm">
      <p className="font-medium mb-1">{label}</p>
      <p style={{ color: p.fill }}>{p.value} vendus</p>
      {p.payload.revenue != null && (
        <p className="text-gray-500 dark:text-gray-400 text-xs mt-0.5">{currency(p.payload.revenue)}</p>
      )}
    </div>
  )
}

export default function Dashboard() {
  const { data, isLoading } = useDashboard()
  const { profile } = useAuth()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-brand-500 border-t-transparent" />
      </div>
    )
  }

  // --- Données pour le graphique Revenus / Dépenses / Bénéfice ---
  const financeData = [
    { name: 'Revenus', value: data.totalMonth, color: BRAND },
    { name: 'Marge', value: data.grossMarginMonth, color: EMERALD },
    { name: 'Dépenses', value: data.totalExpensesMonth, color: RED },
    { name: 'Bénéfice', value: data.profitMonth, color: data.profitMonth >= 0 ? EMERALD : RED },
  ]

  // --- Données pour le top produits (triées, top 6 max pour rester lisible) ---
      const topProductsData = (data.topProducts || [])
        .slice(0, 6)
        .map((p) => ({ name: p.name, quantite: p.quantity, revenue: p.revenue }))
        .reverse()

      const lowStockList = (data.lowStock || [])
        .slice()
        .sort((a, b) => (a.stock ?? 0) - (b.stock ?? 0))

  // --- Données pour le donut "santé du stock" ---
  const healthyCount = Math.max((data.totalProducts || 0) - (data.lowStock?.length || 0), 0)
  const stockHealthData = [
    { name: 'Stock correct', value: healthyCount, color: EMERALD },
    { name: 'En rupture / faible', value: data.lowStock?.length || 0, color: AMBER },
  ]
  const hasStockData = (data.totalProducts || 0) > 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Bonjour, {profile?.full_name?.split(' ')[0] || ''} 👋</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
          Voici un aperçu de l'activité de la quincaillerie aujourd'hui.
        </p>
      </div>

      {/* Cartes statistiques */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={ShoppingBag}
          label="Ventes du jour"
          value={data.salesTodayCount}
          sub={currency(data.totalToday)}
          color="brand"
        />
        <StatCard
          icon={TrendingUp}
          label="Revenus du mois"
          value={currency(data.totalMonth)}
          sub={`${data.salesMonthCount} ventes`}
          color="emerald"
        />
        <StatCard
          icon={Wallet}
          label="Bénéfice réel du mois"
          value={currency(data.profitMonth)}
          sub={`Marge : ${currency(data.grossMarginMonth)}`}
          color={data.profitMonth >= 0 ? 'emerald' : 'red'}
        />
        <StatCard
          icon={AlertTriangle}
          label="Produits en rupture"
          value={data.lowStock.length}
          sub={`Sur ${data.totalProducts} produits`}
          color="amber"
        />
      </div>

      {/* Graphiques : Finances + Santé du stock */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card p-5 lg:col-span-2">
          <h3 className="font-semibold mb-1 flex items-center gap-2">
            <Wallet size={18} className="text-brand-500" /> Revenus, dépenses & bénéfice
          </h3>
          <p className="text-xs text-gray-400 mb-3">Vue d'ensemble du mois en cours</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={financeData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-gray-200 dark:text-gray-700" />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => new Intl.NumberFormat('fr-FR', { notation: 'compact' }).format(v)}
              />
              <Tooltip content={<CurrencyTooltip />} cursor={{ fill: 'rgba(37,99,235,0.06)' }} />
              <Bar dataKey="value" name="Montant" radius={[6, 6, 0, 0]} maxBarSize={56}>
                {financeData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-5 flex flex-col">
          <h3 className="font-semibold mb-1 flex items-center gap-2">
            <AlertTriangle size={18} className="text-amber-500" /> Santé du stock
          </h3>
          <p className="text-xs text-gray-400 mb-1">
            {hasStockData ? `${data.lowStock.length} sur ${data.totalProducts} produits` : 'Aucun produit enregistré'}
          </p>
          {hasStockData ? (
            <div className="relative flex-1 min-h-[180px]">
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={stockHealthData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={50}
                    outerRadius={72}
                    paddingAngle={2}
                    stroke="none"
                  >
                    {stockHealthData.map((entry, i) => (
                      <Cell key={i} fill={entry.value === 0 ? GRAY : entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, name) => [`${value} produit${value > 1 ? 's' : ''}`, name]}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-2xl font-bold">{healthyCount}</span>
                <span className="text-[11px] text-gray-400">en bon état</span>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-sm text-gray-400">
              Pas encore de données
            </div>
          )}
          <div className="flex items-center justify-center gap-4 mt-2 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: EMERALD }} /> Correct
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: AMBER }} /> Faible
            </span>
          </div>
        </div>
      </div>

      {/* Alertes de stock + Top produits */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-5">
          <h3 className="font-semibold mb-1 flex items-center gap-2">
            <AlertTriangle size={18} className="text-amber-500" /> Alertes de stock
          </h3>
          <p className="text-xs text-gray-400 mb-3">
            {data.lowStock.length === 0 ? 'Aucun produit en dessous du seuil d’alerte.' : `${data.lowStock.length} produit${data.lowStock.length > 1 ? 's' : ''} en alerte`}
          </p>
          {lowStockList.length === 0 ? (
            <p className="text-sm text-gray-400">Aucun produit en dessous du seuil d’alerte. 👍</p>
          ) : (
            <div className="space-y-2">
              {lowStockList.slice(0, 10).map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-amber-50 dark:bg-amber-500/10"
                >
                  <span className="text-sm font-medium">{p.name}</span>
                  <span className="badge bg-amber-200 text-amber-800 dark:bg-amber-500/20 dark:text-amber-400">
                    {p.stock} restant
                  </span>
                </div>
              ))}
              {lowStockList.length > 10 && (
                <p className="text-xs text-gray-400 text-center pt-1">
                  + {lowStockList.length - 10} autre{lowStockList.length - 10 > 1 ? 's' : ''} produit{lowStockList.length - 10 > 1 ? 's' : ''} en alerte
                </p>
              )}
            </div>
          )}
        </div>

        <div className="card p-5">
          <h3 className="font-semibold mb-1 flex items-center gap-2">
            <Package size={18} className="text-brand-500" /> Top produits (ce mois)
          </h3>
          <p className="text-xs text-gray-400 mb-3">Classés par quantité vendue</p>
          {topProductsData.length === 0 ? (
            <p className="text-sm text-gray-400">Aucune vente ce mois-ci.</p>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(topProductsData.length * 38, 160)}>
              <BarChart
                data={topProductsData}
                layout="vertical"
                margin={{ top: 0, right: 24, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="currentColor" className="text-gray-200 dark:text-gray-700" />
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={110}
                  tick={{ fontSize: 12, fill: '#9ca3af' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<QtyTooltip />} cursor={{ fill: 'rgba(37,99,235,0.06)' }} />
                <Bar dataKey="quantite" name="Quantité" fill={BRAND} radius={[0, 6, 6, 0]} maxBarSize={20} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  )
}
