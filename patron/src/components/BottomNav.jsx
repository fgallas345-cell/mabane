// Barre de navigation du bas, flottante, façon application native :
// un indicateur marine glisse sous l'onglet actif, petite vibration au toucher (Android),
// badge rouge sur les alertes, respecte la zone du geste d'accueil (iPhone / Android).

/** Petite vibration de confirmation, si le téléphone la permet */
const haptic = () => {
  try {
    navigator.vibrate?.(8)
  } catch {
    /* non disponible : ignoré */
  }
}

export default function BottomNav({ tabs, active, onChange, badges = {} }) {
  const index = Math.max(0, tabs.findIndex((t) => t.key === active))

  return (
    <nav aria-label="Navigation principale" className="shrink-0 bg-page px-3 pt-1.5 pb-[max(env(safe-area-inset-bottom),12px)]">
      <div className="relative grid rounded-[26px] bg-white/95 backdrop-blur border border-gray-100 shadow-nav p-1.5" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
        {/* Indicateur qui glisse sous l'onglet actif */}
        <span
          aria-hidden="true"
          className="absolute top-1.5 bottom-1.5 left-1.5 rounded-[20px] bg-navy-700 shadow-pill transition-transform duration-300 ease-out"
          // largeur d'une colonne = (largeur intérieure − 2 × 6 px de marge) / nombre d'onglets ; on glisse d'une colonne par onglet
          style={{ width: `calc((100% - 12px) / ${tabs.length})`, transform: `translateX(${index * 100}%)` }}
        />
        {tabs.map((t) => {
          const isActive = t.key === active
          const Icon = t.icon
          const badge = badges[t.key] || 0
          return (
            <button
              key={t.key}
              type="button"
              aria-current={isActive ? 'page' : undefined}
              onClick={() => {
                if (!isActive) haptic()
                onChange(t.key)
              }}
              className={`relative z-10 flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-[20px] py-2 transition-colors duration-200 ${isActive ? 'text-white' : 'text-gray-500 active:text-navy-700'}`}
            >
              <span className="relative">
                <Icon size={22} strokeWidth={isActive ? 2.4 : 2} className={`transition-transform duration-200 ${isActive ? 'scale-110' : ''}`} />
                {badge > 0 && (
                  <span className="absolute -top-2 left-3 min-w-[20px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold leading-[18px] text-center ring-2 ring-white">
                    {badge > 99 ? '99+' : badge}
                  </span>
                )}
              </span>
              <span className={`max-w-full truncate text-[11.5px] leading-tight ${isActive ? 'font-bold' : 'font-semibold'}`}>{t.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
