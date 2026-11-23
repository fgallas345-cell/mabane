import { useMemo, useState } from 'react'
import PageHeader, { PanelTitle, InfoChip } from '../../components/PageHeader'
import { BarChart3, TrendingUp, Wallet, Receipt, ShoppingBag, FileSpreadsheet, Percent, Users, Tags, CreditCard, UserCheck, LineChart, CalendarDays } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { useReport } from '../../hooks/useReports'
import { periodRange } from '../../utils/reports'
import StatCard from '../../components/StatCard'
import { currency } from '../../lib/constants'
import { formatQty } from '../../utils/quantity'

const NAVY = '#1e3a7b'
const ORANGE = '#f39e26'

const PRESETS = [
  { value: 'today', label: "Aujourd'hui" },
  { value: 'week', label: '7 jours' },
  { value: 'month', label: 'Ce mois' },
  { value: 'lastMonth', label: 'Mois dernier' },
  { value: 'year', label: 'Cette année' },
  { value: 'custom', label: 'Dates…' },
]

const isoDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const pct = (v) => `${(v * 100).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`
const compact = (v) => new Intl.NumberFormat('fr-FR', { notation: 'compact' }).format(v)

function SeriesTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const total = payload.reduce((s, p) => s + Number(p.value || 0), 0)
  return (
    <div className="panel px-3 py-2 text-sm shadow-lift">
      <p className="font-semibold mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: p.fill }} /> {p.name} : <strong className="tabular">{currency(p.value)}</strong>
        </p>
      ))}
      <p className="mt-1 pt-1 border-t border-gray-100 dark:border-white/10 font-semibold tabular">Total : {currency(total)}</p>
    </div>
  )
}

/** Tableau classé avec barre de proportion */
function RankTable({ icon: Icon, title, rows, columns, empty = 'Aucune donnée sur la période.', limit = 10 }) {
  const [showAll, setShowAll] = useState(false)
  const visible = showAll ? rows : rows.slice(0, limit)
  const max = Math.max(1, ...rows.map((r) => Math.abs(columns[0].value(r))))
  return (
    <section className="panel overflow-hidden">
      <PanelTitle icon={Icon} title={title}>
        <InfoChip>{rows.length} ligne{rows.length > 1 ? 's' : ''}</InfoChip>
      </PanelTitle>
      {rows.length === 0 ? (
        <p className="px-5 py-8 text-sm text-center text-gray-500 dark:text-gray-400">{empty}</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="table-th">#</th>
                  <th className="table-th">Nom</th>
                  {columns.map((c) => <th key={c.label} className="table-th text-right">{c.label}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/[0.06]">
                {visible.map((r, i) => (
                  <tr key={`${r.name}-${i}`}>
                    <td className="table-td w-12">
                      <span className="h-7 w-7 rounded-full bg-gray-100 dark:bg-white/[0.06] text-xs font-bold text-brand-900 dark:text-gray-200 flex items-center justify-center">{i + 1}</span>
                    </td>
                    <td className="table-td">
                      <p className="font-bold uppercase text-brand-900 dark:text-gray-100 max-w-[240px] truncate">{r.name}</p>
                      <div className="mt-1.5 h-2 rounded-full bg-gray-100 dark:bg-white/[0.06] max-w-[240px]">
                        <div className="h-full rounded-full bg-gradient-to-r from-accent-500 to-accent-400" style={{ width: `${(Math.abs(columns[0].value(r)) / max) * 100}%` }} />
                      </div>
                    </td>
                    {columns.map((c) => (
                      <td key={c.label} className={`table-td text-right tabular ${c.className?.(r) || ''}`}>{c.format(c.value(r), r)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length > limit && (
            <button type="button" className="w-full py-2.5 text-sm font-medium text-[#1d4fb8] dark:text-blue-300 hover:bg-gray-50 dark:hover:bg-white/[0.03] border-t border-gray-100 dark:border-white/[0.06]" onClick={() => setShowAll((s) => !s)}>
              {showAll ? 'Réduire' : `Voir les ${rows.length} lignes`}
            </button>
          )}
        </>
      )}
    </section>
  )
}

export default function Reports() {
  const [preset, setPreset] = useState('month')
  const [custom, setCustom] = useState(() => ({ from: isoDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1)), to: isoDate(new Date()) }))
  const { from, to } = useMemo(() => periodRange(preset, custom), [preset, custom])
  const { data, isLoading, isError, error, refetch } = useReport(from, to)

  const periodLabel = `${from.toLocaleDateString('fr-FR')} → ${new Date(to - 1).toLocaleDateString('fr-FR')}`

  const exportReport = async () => {
    if (!data) return
    const { downloadWorkbookSheets } = await import('../../utils/exportExcel')
    const k = data.kpis
    await downloadWorkbookSheets(
      [
        {
          name: 'Synthèse',
          rows: [
            { Indicateur: 'Période', Valeur: periodLabel },
            { Indicateur: "Chiffre d'affaires", Valeur: k.revenue },
            { Indicateur: '  dont factures', Valeur: k.invoicesRevenue },
            { Indicateur: '  dont caisse rapide', Valeur: k.cashRevenue },
            { Indicateur: 'Encaissé', Valeur: k.collected },
            { Indicateur: 'Remises accordées', Valeur: k.discounts },
            { Indicateur: 'Marge brute', Valeur: k.grossMargin },
            { Indicateur: 'Taux de marge', Valeur: pct(k.marginRate) },
            { Indicateur: 'Dépenses', Valeur: k.expenses },
            { Indicateur: 'Bénéfice', Valeur: k.profit },
            { Indicateur: 'Nombre de ventes', Valeur: k.count },
            { Indicateur: 'Panier moyen', Valeur: Math.round(k.avgBasket) },
          ],
        },
        { name: 'Produits', rows: data.topProducts.map((p) => ({ Produit: p.name, Quantité: p.quantity, "Chiffre d'affaires": p.revenue, Marge: Math.round(p.margin) })) },
        { name: 'Catégories', rows: data.byCategory.map((c) => ({ Catégorie: c.name, "Chiffre d'affaires": c.revenue, Marge: Math.round(c.margin), Part: pct(c.share) })) },
        { name: 'Clients', rows: data.topClients.map((c) => ({ Client: c.name, Factures: c.count, "Chiffre d'affaires": c.revenue, 'Reste dû': c.due })) },
        { name: 'Vendeurs', rows: data.bySeller.map((s) => ({ Vendeur: s.name, Ventes: s.count, "Chiffre d'affaires": s.revenue })) },
        { name: 'Encaissements', rows: data.byMethod.map((m) => ({ Mode: m.label, Montant: m.amount })) },
        { name: 'Dépenses', rows: data.expensesByCategory.map((e) => ({ Catégorie: e.name, Montant: e.amount })) },
      ],
      `rapport-mabane-${isoDate(from)}-au-${isoDate(new Date(to - 1))}.xlsx`
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader icon={BarChart3} badge={LineChart} title="Rapports" subtitle={`Chiffre d’affaires, marge et classements sur la période de votre choix · ${periodLabel}`}>
        <button type="button" className="btn-cta" disabled={!data} onClick={exportReport}>
          <FileSpreadsheet size={18} /> Exporter le rapport (Excel)
        </button>
      </PageHeader>

      <div className="flex flex-col md:flex-row md:items-center gap-3">
        <div className="flex flex-wrap items-center gap-1 rounded-3xl md:rounded-full bg-white dark:bg-darkcard p-1.5 shadow-card border border-gray-200/70 dark:border-white/[0.06]" role="radiogroup" aria-label="Période">
          {PRESETS.map((p) => (
            <button
              key={p.value}
              type="button"
              role="radio"
              aria-checked={preset === p.value}
              onClick={() => setPreset(p.value)}
              className={`flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition-colors ${
                preset === p.value ? 'bg-[#13306f] text-white shadow-sm' : 'text-brand-900 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/[0.06]'
              }`}
            >
              {preset === p.value && <CalendarDays size={16} />} {p.label}
            </button>
          ))}
        </div>
        {preset === 'custom' && (
          <div className="flex items-center gap-2 md:ml-auto">
            <input type="date" aria-label="Du" className="filter-select !w-44" value={custom.from} max={custom.to} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} />
            <span className="text-gray-400">→</span>
            <input type="date" aria-label="Au" className="filter-select !w-44" value={custom.to} min={custom.from} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} />
          </div>
        )}
      </div>

      {isError ? (
        <div className="panel p-8 text-center space-y-3">
          <p className="font-medium">Impossible de charger le rapport.</p>
          <p className="text-sm text-gray-500">{error?.message}</p>
          <button className="btn-secondary" onClick={() => refetch()}>Réessayer</button>
        </div>
      ) : isLoading || !data ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="panel h-[108px] animate-pulse" />)}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <StatCard featured icon={TrendingUp} label="Chiffre d'affaires" value={currency(data.kpis.revenue)} sub={`Factures ${compact(data.kpis.invoicesRevenue)} · Caisse ${compact(data.kpis.cashRevenue)}`} />
            <StatCard icon={Wallet} color="brand" label="Encaissé" value={currency(data.kpis.collected)} sub="Paiements reçus sur la période" />
            <StatCard icon={Percent} color="emerald" label="Marge brute" value={currency(data.kpis.grossMargin)} sub={`Taux : ${pct(data.kpis.marginRate)}`} />
            <StatCard icon={BarChart3} color={data.kpis.profit >= 0 ? 'emerald' : 'red'} label="Bénéfice" value={currency(data.kpis.profit)} sub={`Dépenses : ${currency(data.kpis.expenses)}`} />
            <StatCard icon={ShoppingBag} color="violet" label="Ventes" value={data.kpis.count} sub={`${data.kpis.invoicesCount} factures · ${data.kpis.cashCount} caisse`} />
            <StatCard icon={Receipt} color="accent" label="Panier moyen" value={currency(data.kpis.avgBasket)} />
            <StatCard icon={Tags} color="amber" label="Remises accordées" value={currency(data.kpis.discounts)} />
            <StatCard icon={Users} label="Clients facturés" value={data.topClients.filter((c) => c.name !== 'Client comptoir').length} />
          </div>

          <section className="panel">
            <PanelTitle icon={BarChart3} title={`Chiffre d’affaires ${data.granularity === 'month' ? 'par mois' : 'par jour'}`}>
              <span className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-300">
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: NAVY }} /> Factures</span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: ORANGE }} /> Caisse rapide</span>
              </span>
            </PanelTitle>
            <div className="p-4 pt-5">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data.series} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-gray-100 dark:text-white/[0.06]" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#8b95a5' }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={12} />
                  <YAxis tick={{ fontSize: 11, fill: '#8b95a5' }} axisLine={false} tickLine={false} tickFormatter={compact} width={44} />
                  <Tooltip content={<SeriesTooltip />} cursor={{ fill: 'rgba(30,69,114,0.06)' }} />
                  <Bar dataKey="factures" name="Factures" stackId="a" fill={NAVY} maxBarSize={40} radius={[3, 3, 0, 0]} />
                  <Bar dataKey="caisse" name="Caisse rapide" stackId="a" fill={ORANGE} radius={[5, 5, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <RankTable
              icon={ShoppingBag}
              title="Produits les plus vendus"
              rows={data.topProducts}
              columns={[
                { label: 'CA', value: (r) => r.revenue, format: (v) => currency(v) },
                { label: 'Qté', value: (r) => r.quantity, format: (v) => formatQty(v) },
                { label: 'Marge', value: (r) => r.margin, format: (v) => currency(v), className: (r) => (r.margin < 0 ? 'text-red-600 dark:text-red-400' : '') },
              ]}
            />
            <RankTable
              icon={Tags}
              title="Ventes par catégorie"
              rows={data.byCategory}
              columns={[
                { label: 'CA', value: (r) => r.revenue, format: (v) => currency(v) },
                { label: 'Part', value: (r) => r.share, format: (v) => pct(v) },
                { label: 'Marge', value: (r) => r.margin, format: (v) => currency(v) },
              ]}
            />
            <RankTable
              icon={Users}
              title="Meilleurs clients (factures)"
              rows={data.topClients}
              columns={[
                { label: 'CA', value: (r) => r.revenue, format: (v) => currency(v) },
                { label: 'Factures', value: (r) => r.count, format: (v) => v },
                { label: 'Reste dû', value: (r) => r.due, format: (v) => (v ? currency(v) : '—'), className: (r) => (r.due ? 'text-red-600 dark:text-red-400' : '') },
              ]}
            />
            <div className="space-y-4">
              <RankTable
                icon={UserCheck}
                title="Ventes par vendeur"
                rows={data.bySeller}
                limit={5}
                columns={[
                  { label: 'CA', value: (r) => r.revenue, format: (v) => currency(v) },
                  { label: 'Ventes', value: (r) => r.count, format: (v) => v },
                ]}
              />
              <RankTable
                icon={CreditCard}
                title="Encaissements par mode de paiement"
                rows={data.byMethod.map((m) => ({ name: m.label, amount: m.amount }))}
                limit={6}
                columns={[{ label: 'Montant', value: (r) => r.amount, format: (v) => currency(v) }]}
              />
            </div>
          </div>
        </>
      )}
    </div>
  )
}
