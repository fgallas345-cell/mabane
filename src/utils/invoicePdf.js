import { currency } from '../lib/constants'
import { setFontSafe } from './pdfFonts'
import {
  BLUE,
  BLUE_LIGHT,
  LETTERHEAD_H,
  newDoc,
  safeText,
  fitText,
  amountInWords,
  drawFrame,
  drawLetterhead,
  drawDateLine,
  drawTitleLine,
  dashedLine,
  drawWatermark,
  wrapRows,
  tableHeight,
  drawTable,
} from './pdfCommon'

const MARGIN = 5
const PAGE_W = 120
const MIN_ROWS = 5
const SUMMARY_ROW_H = 7

/**
 * Génère le PDF de la facture (ou du devis) et retourne le doc jsPDF.
 * La hauteur de la page s'adapte au nombre d'articles : rien n'est jamais tronqué.
 * @param {object} sale - { invoice_number, created_at, clients, sale_items, subtotal, discount, total, amount_paid, status, quote_status, delivery_status }
 */
export async function generateInvoicePDF(sale) {
  const innerX = MARGIN
  const innerY = MARGIN
  const innerW = PAGE_W - MARGIN * 2

  const isDraft = sale.quote_status === 'draft'
  const isCancelled = sale.status === 'annulee'
  const total = Number(sale.total || 0)
  const discount = Number(sale.discount || 0)
  const paid = isDraft ? 0 : Number(sale.amount_paid || 0)
  const due = Math.max(0, total - paid)
  const showDelivery = !isDraft && sale.delivery_status && sale.delivery_status !== 'livree'

  const qteW = 16
  const punitW = 25
  const totalW = 26
  const designationW = innerW - qteW - punitW - totalW
  const columns = [
    { key: 'qty', label: 'QTÉ', w: qteW },
    { key: 'label', label: 'DÉSIGNATION', w: designationW },
    { key: 'unit', label: 'P. UNIT.', w: punitW, align: 'right' },
    { key: 'total', label: 'PRIX TOTAL', w: totalW, align: 'right' },
  ]

  const rawRows = (sale.sale_items || []).map((item) => ({
    label: item.product_name || '',
    cells: {
      qty: String(item.quantity ?? ''),
      unit: currency(item.unit_price),
      total: currency(Number(item.quantity || 0) * Number(item.unit_price || 0)),
    },
  }))

  // Récapitulatif sous le tableau
  const summary = []
  if (discount > 0) {
    summary.push({ label: 'Sous-total', value: currency(Number(sale.subtotal || total + discount)) })
    summary.push({ label: 'Remise', value: `- ${currency(discount)}` })
  }
  summary.push({ label: 'MONTANT TOTAL', value: currency(total), strong: true })
  if (!isDraft && !isCancelled) {
    if (paid > 0) summary.push({ label: 'Payé', value: currency(paid) })
    if (due > 0) summary.push({ label: 'RESTE À PAYER', value: currency(due), strong: true, alert: true })
  }

  const words = isDraft
    ? `Arrêté le présent devis à la somme de : ${amountInWords(total)}.`
    : `Arrêtée la présente facture à la somme de : ${amountInWords(total)}.`

  // ---- Mesure (un doc temporaire sert à découper les textes) ----
  const measure = await newDoc([PAGE_W, 200])
  const rows = wrapRows(measure, rawRows, designationW - 4)
  setFontSafe(measure, 'normal')
  measure.setFontSize(7)
  const wordsLines = measure.splitTextToSize(safeText(words), innerW - 4)

  const hasPhone = !!sale.clients?.phone
  const CLIENT_H = hasPhone ? 12 : 7
  const contentHeight =
    LETTERHEAD_H +
    9 + // date
    12 + // titre
    CLIENT_H + 3 +
    (showDelivery ? 4 : 0) +
    tableHeight(rows, MIN_ROWS) +
    summary.length * SUMMARY_ROW_H + 4 +
    wordsLines.length * 3.4 + 3 +
    8 // merci

  const doc = await newDoc([PAGE_W, MARGIN * 2 + contentHeight])
  drawFrame(doc, innerX, innerY, innerW, contentHeight)

  let y = drawLetterhead(doc, innerX, innerY, innerW)
  y = drawDateLine(doc, innerX, y, sale.created_at ? new Date(sale.created_at).toLocaleDateString('fr-FR') : '')
  y = drawTitleLine(doc, innerX, y, innerW, isDraft ? 'DEVIS' : 'FACTURE', isDraft ? '' : sale.invoice_number)
  if (isDraft && sale.invoice_number) {
    setFontSafe(doc, 'bold')
    doc.setTextColor(128, 0, 128)
    doc.setFontSize(8)
    doc.text(safeText(sale.invoice_number), innerX + innerW - 4, y - 5.5, { align: 'right' })
  }

  // Client
  setFontSafe(doc, 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(34, 34, 34)
  doc.text('Client :', innerX + 3, y + 4)
  setFontSafe(doc, 'bold')
  doc.text(safeText(sale.clients?.name || 'Client comptoir'), innerX + 18, y + 4)
  dashedLine(doc, innerX + 16, y + 5, innerX + innerW - 4)
  if (hasPhone) {
    setFontSafe(doc, 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(80, 80, 80)
    doc.text(safeText(`Tél. : ${sale.clients.phone}`), innerX + 18, y + 9.5)
  }
  y += CLIENT_H + 3

  if (showDelivery) {
    setFontSafe(doc, 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(34, 34, 34)
    doc.text(sale.delivery_status === 'en_attente' ? 'Livraison : en attente' : 'Livraison : partielle', innerX + 3, y + 0.5)
    y += 4
  }

  // Tableau
  const tableTop = y
  y = drawTable(doc, { x: innerX, y, w: innerW, columns, rows, minRows: MIN_ROWS })
  const tableBottom = y

  // Récapitulatif : libellé fusionné sur les 3 premières colonnes, montant dans la dernière
  const valueX = innerX + qteW + designationW + punitW
  summary.forEach((line) => {
    if (line.strong) {
      doc.setFillColor(...(line.alert ? [250, 226, 222] : BLUE_LIGHT))
      doc.setDrawColor(...BLUE)
      doc.setLineWidth(0.4)
      doc.rect(innerX, y, innerW, SUMMARY_ROW_H, 'FD')
    } else {
      doc.setDrawColor(...BLUE)
      doc.setLineWidth(0.3)
      doc.rect(innerX, y, innerW, SUMMARY_ROW_H, 'D')
    }
    doc.line(valueX, y, valueX, y + SUMMARY_ROW_H)
    setFontSafe(doc, line.strong ? 'bold' : 'normal')
    doc.setTextColor(...(line.alert ? [192, 57, 43] : BLUE))
    doc.setFontSize(line.strong ? 8.5 : 7.5)
    doc.text(line.label, valueX - 3, y + SUMMARY_ROW_H / 2 + 1.3, { align: 'right' })
    const size = fitText(doc, line.value, totalW - 3, line.strong ? 8.5 : 7.5)
    doc.setFontSize(size)
    doc.text(line.value, valueX + totalW - 1.8, y + SUMMARY_ROW_H / 2 + 1.3, { align: 'right' })
    y += SUMMARY_ROW_H
  })
  y += 4

  // Montant en lettres
  setFontSafe(doc, 'normal')
  doc.setFontSize(7)
  doc.setTextColor(51, 51, 51)
  doc.text(wordsLines, innerX + 2, y + 1.5)
  y += wordsLines.length * 3.4 + 3

  // Merci
  setFontSafe(doc, 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(...BLUE)
  doc.text('Merci pour votre confiance !', innerX + innerW / 2, y + 3.5, { align: 'center' })

  // Filigrane au centre du tableau, par-dessus (semi-transparent)
  const wmY = (tableTop + tableBottom) / 2 + 6
  if (isCancelled) drawWatermark(doc, 'ANNULÉE', PAGE_W / 2, wmY)
  else if (isDraft) drawWatermark(doc, 'DEVIS', PAGE_W / 2, wmY, [110, 60, 160])

  return doc
}

export async function downloadInvoicePDF(sale) {
  const doc = await generateInvoicePDF(sale)
  if (doc && typeof doc.save === 'function') {
    doc.save(`${sale.invoice_number}.pdf`)
  } else {
    console.error('Could not save PDF - doc is invalid', doc)
  }
}

export async function getInvoicePDFBlob(sale) {
  const doc = await generateInvoicePDF(sale)
  if (doc && typeof doc.output === 'function') return doc.output('blob')
  throw new Error('Could not produce blob from PDF document')
}
