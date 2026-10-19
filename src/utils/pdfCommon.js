// Briques communes aux documents PDF (facture, bon de livraison, reçu) :
// en-tête de la boutique, tableau d'articles à hauteur variable, montant en lettres.
import { SHOP } from '../lib/constants'
import { ensureFont, setFontSafe } from './pdfFonts'

export const BLUE = [26, 79, 160]
export const BLUE_LIGHT = [207, 224, 247]
export const RED = [192, 57, 43]

export const safeText = (s) =>
  String(s ?? '')
    .replace(/–|—/g, '-')
    .replace(/ | /g, ' ')

/** Crée un document jsPDF (chargé à la demande) avec la police NotoSans */
export async function newDoc(format) {
  const { default: jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format })
  await ensureFont(doc)
  return doc
}

/** Réduit la taille de police jusqu'à ce que le texte tienne dans maxW (évite les débordements de montants) */
export function fitText(doc, text, maxW, size, minSize = 5.5) {
  let s = size
  doc.setFontSize(s)
  while (s > minSize && doc.getTextWidth(text) > maxW) {
    s -= 0.25
    doc.setFontSize(s)
  }
  return s
}

export function dashedLine(doc, x1, y, x2) {
  doc.setDrawColor(120)
  doc.setLineWidth(0.25)
  doc.setLineDashPattern([1, 1], 0)
  doc.line(x1, y, x2, y)
  doc.setLineDashPattern([], 0)
}

// ---------------------------------------------------------------------------
// Montant en lettres (« cent soixante-trois mille francs CFA »)
// ---------------------------------------------------------------------------
const UNITS = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf']
const TENS = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante']

// final : le nombre termine le groupe (« quatre-vingts », « deux cents » prennent un s)
function below100(n, final) {
  if (n < 20) return UNITS[n]
  if (n < 70) {
    const t = Math.floor(n / 10)
    const u = n % 10
    return TENS[t] + (u === 0 ? '' : u === 1 ? ' et un' : `-${UNITS[u]}`)
  }
  if (n < 80) {
    const u = n - 60
    return 'soixante' + (u === 11 ? ' et onze' : `-${UNITS[u]}`)
  }
  const u = n - 80
  return u === 0 ? (final ? 'quatre-vingts' : 'quatre-vingt') : `quatre-vingt-${UNITS[u]}`
}

function below1000(n, final) {
  const h = Math.floor(n / 100)
  const r = n % 100
  const parts = []
  if (h === 1) parts.push('cent')
  else if (h > 1) parts.push(`${UNITS[h]} cent${r === 0 && final ? 's' : ''}`)
  if (r > 0) parts.push(below100(r, final))
  return parts.join(' ')
}

export function numberToFrench(value) {
  const n = Math.floor(Math.abs(Number(value) || 0))
  if (n === 0) return 'zéro'
  const billions = Math.floor(n / 1e9)
  const millions = Math.floor((n % 1e9) / 1e6)
  const thousands = Math.floor((n % 1e6) / 1e3)
  const rest = n % 1e3
  const parts = []
  if (billions) parts.push(billions === 1 ? 'un milliard' : `${below1000(billions, true)} milliards`)
  if (millions) parts.push(millions === 1 ? 'un million' : `${below1000(millions, true)} millions`)
  if (thousands) parts.push(thousands === 1 ? 'mille' : `${below1000(thousands, false)} mille`)
  if (rest) parts.push(below1000(rest, true))
  return parts.join(' ')
}

export function amountInWords(value) {
  const n = Math.floor(Math.abs(Number(value) || 0))
  return `${numberToFrench(n)} franc${n > 1 ? 's' : ''} CFA`
}

// ---------------------------------------------------------------------------
// En-tête de la boutique (bandeau, gérant, activités, téléphones)
// ---------------------------------------------------------------------------
const HEADER_TITLE_H = 11
const HEADER_SUB_H = 7
const INFO_H = 18
export const LETTERHEAD_H = HEADER_TITLE_H + HEADER_SUB_H + 3 + INFO_H + 4

export function drawLetterhead(doc, x, y, w) {
  doc.setFillColor(...BLUE)
  doc.rect(x, y, w, HEADER_TITLE_H, 'F')
  setFontSafe(doc, 'bold')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(14)
  doc.text(safeText(SHOP.name), x + w / 2, y + HEADER_TITLE_H / 2 + 1.5, { align: 'center' })
  y += HEADER_TITLE_H

  doc.setFillColor(...BLUE)
  doc.rect(x, y, w, HEADER_SUB_H, 'F')
  doc.setDrawColor(255, 255, 255)
  doc.setLineWidth(0.3)
  doc.line(x, y, x + w, y)
  doc.setFontSize(8)
  doc.text(safeText(`Gérant : ${SHOP.owner}`), x + w / 2, y + HEADER_SUB_H / 2 + 1, { align: 'center' })
  y += HEADER_SUB_H + 3

  const halfW = w / 2 - 1.5
  doc.setDrawColor(...BLUE)
  doc.setLineWidth(0.4)
  doc.rect(x, y, halfW, INFO_H, 'D')
  doc.rect(x + w / 2 + 1.5, y, halfW, INFO_H, 'D')

  const lineH = 4.6
  doc.setFontSize(7.5)
  doc.setTextColor(...BLUE)
  let ty = y + 5
  const activities = SHOP.activities?.length ? SHOP.activities : ['Quincaillerie']
  activities.slice(0, 3).forEach((line) => {
    doc.text(safeText(line), x + 3, ty)
    ty += lineH
  })

  const rightX = x + w / 2 + 3
  ty = y + 5
  const phones = SHOP.phones || []
  if (phones[0]) {
    doc.text(safeText(`Tél. : ${phones[0]}`), rightX, ty)
    ty += lineH
  }
  if (phones[1] || phones[2]) {
    doc.text(safeText([phones[1], phones[2]].filter(Boolean).join(' - ')), rightX, ty)
    ty += lineH
  }
  doc.text(safeText(SHOP.location || SHOP.address || ''), rightX, ty)

  return y + INFO_H + 4
}

/** Ligne « Date : ........ » */
export function drawDateLine(doc, x, y, date) {
  setFontSafe(doc, 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(34, 34, 34)
  doc.text('Date :', x + 3, y + 4)
  if (date) doc.text(date, x + 16, y + 4)
  dashedLine(doc, x + 16, y + 5, x + 66)
  return y + 6 + 3
}

/** Titre du document (à gauche) et son numéro souligné (à droite) */
export function drawTitleLine(doc, x, y, w, title, number) {
  setFontSafe(doc, 'bold')
  doc.setTextColor(...BLUE)
  doc.setFontSize(15)
  doc.text(title, x + 5, y + 6.5)
  if (number) {
    doc.setTextColor(...RED)
    doc.setFontSize(7.5)
    doc.text('N°', x + w - 46, y + 5.5)
    doc.setDrawColor(...RED)
    doc.setLineWidth(0.4)
    doc.line(x + w - 38, y + 6.5, x + w - 4, y + 6.5)
    doc.setFontSize(8.5)
    doc.text(safeText(number), x + w - 4.5, y + 5.5, { align: 'right' })
  }
  return y + 9 + 3
}

// ---------------------------------------------------------------------------
// Tableau d'articles : la hauteur de chaque ligne s'adapte au nom du produit
// ---------------------------------------------------------------------------
export const TABLE_HEADER_H = 8
const LINE_H = 3.4
const MIN_ROW_H = 7

/** Découpe les libellés (retour à la ligne) et calcule la hauteur de chaque ligne */
export function wrapRows(doc, rows, textW) {
  setFontSafe(doc, 'normal')
  doc.setFontSize(7.5)
  return rows.map((row) => {
    const lines = doc.splitTextToSize(safeText(row.label), textW)
    return { ...row, lines, h: Math.max(MIN_ROW_H, lines.length * LINE_H + 3.2) }
  })
}

export function tableHeight(rows, minRows = 5) {
  const filler = Math.max(0, minRows - rows.length)
  return TABLE_HEADER_H + rows.reduce((sum, r) => sum + r.h, 0) + filler * MIN_ROW_H
}

/**
 * columns : [{ key, label, w, align }] ; la colonne key === 'label' porte les lignes découpées.
 * rows    : sortie de wrapRows, avec cells: { [key]: texte }
 */
export function drawTable(doc, { x, y, w, columns, rows, minRows = 5 }) {
  const colX = []
  let cx = x
  columns.forEach((c) => {
    colX.push(cx)
    cx += c.w
  })
  const lineVerticals = (top, h) => colX.slice(1).forEach((vx) => doc.line(vx, top, vx, top + h))

  // En-tête
  doc.setFillColor(...BLUE_LIGHT)
  doc.setDrawColor(...BLUE)
  doc.setLineWidth(0.4)
  doc.rect(x, y, w, TABLE_HEADER_H, 'FD')
  setFontSafe(doc, 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(...BLUE)
  columns.forEach((c, i) => doc.text(c.label, colX[i] + c.w / 2, y + TABLE_HEADER_H / 2 + 1.3, { align: 'center' }))
  lineVerticals(y, TABLE_HEADER_H)

  // Lignes
  let ry = y + TABLE_HEADER_H
  doc.setLineWidth(0.3)
  const drawRow = (row, h) => {
    doc.setDrawColor(...BLUE)
    doc.rect(x, ry, w, h, 'D')
    lineVerticals(ry, h)
    if (row) {
      setFontSafe(doc, 'normal')
      doc.setTextColor(0)
      columns.forEach((c, i) => {
        if (c.key === 'label') {
          doc.setFontSize(7.5)
          const top = ry + (h - row.lines.length * LINE_H) / 2 + 2.95
          doc.text(row.lines, colX[i] + 2, top, { lineHeightFactor: 1 })
          return
        }
        const text = safeText(row.cells[c.key] ?? '')
        const size = fitText(doc, text, c.w - 3, 7.5)
        const textX = c.align === 'right' ? colX[i] + c.w - 1.8 : colX[i] + c.w / 2
        doc.text(text, textX, ry + h / 2 + size * 0.17, { align: c.align === 'right' ? 'right' : 'center' })
      })
    }
    ry += h
  }
  rows.forEach((row) => drawRow(row, row.h))
  for (let i = rows.length; i < minRows; i++) drawRow(null, MIN_ROW_H)
  return ry
}

/** Cadre extérieur crème du document */
export function drawFrame(doc, x, y, w, h) {
  doc.setFillColor(253, 251, 245)
  doc.setDrawColor(...BLUE)
  doc.setLineWidth(0.5)
  doc.setLineDashPattern([], 0)
  doc.rect(x, y, w, h, 'FD')
}

/** Filigrane diagonal (ANNULÉE, BROUILLON…) */
export function drawWatermark(doc, text, cx, cy, color = [200, 60, 50]) {
  doc.saveGraphicsState()
  doc.setGState(new doc.GState({ opacity: 0.16 }))
  setFontSafe(doc, 'bold')
  doc.setTextColor(...color)
  doc.setFontSize(34)
  doc.text(text, cx, cy, { align: 'center', angle: 35 })
  doc.restoreGraphicsState()
}
