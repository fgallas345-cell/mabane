// Documents des dépôts clients : reçu d'une opération (ticket) et relevé de compte (comme le carnet).
import { SHOP, currency, PAYMENT_METHOD_LABELS, DEPOSIT_TYPE_LABELS } from '../lib/constants'
import { setFontSafe } from './pdfFonts'
import {
  BLUE,
  LETTERHEAD_H,
  newDoc,
  safeText,
  amountInWords,
  drawFrame,
  drawLetterhead,
  drawDateLine,
  drawTitleLine,
  wrapRows,
  tableHeight,
  drawTable,
} from './pdfCommon'
import { SIGNATURE_BLOCK_H, drawSignatureBlock, drawSignatureInBox, loadSignatureSafe, isSignatureCurrent } from './signature'

const formatDateTime = (value) => {
  if (!value) return ''
  const d = new Date(value)
  return `${d.toLocaleDateString('fr-FR')} à ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
}

/** Libellé lisible d'une ligne du registre (avec la facture liée le cas échéant) */
export function depositEntryLabel(entry) {
  const base = DEPOSIT_TYPE_LABELS[entry.type] || entry.type
  const invoice = entry.sales?.invoice_number
  if (entry.type === 'achat' && invoice) return `Achat facture ${invoice}`
  if (entry.type === 'remboursement' && invoice) return `Remboursement facture ${invoice} (annulée)`
  return base
}

// ---------------------------------------------------------------------------
// Reçu de dépôt / retrait (ticket 110 mm)
// ---------------------------------------------------------------------------
const R_MARGIN = 6
const R_PAGE_W = 110

/**
 * @param {object} entry - ligne client_deposits : { number, type, amount, balance_after, method, notes, created_at, client_name }
 * @param {object} [client] - { name, phone }
 * @param {object} [options.signature] - signature active du reçu (case « Pour la boutique »)
 */
export async function generateDepositReceiptPDF(entry, client = {}, { signature = null } = {}) {
  const innerX = R_MARGIN
  const innerW = R_PAGE_W - R_MARGIN * 2
  const amount = Math.abs(Number(entry.amount || 0))
  const isCredit = Number(entry.amount) > 0
  const title =
    entry.type === 'depot' ? 'REÇU DE DÉPÔT' : entry.type === 'retrait' ? 'REÇU DE RETRAIT' : `RELEVÉ D'OPÉRATION`
  const amountLabel = entry.type === 'depot' ? 'MONTANT DÉPOSÉ' : entry.type === 'retrait' ? 'MONTANT RETIRÉ' : 'MONTANT'
  const words = `${isCredit ? 'Reçu' : 'Remis'} la somme de : ${amountInWords(amount)}.`
  const clientName = client.name || entry.client_name || 'Client'
  const showSignature = !entry.reversed_at && isSignatureCurrent(signature, entry.amount)

  const measure = await newDoc([R_PAGE_W, 200])
  setFontSafe(measure, 'normal')
  measure.setFontSize(7)
  const wordsLines = measure.splitTextToSize(safeText(words), innerW - 8)
  measure.setFontSize(7.5)
  const noteLines = entry.notes ? measure.splitTextToSize(safeText(entry.notes), innerW - 18) : []

  const BANNER_H = 15
  const CONTACT_H = 7
  const INFO_H = 24
  const AMOUNT_H = 14 + wordsLines.length * 3.2 + 2
  const BALANCE_H = 9
  const noteH = noteLines.length ? Math.max(8, noteLines.length * 3.2 + 6) : 0
  const SIGN_H = 20
  const contentHeight = 1 + BANNER_H + CONTACT_H + INFO_H + 1 + AMOUNT_H + 1 + BALANCE_H + 1 + (noteH ? noteH + 1 : 0) + SIGN_H + 3
  const doc = await newDoc([R_PAGE_W, R_MARGIN * 2 + contentHeight])

  doc.setFillColor(250, 252, 255)
  doc.setDrawColor(180, 197, 219)
  doc.setLineWidth(0.5)
  doc.rect(innerX, R_MARGIN, innerW, contentHeight, 'FD')
  let y = R_MARGIN + 1

  // Bandeau
  doc.setFillColor(24, 92, 170)
  doc.rect(innerX, y, innerW, BANNER_H, 'F')
  setFontSafe(doc, 'bold')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(13)
  doc.text(safeText(SHOP.name), innerX + innerW / 2, y + 5.5, { align: 'center' })
  doc.setFontSize(8.5)
  doc.text(title, innerX + innerW / 2, y + 11.5, { align: 'center' })
  y += BANNER_H

  setFontSafe(doc, 'normal')
  doc.setFontSize(6.8)
  doc.setTextColor(96, 109, 134)
  const contact = [SHOP.address || SHOP.location, (SHOP.phones || []).filter(Boolean).slice(0, 2).join(' / ')].filter(Boolean).join('  -  ')
  doc.text(safeText(contact), innerX + innerW / 2, y + 4.5, { align: 'center', maxWidth: innerW - 4 })
  y += CONTACT_H

  // N°, date, client, mode
  doc.setFillColor(255, 255, 255)
  doc.setDrawColor(158, 177, 208)
  doc.rect(innerX + 1, y, innerW - 2, INFO_H, 'FD')
  const line = (label, value, yy, bold = false) => {
    setFontSafe(doc, 'normal')
    doc.setFontSize(8)
    doc.setTextColor(96, 109, 134)
    doc.text(label, innerX + 3, yy)
    setFontSafe(doc, bold ? 'bold' : 'normal')
    doc.setTextColor(31, 41, 55)
    doc.text(safeText(value), innerX + 20, yy, { maxWidth: innerW - 24 })
  }
  line('N°', entry.number || '', y + 5, true)
  line('Date', formatDateTime(entry.created_at), y + 10)
  line('Client', clientName + (client.phone ? `  (${client.phone})` : ''), y + 15, true)
  line('Mode', PAYMENT_METHOD_LABELS[entry.method] || entry.method || '—', y + 20)
  y += INFO_H + 1

  // Montant
  const tone = isCredit ? { fill: [232, 245, 233], draw: [89, 164, 116], text: [33, 128, 67] } : { fill: [253, 236, 234], draw: [214, 120, 108], text: [176, 52, 40] }
  doc.setFillColor(...tone.fill)
  doc.setDrawColor(...tone.draw)
  doc.rect(innerX + 1, y, innerW - 2, AMOUNT_H, 'FD')
  setFontSafe(doc, 'bold')
  doc.setTextColor(...tone.text)
  doc.setFontSize(8)
  doc.text(amountLabel, innerX + innerW / 2, y + 5, { align: 'center' })
  doc.setFontSize(15)
  doc.text(currency(amount), innerX + innerW / 2, y + 12.5, { align: 'center' })
  setFontSafe(doc, 'normal')
  doc.setFontSize(7)
  doc.setTextColor(70, 80, 90)
  doc.text(wordsLines, innerX + innerW / 2, y + 17.5, { align: 'center' })
  y += AMOUNT_H + 1

  // Nouveau solde
  doc.setFillColor(240, 246, 255)
  doc.setDrawColor(158, 177, 208)
  doc.rect(innerX + 1, y, innerW - 2, BALANCE_H, 'FD')
  setFontSafe(doc, 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(96, 109, 134)
  doc.text('Solde restant du dépôt', innerX + 3, y + 6)
  setFontSafe(doc, 'bold')
  doc.setTextColor(24, 92, 170)
  doc.text(currency(Number(entry.balance_after || 0)), innerX + innerW - 3, y + 6, { align: 'right' })
  y += BALANCE_H + 1

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

  // Signatures (indispensables pour un retrait d'argent)
  const boxW = innerW / 2 - 2
  ;[
    { x: innerX + 1, label: 'Signature du client' },
    { x: innerX + innerW / 2 + 1, label: 'Pour la boutique', signed: showSignature },
  ].forEach((box) => {
    doc.setDrawColor(158, 177, 208)
    doc.setLineWidth(0.3)
    doc.rect(box.x, y, boxW, SIGN_H, 'D')
    setFontSafe(doc, 'bold')
    doc.setFontSize(6.8)
    doc.setTextColor(24, 92, 170)
    doc.text(box.label, box.x + 2, y + 4)
    if (box.signed) drawSignatureInBox(doc, signature, box.x, y, boxW, SIGN_H)
  })

  return doc
}

export async function downloadDepositReceiptPDF(entry, client) {
  const doc = await generateDepositReceiptPDF(entry, client, { signature: await loadSignatureSafe('deposit_receipt', entry.id) })
  doc.save(`${entry.number || 'depot'}.pdf`)
}

export async function getDepositReceiptPDFBlob(entry, client) {
  const doc = await generateDepositReceiptPDF(entry, client, { signature: await loadSignatureSafe('deposit_receipt', entry.id) })
  return doc.output('blob')
}

// ---------------------------------------------------------------------------
// Relevé de compte dépôt (A5 portrait, hauteur variable) : une ligne par opération
// avec le solde après chaque opération, comme dans le carnet.
// ---------------------------------------------------------------------------
const S_MARGIN = 5
const S_PAGE_W = 148

/**
 * @param {object} client - { name, phone }
 * @param {Array} entries - lignes client_deposits triées du plus ancien au plus récent
 * @param {object} [options.signature] - signature active du relevé (valable tant que le solde n'a pas changé)
 */
export async function generateDepositStatementPDF(client, entries = [], { signature = null } = {}) {
  const innerX = S_MARGIN
  const innerY = S_MARGIN
  const innerW = S_PAGE_W - S_MARGIN * 2
  const dateW = 24
  const amountW = 28
  const balanceW = 28
  const labelW = innerW - dateW - amountW - balanceW
  const columns = [
    { key: 'date', label: 'DATE', w: dateW },
    { key: 'label', label: 'OPÉRATION', w: labelW },
    { key: 'amount', label: 'MONTANT', w: amountW, align: 'right' },
    { key: 'balance', label: 'SOLDE', w: balanceW, align: 'right' },
  ]

  const rawRows = entries.map((e) => ({
    label: `${depositEntryLabel(e)} - ${e.number}${e.reversed_at ? ' (annulée)' : ''}`,
    cells: {
      date: new Date(e.created_at).toLocaleDateString('fr-FR'),
      amount: `${Number(e.amount) > 0 ? '+' : '-'} ${currency(Math.abs(Number(e.amount)))}`,
      balance: currency(Number(e.balance_after || 0)),
    },
  }))

  const measure = await newDoc([S_PAGE_W, 200])
  const rows = wrapRows(measure, rawRows, labelW - 4)
  const balance = entries.length ? Number(entries[entries.length - 1].balance_after || 0) : 0

  const CLIENT_H = client.phone ? 12 : 7
  const TOTAL_H = 11
  const showSignature = isSignatureCurrent(signature, balance)
  const contentHeight = LETTERHEAD_H + 9 + 12 + CLIENT_H + 3 + tableHeight(rows, 5) + 3 + TOTAL_H + 4 + (showSignature ? SIGNATURE_BLOCK_H + 2 : 0)

  const doc = await newDoc([S_PAGE_W, S_MARGIN * 2 + contentHeight])
  drawFrame(doc, innerX, innerY, innerW, contentHeight)

  let y = drawLetterhead(doc, innerX, innerY, innerW)
  y = drawDateLine(doc, innerX, y, new Date().toLocaleDateString('fr-FR'))
  y = drawTitleLine(doc, innerX, y, innerW, 'RELEVÉ DE DÉPÔT', null)

  setFontSafe(doc, 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(34, 34, 34)
  doc.text('Client :', innerX + 3, y + 4)
  setFontSafe(doc, 'bold')
  doc.text(safeText(client.name || ''), innerX + 18, y + 4)
  if (client.phone) {
    setFontSafe(doc, 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(80, 80, 80)
    doc.text(safeText(`Tél. : ${client.phone}`), innerX + 18, y + 9.5)
  }
  y += CLIENT_H + 3

  y = drawTable(doc, { x: innerX, y, w: innerW, columns, rows, minRows: 5 })

  // Solde final
  y += 3
  doc.setFillColor(240, 246, 255)
  doc.setDrawColor(...BLUE)
  doc.setLineWidth(0.4)
  doc.rect(innerX + innerW / 2, y, innerW / 2, TOTAL_H, 'FD')
  setFontSafe(doc, 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...BLUE)
  doc.text('SOLDE DISPONIBLE', innerX + innerW / 2 + 3, y + 7)
  doc.text(currency(balance), innerX + innerW - 3, y + 7, { align: 'right' })

  if (showSignature) drawSignatureBlock(doc, signature, innerX, y + TOTAL_H + 4, innerW)

  return doc
}

export async function downloadDepositStatementPDF(client, entries) {
  const doc = await generateDepositStatementPDF(client, entries, { signature: await loadSignatureSafe('deposit_statement', client.id) })
  const slug = String(client.name || 'client').normalize('NFD').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '')
  doc.save(`releve-depot-${slug || 'client'}.pdf`)
}
