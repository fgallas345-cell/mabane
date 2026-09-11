import jsPDF from 'jspdf'
import { SHOP, currency } from '../lib/constants'

let _fontEmbedded = false

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize))
  }
  return btoa(binary)
}

async function ensureFont(doc) {
  if (_fontEmbedded) return true
  try {
    const fonts = [
      { url: '/fonts/NotoSans-Regular.woff2', fileName: 'NotoSans-Regular.woff2', style: 'normal' },
      { url: '/fonts/NotoSans-Bold.woff2', fileName: 'NotoSans-Bold.woff2', style: 'bold' },
    ]

    for (const f of fonts) {
      try {
        const res = await fetch(f.url)
        if (!res.ok) throw new Error(`Font fetch failed: ${f.url}`)
        const buf = await res.arrayBuffer()
        const header = new Uint8Array(buf.slice(0, 4))
        const headerStr = String.fromCharCode(...header)
        const isLikelyFont =
          (header[0] === 0x00 && header[1] === 0x01 && header[2] === 0x00 && header[3] === 0x00) ||
          headerStr === 'OTTO' ||
          headerStr === 'ttcf' ||
          headerStr === 'wOF2'

        if (!isLikelyFont) {
          console.warn('Fetched file does not look like a font, skipping:', f.url)
          continue
        }

        const base64 = arrayBufferToBase64(buf)
        doc.addFileToVFS(f.fileName, base64)
        try {
          doc.addFont(f.fileName, 'NotoSans', f.style)
        } catch (e) {
          try {
            if (doc.internal && doc.internal.collections && doc.internal.collections.VFS) {
              delete doc.internal.collections.VFS[f.fileName]
            }
          } catch (delErr) {
            console.warn('Failed to remove invalid font from VFS', delErr)
          }
          console.warn('Failed to addFont, font skipped:', f.url, e)
          continue
        }
      } catch (err) {
        console.warn('Failed to load font variant', f.url, err)
        _fontEmbedded = false
      }
    }

    if (doc.internal && doc.internal.collections && doc.internal.collections.VFS) {
      const vfs = doc.internal.collections.VFS
      if (vfs['NotoSans-Regular.woff2']) {
        _fontEmbedded = true
        return true
      }
    }
    _fontEmbedded = false
    return false
  } catch (e) {
    console.warn('Could not embed font, falling back to built-ins', e)
    return false
  }
}

function setFontSafe(doc, style) {
  if (_fontEmbedded) {
    try {
      doc.setFont('NotoSans', style)
    } catch {
      try {
        doc.setFont('NotoSans')
      } catch {
        doc.setFont('helvetica', style)
      }
    }
  } else {
    doc.setFont('helvetica', style)
  }
}

const safeText = (s) =>
  String(s || '')
    .replace(/\u2013|\u2014/g, '-')
    .replace(/\u202F|\u00A0/g, ' ')

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
  const MARGIN = 6
  const PAGE_W = 100
  const CONTENT_H = 78

  const PAGE_H = MARGIN * 2 + CONTENT_H

  const doc = new jsPDF({ unit: 'mm', format: [PAGE_W, PAGE_H] })
  await ensureFont(doc)

  const innerX = MARGIN
  const innerY = MARGIN
  const innerW = PAGE_W - MARGIN * 2

  doc.setFillColor(253, 251, 245)
  doc.setDrawColor(26, 79, 160)
  doc.setLineWidth(0.6)
  doc.rect(innerX, innerY, innerW, CONTENT_H, 'FD')

  let y = innerY + 2

  doc.setFillColor(26, 79, 160)
  doc.rect(innerX, y, innerW, 8, 'F')
  setFontSafe(doc, 'bold')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(14)
  doc.text(safeText(SHOP.name), innerX + innerW / 2, y + 8 / 2 + 1.5, { align: 'center' })

  y += 10
  setFontSafe(doc, 'bold')
  doc.setFontSize(11)
  doc.setTextColor(26, 79, 160)
  doc.text('REÇU DE PAIEMENT', innerX + innerW / 2, y + 3, { align: 'center' })

  y += 7
  doc.setTextColor(34, 34, 34)
  setFontSafe(doc, 'normal')
  doc.setFontSize(9)

  const line = (label, value, bold = false) => {
    setFontSafe(doc, bold ? 'bold' : 'normal')
    doc.text(`${label} :`, innerX + 3, y + 3)
    doc.text(safeText(value || ''), innerX + 35, y + 3)
    y += 5.5
  }

  line('N° reçu', receiptNumber, true)
  line('Facture', invoiceNumber)
  line('Date', createdAt ? new Date(createdAt).toLocaleDateString('fr-FR') : '')
  line('Client', clientName || 'Client comptoir')
  line('Mode', method)
  if (reference) line('Référence', reference)
  if (notes) line('Note', notes)

  y += 2
  doc.setDrawColor(120)
  doc.setLineWidth(0.25)
  doc.line(innerX + 3, y, innerX + innerW - 3, y)

  y += 5
  setFontSafe(doc, 'bold')
  doc.setFontSize(10)
  doc.setTextColor(26, 79, 160)
  doc.text('MONTANT PAYÉ', innerX + innerW / 2, y + 3, { align: 'center' })

  y += 7
  doc.setTextColor(0, 100, 0)
  doc.setFontSize(14)
  doc.text(currency(Number(amount || 0)), innerX + innerW / 2, y + 4, { align: 'center' })

  y += 9
  doc.setTextColor(34, 34, 34)
  doc.setFontSize(9)
  doc.text(`Total facture : ${currency(Number(total || 0))}`, innerX + 3, y + 3)
  doc.text(`Reste à payer : ${currency(Number(remaining || 0))}`, innerX + innerW / 2, y + 3, { align: 'right' })

  y += 7
  doc.setDrawColor(120)
  doc.setLineWidth(0.25)
  doc.line(innerX + 3, y, innerX + innerW - 3, y)

  y += 4
  setFontSafe(doc, 'normal')
  doc.setFontSize(8)
  doc.setTextColor(100)
  doc.text('Merci pour votre paiement.', innerX + innerW / 2, y + 2, { align: 'center' })

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
