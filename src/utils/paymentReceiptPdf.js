import { SHOP, currency, PAYMENT_METHOD_LABELS } from '../lib/constants'
import { setFontSafe } from './pdfFonts'
import { newDoc, safeText, amountInWords } from './pdfCommon'

const MARGIN = 6
const PAGE_W = 110

/**
 * Reçu de paiement (ticket A6 étroit).
 * @param {object} data - { receiptNumber, invoiceNumber, clientName, amount, method, reference, notes, remaining, total, createdAt }
 */
export async function generatePaymentReceiptPDF({
  receiptNumber,
  invoiceNumber,
  clientName,
  amount,
  method,
  reference,
  notes,
  remaining,
  total,
  createdAt,
}) {
  const innerX = MARGIN
  const innerW = PAGE_W - MARGIN * 2
  const settled = Number(remaining || 0) <= 0
  const methodLabel = PAYMENT_METHOD_LABELS[method] || method || '—'
  const words = `Reçu la somme de : ${amountInWords(amount)}.`

  // ---- Mesure (hauteur variable : nom long, note, montant en lettres) ----
  const measure = await newDoc([PAGE_W, 200])
  setFontSafe(measure, 'bold')
  measure.setFontSize(8.5)
  const clientLines = measure.splitTextToSize(safeText(clientName || 'Client comptoir'), innerW - 12)
  setFontSafe(measure, 'normal')
  measure.setFontSize(7)
  const wordsLines = measure.splitTextToSize(safeText(words), innerW - 8)
  measure.setFontSize(7.5)
  const noteLines = notes ? measure.splitTextToSize(safeText(notes), innerW - 18) : []

  const BANNER_H = 15
  const CONTACT_H = 7
  const QUICK_H = 12
  const clientBlockH = 6 + clientLines.length * 4 + (reference ? 11 : 6) + 2
  const AMOUNT_H = 14 + wordsLines.length * 3.2 + 2
  const SUMMARY_H = 16
  const noteH = noteLines.length ? Math.max(8, noteLines.length * 3.2 + 6) : 0
  const FOOTER_H = 11

  const contentHeight = 1 + BANNER_H + CONTACT_H + QUICK_H + 1 + clientBlockH + 1 + AMOUNT_H + 1 + SUMMARY_H + 1 + (noteH ? noteH + 1 : 0) + FOOTER_H
  const pageH = MARGIN * 2 + contentHeight

  const doc = await newDoc([PAGE_W, pageH])

  // Fond
  doc.setFillColor(250, 252, 255)
  doc.setDrawColor(180, 197, 219)
  doc.setLineWidth(0.5)
  doc.rect(innerX, MARGIN, innerW, contentHeight, 'FD')

  let y = MARGIN + 1

  // Bandeau
  doc.setFillColor(24, 92, 170)
  doc.rect(innerX, y, innerW, BANNER_H, 'F')
  setFontSafe(doc, 'bold')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(13)
  doc.text(safeText(SHOP.name), innerX + innerW / 2, y + 5.5, { align: 'center' })
  doc.setFontSize(8.5)
  doc.text('REÇU DE PAIEMENT', innerX + innerW / 2, y + 11.5, { align: 'center' })
  y += BANNER_H

  // Coordonnées de la boutique
  setFontSafe(doc, 'normal')
  doc.setFontSize(6.8)
  doc.setTextColor(96, 109, 134)
  const contact = [SHOP.address || SHOP.location, (SHOP.phones || []).filter(Boolean).slice(0, 2).join(' / ')].filter(Boolean).join('  -  ')
  doc.text(safeText(contact), innerX + innerW / 2, y + 4.5, { align: 'center', maxWidth: innerW - 4 })
  y += CONTACT_H

  // N° de reçu / facture / date
  doc.setFillColor(240, 246, 255)
  doc.setDrawColor(158, 177, 208)
  doc.rect(innerX + 1, y, innerW - 2, QUICK_H, 'FD')
  setFontSafe(doc, 'bold')
  doc.setTextColor(24, 92, 170)
  doc.setFontSize(8)
  doc.text('REÇU N°', innerX + 3, y + 4.5)
  doc.setTextColor(31, 41, 55)
  doc.setFontSize(9)
  doc.text(safeText(receiptNumber || ''), innerX + 19, y + 4.5)

  setFontSafe(doc, 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(96, 109, 134)
  doc.text('Facture', innerX + innerW - 43, y + 4.5)
  doc.setTextColor(31, 41, 55)
  setFontSafe(doc, 'bold')
  doc.text(safeText(invoiceNumber || ''), innerX + innerW - 3, y + 4.5, { align: 'right' })

  const when = createdAt ? new Date(createdAt) : null
  setFontSafe(doc, 'normal')
  doc.setTextColor(96, 109, 134)
  doc.text('Date', innerX + 3, y + 9.5)
  doc.setTextColor(31, 41, 55)
  doc.text(
    when ? `${when.toLocaleDateString('fr-FR')} à ${when.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : '',
    innerX + 19,
    y + 9.5
  )
  y += QUICK_H + 1

  // Client + mode de paiement
  doc.setFillColor(255, 255, 255)
  doc.setDrawColor(158, 177, 208)
  doc.rect(innerX + 1, y, innerW - 2, clientBlockH, 'FD')
  setFontSafe(doc, 'bold')
  doc.setTextColor(24, 92, 170)
  doc.setFontSize(8)
  doc.text('CLIENT', innerX + 3, y + 4)
  doc.setTextColor(31, 41, 55)
  doc.setFontSize(8.5)
  doc.text(clientLines, innerX + 3, y + 8.5)
  let fy = y + 8.5 + clientLines.length * 4 + 1.5
  const field = (label, value) => {
    setFontSafe(doc, 'normal')
    doc.setFontSize(8)
    doc.setTextColor(96, 109, 134)
    doc.text(`${label} :`, innerX + 3, fy)
    doc.setTextColor(31, 41, 55)
    doc.text(safeText(value), innerX + 20, fy, { maxWidth: innerW - 24 })
    fy += 5
  }
  field('Mode', methodLabel)
  if (reference) field('Réf.', reference)
  y += clientBlockH + 1

  // Montant payé
  doc.setFillColor(232, 245, 233)
  doc.setDrawColor(89, 164, 116)
  doc.rect(innerX + 1, y, innerW - 2, AMOUNT_H, 'FD')
  setFontSafe(doc, 'bold')
  doc.setTextColor(44, 125, 70)
  doc.setFontSize(8)
  doc.text('MONTANT PAYÉ', innerX + innerW / 2, y + 5, { align: 'center' })
  doc.setTextColor(33, 128, 67)
  doc.setFontSize(15)
  doc.text(currency(Number(amount || 0)), innerX + innerW / 2, y + 12.5, { align: 'center' })
  setFontSafe(doc, 'normal')
  doc.setFontSize(7)
  doc.setTextColor(60, 100, 75)
  doc.text(wordsLines, innerX + innerW / 2, y + 17.5, { align: 'center' })
  y += AMOUNT_H + 1

  // Résumé de la facture
  doc.setFillColor(248, 250, 252)
  doc.setDrawColor(192, 204, 220)
  doc.rect(innerX + 1, y, innerW - 2, SUMMARY_H, 'FD')
  const summaryLine = (label, value, yy, color) => {
    setFontSafe(doc, 'normal')
    doc.setFontSize(8)
    doc.setTextColor(96, 109, 134)
    doc.text(label, innerX + 3, yy)
    setFontSafe(doc, 'bold')
    doc.setTextColor(...color)
    doc.text(value, innerX + innerW - 3, yy, { align: 'right' })
  }
  summaryLine('Total de la facture', currency(Number(total || 0)), y + 5.5, [31, 41, 55])
  summaryLine(
    'Reste à payer',
    settled ? 'Soldé' : currency(Number(remaining || 0)),
    y + 11.5,
    settled ? [33, 128, 67] : [192, 57, 43]
  )
  y += SUMMARY_H + 1

  // Note
  if (noteH) {
    doc.setFillColor(255, 255, 255)
    doc.setDrawColor(192, 204, 220)
    doc.rect(innerX + 1, y, innerW - 2, noteH, 'FD')
    setFontSafe(doc, 'bold')
    doc.setTextColor(24, 92, 170)
    doc.setFontSize(7.5)
    doc.text('NOTE', innerX + 3, y + 4.5)
    setFontSafe(doc, 'normal')
    doc.setTextColor(60, 74, 87)
    doc.text(noteLines, innerX + 16, y + 4.5)
    y += noteH + 1
  }

  // Pied
  setFontSafe(doc, 'normal')
  doc.setTextColor(100, 115, 130)
  doc.setFontSize(7.5)
  doc.text('Merci pour votre confiance.', innerX + innerW / 2, y + 5, { align: 'center' })

  return doc
}

export async function downloadPaymentReceiptPDF(data) {
  const doc = await generatePaymentReceiptPDF(data)
  if (doc && typeof doc.save === 'function') {
    doc.save(`${data.receiptNumber || 'recu'}.pdf`)
  } else {
    console.error('Could not save PDF - doc is invalid', doc)
  }
}

export async function getPaymentReceiptPDFBlob(data) {
  const doc = await generatePaymentReceiptPDF(data)
  if (doc && typeof doc.output === 'function') return doc.output('blob')
  throw new Error('Could not produce blob from PDF document')
}
