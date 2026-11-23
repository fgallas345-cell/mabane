// Quantités : entières pour les articles à la pièce, décimales (3 chiffres max) pour les
// unités de mesure (câble au mètre, clous au kilo, peinture au litre...).

const DECIMAL_UNITS = new Set(['kg', 'g', 'm', 'mètre', 'metre', 'mètres', 'l', 'litre', 'litres', 'ml', 'm²', 'm2', 'm³', 'm3', 'tonne', 't'])

/** L'unité se vend-elle au détail (quantité décimale) ? */
export function isDecimalUnit(unit) {
  return DECIMAL_UNITS.has(String(unit || '').trim().toLowerCase())
}

/** Pas de saisie conseillé pour une unité (0,5 pour kg / m / L, 1 sinon) */
export function qtyStep(unit) {
  return isDecimalUnit(unit) ? 0.5 : 1
}

/** Arrondi à 3 décimales (évite 0,1 + 0,2 = 0,30000000000000004) */
export function roundQty(value) {
  return Math.round(Number(value || 0) * 1000) / 1000
}

/** « 2 », « 1,5 », « 2,25 kg » : sans décimales inutiles */
export function formatQty(value, unit) {
  const n = roundQty(value)
  const text = n.toLocaleString('fr-FR', { maximumFractionDigits: 3 })
  const u = String(unit || '').trim()
  return u && u !== 'unité' ? `${text} ${u}` : text
}

/** Lit une saisie utilisateur (« 1,5 » ou « 1.5 ») ; renvoie NaN si invalide */
export function parseQty(input) {
  if (typeof input === 'number') return input
  const n = Number(String(input ?? '').replace(/\s/g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : NaN
}
