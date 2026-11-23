// Carte d'indicateur (même style que le tableau de bord) : tuile d'icône colorée, libellé,
// valeur, sous-texte, petites barres décoratives. `featured` = version marine mise en avant.
const COLORS = {
  brand: { chip: 'bg-blue-100 text-[#1d4fb8] dark:bg-blue-500/15 dark:text-blue-300', bars: '#93b4f5', bg: '' },
  accent: { chip: 'bg-accent-100 text-accent-600 dark:bg-accent-500/15 dark:text-accent-400', bars: '#f8bc66', bg: 'bg-gradient-to-br from-white to-accent-50 dark:from-darkcard dark:to-accent-500/5' },
  emerald: { chip: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300', bars: '#4ade80', bg: 'bg-gradient-to-br from-white to-emerald-50/60 dark:from-darkcard dark:to-emerald-500/5' },
  amber: { chip: 'bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300', bars: '#fbbf24', bg: 'bg-gradient-to-br from-white to-amber-50/70 dark:from-darkcard dark:to-amber-500/5' },
  red: { chip: 'bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-300', bars: '#fca5a5', bg: 'bg-gradient-to-br from-white to-red-50/60 dark:from-darkcard dark:to-red-500/5' },
  violet: { chip: 'bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300', bars: '#c4b5fd', bg: 'bg-gradient-to-br from-white to-violet-50/60 dark:from-darkcard dark:to-violet-500/5' },
}

function Bars({ color }) {
  return (
    <svg viewBox="0 0 90 52" className="pointer-events-none absolute right-4 bottom-4 h-11 w-[72px]" aria-hidden="true">
      {[14, 22, 30, 40, 52].map((h, i) => (
        <rect key={i} x={i * 18 + 2} y={52 - h} width="12" height={h} rx="2.5" fill={color} opacity={0.28 + i * 0.15} />
      ))}
    </svg>
  )
}

function Rising() {
  return (
    <svg viewBox="0 0 90 52" className="pointer-events-none absolute right-4 bottom-4 h-11 w-[72px]" aria-hidden="true">
      <path d="M0 52 L0 44 L22 36 L36 40 L58 22 L72 26 L90 4 L90 52 Z" fill="#3b82f6" opacity="0.45" />
      <path d="M0 44 L22 36 L36 40 L58 22 L72 26 L90 4" fill="none" stroke="#60a5fa" strokeWidth="3" strokeLinejoin="round" />
    </svg>
  )
}

export default function StatCard({ icon: Icon, label, value, sub, color = 'brand', onClick, featured }) {
  const Tag = onClick ? 'button' : 'div'
  const c = COLORS[color] || COLORS.brand
  const interactive = onClick ? 'transition-all hover:-translate-y-0.5 hover:shadow-lift focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500' : ''

  if (featured) {
    return (
      <Tag
        type={onClick ? 'button' : undefined}
        onClick={onClick}
        className={`relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1a3f95] to-[#0d2550] text-white p-5 flex items-center gap-4 text-left w-full min-h-[104px] shadow-[0_14px_30px_-14px_rgba(19,48,111,0.7)] ${interactive}`}
      >
        <span className="h-14 w-14 shrink-0 rounded-2xl bg-[#2f6bea] flex items-center justify-center">
          <Icon size={26} />
        </span>
        <span className="relative min-w-0 pr-16">
          <span className="block text-sm text-white/85">{label}</span>
          <span className="block text-xl xl:text-2xl font-extrabold tabular leading-tight break-words">{value}</span>
          {sub && <span className="block text-xs text-white/70 mt-0.5">{sub}</span>}
        </span>
        <Rising />
      </Tag>
    )
  }

  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`panel ${c.bg} relative overflow-hidden p-5 flex items-center gap-4 text-left w-full min-h-[104px] ${interactive}`}
    >
      <span className={`h-14 w-14 shrink-0 rounded-2xl flex items-center justify-center ${c.chip}`}>
        <Icon size={26} />
      </span>
      <span className="relative min-w-0 pr-16">
        <span className="block text-sm text-gray-600 dark:text-gray-400">{label}</span>
        <span className="block text-xl xl:text-2xl font-extrabold tabular leading-tight text-brand-900 dark:text-gray-50 break-words">{value}</span>
        {sub && <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">{sub}</span>}
      </span>
      <Bars color={c.bars} />
    </Tag>
  )
}
