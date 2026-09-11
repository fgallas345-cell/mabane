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
  const PAGE_W = 110
  const PAGE_H = 122

  const doc = new jsPDF({ unit: 'mm', format: [PAGE_W, PAGE_H] })
  await ensureFont(doc)

  const innerX = MARGIN
  const innerY = MARGIN
  const innerW = PAGE_W - MARGIN * 2

  const drawField = (label, value, x, y, width, labelWidth = 26) => {
    setFontSafe(doc, 'normal')
    doc.setFontSize(8)
    doc.setTextColor(96, 109, 134)
    doc.text(`${label} :`, x, y)

    const valueText = safeText(String(value ?? ''))
    const valueLines = doc.splitTextToSize(valueText, width - labelWidth - 3) || [valueText]

    doc.setTextColor(31, 41, 55)
    doc.text(valueLines, x + labelWidth + 2, y)
  }

  // Fond général
  doc.setFillColor(250, 252, 255)
  doc.setDrawColor(180, 197, 219)
  doc.setLineWidth(0.5)
  doc.rect(innerX, innerY, innerW, PAGE_H - MARGIN * 2, 'FD')

  let y = innerY + 1

  // Bandeau supérieur
  doc.setFillColor(24, 92, 170)
  doc.rect(innerX, y, innerW, 15, 'F')
  setFontSafe(doc, 'bold')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(13)
  doc.text(safeText(SHOP.name), innerX + innerW / 2, y + 5.5, { align: 'center' })
  doc.setFontSize(8.5)
  doc.text('REÇU DE PAIEMENT', innerX + innerW / 2, y + 11.5, { align: 'center' })

  y += 15

  // Bloc d'informations rapides
  doc.setFillColor(240, 246, 255)
  doc.setDrawColor(158, 177, 208)
  doc.rect(innerX + 1, y, innerW - 2, 12, 'FD')

  setFontSafe(doc, 'bold')
  doc.setTextColor(24, 92, 170)
  doc.setFontSize(8)
  doc.text('REÇU', innerX + 3, y + 4)

  setFontSafe(doc, 'bold')
  doc.setTextColor(31, 41, 55)
  doc.setFontSize(9)
  doc.text(safeText(String(receiptNumber || '')), innerX + 15, y + 4)

  setFontSafe(doc, 'normal')
  doc.setTextColor(96, 109, 134)
  doc.setFontSize(7.5)
  doc.text('Facture', innerX + innerW - 32, y + 4)
  doc.setTextColor(31, 41, 55)
  doc.text(safeText(String(invoiceNumber || '')), innerX + innerW - 12, y + 4, { align: 'right' })

  const paymentDate = createdAt ? new Date(createdAt).toLocaleDateString('fr-FR') : ''
  doc.setTextColor(96, 109, 134)
  doc.setFontSize(7.5)
  doc.text('Date', innerX + 3, y + 9)
  doc.setTextColor(31, 41, 55)
  doc.text(paymentDate, innerX + 15, y + 9)

  y += 13

  // Bloc client / paiement
  doc.setDrawColor(158, 177, 208)
  doc.setFillColor(255, 255, 255)
  doc.rect(innerX + 1, y, innerW - 2, 26, 'FD')

  doc.setTextColor(24, 92, 170)
  setFontSafe(doc, 'bold')
  doc.setFontSize(8)
  doc.text('CLIENT', innerX + 3, y + 4)

  setFontSafe(doc, 'bold')
  doc.setTextColor(31, 41, 55)
  doc.setFontSize(8.5)
  const clientLine = doc.splitTextToSize(safeText(clientName || 'Client comptoir'), innerW - 12)
  doc.text(clientLine, innerX + 3, y + 8)

  drawField('Mode', method || '', innerX + 3, y + 16, innerW - 6, 17)
  if (reference) {
    drawField('Réf.', reference, innerX + 3, y + 21, innerW - 6, 17)
  }

  y += 27

  // Bloc montant principal
  doc.setFillColor(232, 245, 233)
  doc.setDrawColor(89, 164, 116)
  doc.rect(innerX + 1, y, innerW - 2, 17, 'FD')

  setFontSafe(doc, 'bold')
  doc.setTextColor(44, 125, 70)
  doc.setFontSize(8)
  doc.text('MONTANT PAYÉ', innerX + innerW / 2, y + 5, { align: 'center' })

  setFontSafe(doc, 'bold')
  doc.setTextColor(33, 128, 67)
  doc.setFontSize(14)
  doc.text(currency(Number(amount || 0)), innerX + innerW / 2, y + 12.5, { align: 'center' })

  y += 18

  // Bloc résumé
  doc.setFillColor(248, 250, 252)
  doc.setDrawColor(192, 204, 220)
  doc.rect(innerX + 1, y, innerW - 2, 16, 'FD')

  drawField('Total', currency(Number(total || 0)), innerX + 3, y + 4, innerW - 8, 18)
  drawField('Reste', currency(Number(remaining || 0)), innerX + 3, y + 9, innerW - 8, 18)

  y += 17

  // Note éventuelle
  if (notes) {
    doc.setDrawColor(192, 204, 220)
    doc.setFillColor(255, 255, 255)
    doc.rect(innerX + 1, y, innerW - 2, 14, 'FD')

    setFontSafe(doc, 'bold')
    doc.setTextColor(24, 92, 170)
    doc.setFontSize(7.5)
    doc.text('NOTE', innerX + 3, y + 4)

    const noteLines = doc.splitTextToSize(safeText(notes), innerW - 18)
    doc.setTextColor(60, 74, 87)
    doc.setFontSize(7.5)
    doc.text(noteLines, innerX + 16, y + 4)

    y += 15
  }

  // Footer
  doc.setDrawColor(190, 202, 219)
  doc.line(innerX + 3, y, innerX + innerW - 3, y)

  y += 4
  setFontSafe(doc, 'normal')
  doc.setTextColor(100, 115, 130)
  doc.setFontSize(7.5)
  doc.text('Merci pour votre confiance.', innerX + innerW / 2, y + 3, { align: 'center' })

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
