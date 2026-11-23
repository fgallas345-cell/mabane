// Périodes du tableau de bord et comparaison avec la période précédente de même durée.

export const PERIODS = [
  { key: 'today', label: "Aujourd'hui", compare: 'hier' },
  { key: '7d', label: '7 jours', compare: '7 j. précédents' },
  { key: '30d', label: '30 jours', compare: '30 j. précédents' },
  { key: 'month', label: 'Ce mois', compare: 'mois dernier' },
]

const DAY = 24 * 60 * 60 * 1000

function startOfDay(d) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

/**
 * Bornes de la période [start, end[ et de la période précédente [prevStart, prevEnd[.
 * Les périodes « en cours » sont comparées à la même durée écoulée : aujourd'hui jusqu'à
 * maintenant vs hier jusqu'à la même heure, ce mois-ci vs le mois dernier au même quantième.
 * La période courante s'arrête à la fin de la journée (et non à « maintenant ») : une vente
 * horodatée par le serveur quelques secondes « dans le futur » (horloge du PC en retard) est comptée.
 * sparkStart / sparkEnd : bornes de la mini-courbe (au moins 7 jours pour qu'elle ait une forme).
 */
export function periodRange(key, now = new Date()) {
  const today = startOfDay(now)
  const end = new Date(today.getTime() + DAY)
  let start
  let prevStart
  let prevEnd
  switch (key) {
    case '7d':
    case '30d': {
      const days = key === '7d' ? 7 : 30
      start = new Date(today.getTime() - (days - 1) * DAY)
      prevStart = new Date(start.getTime() - days * DAY)
      prevEnd = start
      break
    }
    case 'month': {
      start = new Date(now.getFullYear(), now.getMonth(), 1)
      prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      // Même quantième le mois dernier (borné à la fin du mois dernier : 31 mars → 28/29 février)
      prevEnd = new Date(Math.min(new Date(prevStart.getFullYear(), prevStart.getMonth(), now.getDate(), now.getHours(), now.getMinutes()).getTime(), start.getTime()))
      break
    }
    case 'today':
    default:
      start = today
      prevStart = new Date(today.getTime() - DAY)
      prevEnd = new Date(now.getTime() - DAY)
  }
  const sparkStart = new Date(Math.min(start.getTime(), today.getTime() - 6 * DAY))
  return { start, end, prevStart, prevEnd, sparkStart, sparkEnd: new Date(now) }
}

/** Somme des valeurs v des lignes { at, v } dans [from, to[ */
export function sumBetween(rows, from, to) {
  const a = from.getTime()
  const b = to.getTime()
  let total = 0
  for (const r of rows || []) {
    const t = new Date(r.at).getTime()
    if (t >= a && t < b) total += r.v
  }
  return total
}

/** Totaux jour par jour de from à to inclus (pour les mini-courbes) */
export function dailySeries(rows, from, to) {
  const first = startOfDay(from)
  const days = Math.max(1, Math.round((startOfDay(to) - first) / DAY) + 1)
  const out = new Array(days).fill(0)
  for (const r of rows || []) {
    const i = Math.floor((startOfDay(r.at) - first) / DAY)
    if (i >= 0 && i < days) out[i] += r.v
  }
  return out
}

/** Variation en % (arrondie), ou null quand la période précédente est vide */
export function trendPct(current, previous) {
  if (!previous) return null
  return Math.round(((current - previous) / Math.abs(previous)) * 100)
}
