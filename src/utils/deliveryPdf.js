import { setFontSafe } from './pdfFonts'
import { formatQty } from './quantity'
import {
  BLUE,
  LETTERHEAD_H,
  newDoc,
  safeText,
  drawFrame,
  drawLetterhead,
  drawDateLine,
  drawTitleLine,
  dashedLine,
  wrapRows,
  tableHeight,
  drawTable,
} from './pdfCommon'
import { drawSignatureInBox, loadSignatureSafe, isSignatureCurrent } from './signature'

const MARGIN = 5
const PAGE_W = 120
const MIN_ROWS = 5
const SIGN_H = 22

/**
 * Génère le PDF du bon de livraison (sans prix : il atteste seulement de ce qui a été remis).
 * @param {object} delivery - {
 *   delivery_number, created_at, notes,
 *   sale: { invoice_number, clients: { name, phone } },
 *   delivery_items: [{ quantity_delivered, ordered, remaining, sale_items: { product_name, quantity } }]
 * }
 * @param {object} [options.signature] - signature active du bon (case « Pour la boutique »)
 */
export async function generateDeliveryPDF(delivery, { signature = null } = {}) {
  const innerX = MARGIN
  const innerY = MARGIN
  const innerW = PAGE_W - MARGIN * 2
  const sale = delivery.sale || {}
  const showSignature = sale.status !== 'annulee' && isSignatureCurrent(signature, null)

  const qteW = 20
  const orderedW = 22
  const remainingW = 20
  const designationW = innerW - qteW - orderedW - remainingW
  const columns = [
    { key: 'delivered', label: 'LIVRÉ', w: qteW },
    { key: 'label', label: 'DÉSIGNATION', w: designationW },
    { key: 'ordered', label: 'COMMANDÉ', w: orderedW },
    { key: 'remaining', label: 'RESTE', w: remainingW },
  ]

  const rawRows = (delivery.delivery_items || []).map((item) => {
    const ordered = item.ordered ?? item.sale_items?.quantity
    return {
      label: item.sale_items?.product_name || 'Article',
      cells: {
        delivered: formatQty(item.quantity_delivered),
        ordered: ordered != null ? formatQty(ordered) : '',
        remaining: item.remaining != null ? formatQty(item.remaining) : '',
      },
    }
  })

  const measure = await newDoc([PAGE_W, 200])
  const rows = wrapRows(measure, rawRows, designationW - 4)
  setFontSafe(measure, 'normal')
  measure.setFontSize(7.5)
  const noteLines = delivery.notes ? measure.splitTextToSize(safeText(`Note : ${delivery.notes}`), innerW - 4) : []

  const hasPhone = !!sale.clients?.phone
  const CLIENT_H = hasPhone ? 12 : 7
  const contentHeight =
    LETTERHEAD_H +
    9 +
    12 +
    CLIENT_H + 3 +
    tableHeight(rows, MIN_ROWS) +
    (noteLines.length ? noteLines.length * 3.6 + 4 : 0) +
    6 + SIGN_H + 4

  const doc = await newDoc([PAGE_W, MARGIN * 2 + contentHeight])
  drawFrame(doc, innerX, innerY, innerW, contentHeight)

  let y = drawLetterhead(doc, innerX, innerY, innerW)
  y = drawDateLine(doc, innerX, y, delivery.created_at ? new Date(delivery.created_at).toLocaleDateString('fr-FR') : '')
  y = drawTitleLine(doc, innerX, y, innerW, 'BON DE LIVRAISON', delivery.delivery_number)

  // Client + facture
  setFontSafe(doc, 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(34, 34, 34)
  doc.text('Client :', innerX + 3, y + 4)
  setFontSafe(doc, 'bold')
  doc.text(safeText(sale.clients?.name || 'Client comptoir'), innerX + 18, y + 4)
  dashedLine(doc, innerX + 16, y + 5, innerX + innerW - 47)
  setFontSafe(doc, 'normal')
  doc.text('Facture :', innerX + innerW - 45, y + 4)
  setFontSafe(doc, 'bold')
  doc.setFontSize(8)
  doc.text(safeText(sale.invoice_number || ''), innerX + innerW - 3, y + 4, { align: 'right' })
  if (hasPhone) {
    setFontSafe(doc, 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(80, 80, 80)
    doc.text(safeText(`Tél. : ${sale.clients.phone}`), innerX + 18, y + 9.5)
  }
  y += CLIENT_H + 3

  y = drawTable(doc, { x: innerX, y, w: innerW, columns, rows, minRows: MIN_ROWS })

  if (noteLines.length) {
    setFontSafe(doc, 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(60, 74, 87)
    doc.text(noteLines, innerX + 2, y + 5)
    y += noteLines.length * 3.6 + 4
  }

  // Signatures
  y += 6
  const boxW = innerW / 2 - 4
  doc.setDrawColor(...BLUE)
  doc.setLineWidth(0.3)
  ;[
    { x: innerX + 2, label: showSignature ? 'Pour la boutique' : 'Le livreur', signed: showSignature },
    { x: innerX + innerW / 2 + 2, label: 'Le client (reçu en bon état)' },
  ].forEach((box) => {
    doc.setDrawColor(...BLUE)
    doc.setLineWidth(0.3)
    doc.rect(box.x, y, boxW, SIGN_H, 'D')
    setFontSafe(doc, 'bold')
    doc.setFontSize(7)
    doc.setTextColor(...BLUE)
    doc.text(box.label, box.x + 2, y + 4)
    if (box.signed) drawSignatureInBox(doc, signature, box.x, y, boxW, SIGN_H)
  })

  return doc
}

export async function downloadDeliveryPDF(delivery) {
  const doc = await generateDeliveryPDF(delivery, { signature: await loadSignatureSafe('delivery', delivery.id) })
  if (doc && typeof doc.save === 'function') {
    doc.save(`${delivery.delivery_number}.pdf`)
  } else {
    console.error('Could not save PDF - doc is invalid', doc)
  }
}

export async function getDeliveryPDFBlob(delivery) {
  const doc = await generateDeliveryPDF(delivery, { signature: await loadSignatureSafe('delivery', delivery.id) })
  if (doc && typeof doc.output === 'function') return doc.output('blob')
  throw new Error('Could not produce blob from PDF document')
}
