import { describe, it, expect } from 'vitest'
import { periodRange, sumBetween, dailySeries, trendPct } from '../utils/dashboardPeriods'

describe('périodes du tableau de bord', () => {
  const now = new Date(2026, 10, 23, 15, 30) // lundi 23 novembre 2026, 15h30

  it("aujourd'hui est comparé à hier jusqu'à la même heure", () => {
    const r = periodRange('today', now)
    expect(r.start).toEqual(new Date(2026, 10, 23))
    expect(r.prevStart).toEqual(new Date(2026, 10, 22))
    expect(r.prevEnd).toEqual(new Date(2026, 10, 22, 15, 30))
    expect(r.sparkStart).toEqual(new Date(2026, 10, 17))
  })

  it('ce mois est comparé au mois dernier au même quantième', () => {
    const r = periodRange('month', now)
    expect(r.start).toEqual(new Date(2026, 10, 1))
    expect(r.prevStart).toEqual(new Date(2026, 9, 1))
    expect(r.prevEnd).toEqual(new Date(2026, 9, 23, 15, 30))
    // 31 mars → borné au 1er mars (fin de février)
    expect(periodRange('month', new Date(2026, 2, 31, 10)).prevEnd).toEqual(new Date(2026, 2, 1))
  })

  it('7 jours : 7 jours glissants contre les 7 précédents', () => {
    const r = periodRange('7d', now)
    expect(r.start).toEqual(new Date(2026, 10, 17))
    expect(r.prevStart).toEqual(new Date(2026, 10, 10))
    expect(r.prevEnd).toEqual(r.start)
  })

  it('sommes, séries et variation', () => {
    const rows = [
      { at: new Date(2026, 10, 22, 9).toISOString(), v: 100 },
      { at: new Date(2026, 10, 23, 9).toISOString(), v: 150 },
    ]
    const r = periodRange('today', now)
    expect(sumBetween(rows, r.start, r.end)).toBe(150)
    expect(sumBetween(rows, r.prevStart, r.prevEnd)).toBe(100)
    expect(dailySeries(rows, r.sparkStart, r.sparkEnd)).toEqual([0, 0, 0, 0, 0, 100, 150])
    expect(trendPct(150, 100)).toBe(50)
    expect(trendPct(50, 0)).toBeNull()
  })
})

describe('cohérence avec les totaux du tableau de bord', () => {
  it("« Aujourd'hui » et « Ce mois » donnent les mêmes totaux que l'ancien calcul (paiements + caisse rapide)", () => {
    const now = new Date(2026, 10, 23, 15, 30)
    const rows = [
      { at: new Date(2026, 9, 31, 23, 59).toISOString(), v: 999 }, // mois dernier : exclu
      { at: new Date(2026, 10, 1, 0, 0).toISOString(), v: 1000 },
      { at: new Date(2026, 10, 22, 18).toISOString(), v: 2000 },
      { at: new Date(2026, 10, 23, 8).toISOString(), v: 500 },
      { at: new Date(2026, 10, 23, 15, 31).toISOString(), v: 300 }, // horloge serveur en avance : compté
      { at: new Date(2026, 10, 23, 9).toISOString(), v: -200 }, // remboursement
    ]
    const today = periodRange('today', now)
    expect(sumBetween(rows, today.start, today.end)).toBe(600)
    const month = periodRange('month', now)
    expect(sumBetween(rows, month.start, month.end)).toBe(3600)
    // La mini-courbe s'arrête bien aujourd'hui (7 points)
    expect(dailySeries(rows, today.sparkStart, today.sparkEnd)).toHaveLength(7)
  })
})
