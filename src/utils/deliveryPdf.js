import jsPDF from 'jspdf'
import { SHOP, currency } from '../lib/constants'

let _fontEmbedded = false

function arrayBufferToBase64(buffer) {
  let binary = ''
  const bytes = new Uint8Array(buffer)
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
      { url: '/fonts/NotoSans-Regular.ttf', fileName: 'NotoSans-Regular.ttf', style: 'normal' },
      { url: '/fonts/NotoSans-Bold.ttf', fileName: 'NotoSans-Bold.ttf', style: 'bold' },
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
          headerStr === 'ttcf'

        if (!isLikelyFont) {
          console.warn('Fetched file does not look like a TTF/OTF, skipping:', f.url)
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
      if (vfs['NotoSans-Regular.ttf']) {
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

/**
 * Génère le PDF du bon de livraison pour une livraison.
 * @param {object} delivery - { delivery_number, created_at, notes, sale: { invoice_number, clients: {name, phone} }, delivery_items: [{ sale_items: {product_name, quantity}, quantity_delivered }] }
 */
export async function generateDeliveryPDF(delivery) {
  const MARGIN = 5
  const PAGE_W = 120
  const NUM_ROWS = 10
  const ROW_H = 8

  const HEADER_TITLE_H = 11
  const HEADER_SUB_H = 7
  const INFO_H = 18
  const GAP_S = 3
  const GAP_M = 4
  const DATE_H = 6
  const TITLE_H = 9
  const CLIENT_H = 7
  const TABLE_HEADER_H = 8
  const TOTAL_ROW_H = 8
  const ARRETE_H = 5
  const UNDERLINE_GAP = 6

  const sale = delivery.sale || {}
  const items = delivery.delivery_items || []
  const contentHeight =
    HEADER_TITLE_H + HEADER_SUB_H + GAP_S +
    INFO_H + GAP_M +
    DATE_H + GAP_S +
    TITLE_H + GAP_S +
    CLIENT_H + GAP_M +
    TABLE_HEADER_H + ROW_H * NUM_ROWS +
    TOTAL_ROW_H + GAP_M +
    ARRETE_H + UNDERLINE_GAP

  const PAGE_H = MARGIN * 2 + contentHeight

  const doc = new jsPDF({ unit: 'mm', format: [PAGE_W, PAGE_H] })
  await ensureFont(doc)

  const safeText = (s) =>
    String(s || '')
      .replace(/\u2013|\u2014/g, '-')
      .replace(/\u202F|\u00A0/g, ' ')

  const innerX = MARGIN
  const innerY = MARGIN
  const innerW = PAGE_W - MARGIN * 2

  doc.setFillColor(253, 251, 245)
  doc.setDrawColor(26, 79, 160)
  doc.setLineWidth(0.5)
  doc.setLineDashPattern([], 0)
  doc.rect(innerX, innerY, innerW, contentHeight, 'FD')

  let y = innerY

  doc.setFillColor(26, 79, 160)
  doc.rect(innerX, y, innerW, HEADER_TITLE_H, 'F')
  setFontSafe(doc, 'bold')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(14)
  doc.text(safeText(SHOP.name), innerX + innerW / 2, y + HEADER_TITLE_H / 2 + 1.5, { align: 'center' })
  y += HEADER_TITLE_H

  doc.setFillColor(26, 79, 160)
  doc.rect(innerX, y, innerW, HEADER_SUB_H, 'F')
  doc.setDrawColor(255, 255, 255)
  doc.setLineWidth(0.3)
  doc.line(innerX, y, innerX + innerW, y)
  setFontSafe(doc, 'bold')
  doc.setFontSize(8)
  doc.text(safeText(`Gérant : ${SHOP.owner}`), innerX + innerW / 2, y + HEADER_SUB_H / 2 + 1, { align: 'center' })
  y += HEADER_SUB_H + GAP_S

  const halfW = innerW / 2 - 1.5
  doc.setDrawColor(26, 79, 160)
  doc.setLineWidth(0.4)
  doc.rect(innerX, y, halfW, INFO_H, 'D')
  doc.rect(innerX + innerW / 2 + 1.5, y, halfW, INFO_H, 'D')

  const lineH = 4.6
  setFontSafe(doc, 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(26, 79, 160)

  const leftX = innerX + 3
  let ty = y + 5
  const activities = SHOP.activities || ['Vente Ciment, Fer', 'Béton, Matériel Electrique', 'Plomberie & Divers']
  activities.forEach((line) => {
    doc.text(safeText(line), leftX, ty)
    ty += lineH
  })

  const rightX = innerX + innerW / 2 + 3
  ty = y + 5
  const phones = SHOP.phones || []
  if (phones[0]) {
    doc.text(safeText(`Tél. : ${phones[0]}`), rightX, ty)
    ty += lineH
  }
  if (phones[1] || phones[2]) {
    const rest = [phones[1], phones[2]].filter(Boolean).join(' - ')
    doc.text(safeText(rest), rightX, ty)
    ty += lineH
  }
  doc.text(safeText(SHOP.location || 'DIOUROUP - SENEGAL'), rightX, ty)

  y += INFO_H + GAP_M

  setFontSafe(doc, 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(34, 34, 34)
  doc.text('Date :', innerX + 3, y + DATE_H / 2 + 1)

  const dateUnderlineX = innerX + 16
  const dateUnderlineW = 50
  const deliveryDate = delivery.created_at ? new Date(delivery.created_at).toLocaleDateString('fr-FR') : ''
  if (deliveryDate) {
    doc.text(deliveryDate, dateUnderlineX, y + DATE_H / 2 + 1)
  }
  doc.setDrawColor(120)
  doc.setLineWidth(0.25)
  doc.setLineDashPattern([1, 1], 0)
  doc.line(dateUnderlineX, y + DATE_H / 2 + 2, dateUnderlineX + dateUnderlineW, y + DATE_H / 2 + 2)
  doc.setLineDashPattern([], 0)

  y += DATE_H + GAP_S

  setFontSafe(doc, 'bold')
  doc.setTextColor(26, 79, 160)
  doc.setFontSize(15)
  doc.text('BON DE LIVRAISON', innerX + 5, y + TITLE_H / 2 + 2)

  doc.setTextColor(192, 57, 43)
  doc.setFontSize(7.5)
  doc.text('N°', innerX + innerW - 42, y + TITLE_H / 2 + 1)

  doc.setDrawColor(192, 57, 43)
  doc.setLineWidth(0.4)
  const noX = innerX + innerW - 34
  const noUnderlineW = 30
  doc.line(noX, y + TITLE_H / 2 + 2, noX + noUnderlineW, y + TITLE_H / 2 + 2)

  doc.setFontSize(8.5)
  doc.text(String(safeText(delivery.delivery_number || '')), noX + noUnderlineW - 0.5, y + TITLE_H / 2 + 1, { align: 'right' })

  y += TITLE_H + GAP_S

  setFontSafe(doc, 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(34, 34, 34)
  doc.text('Client :', innerX + 3, y + CLIENT_H / 2 + 1)
  setFontSafe(doc, 'bold')
  doc.text(safeText(sale.clients?.name || ''), innerX + 18, y + CLIENT_H / 2 + 1)
  doc.text('Facture :', innerX + innerW - 42, y + CLIENT_H / 2 + 1)

  const factureUnderlineX = innerX + innerW - 30
  const factureUnderlineW = 25
  doc.setDrawColor(120)
  doc.setLineWidth(0.25)
  doc.setLineDashPattern([1, 1], 0)
  doc.line(factureUnderlineX, y + CLIENT_H / 2 + 2, factureUnderlineX + factureUnderlineW, y + CLIENT_H / 2 + 2)
  doc.setLineDashPattern([], 0)

  doc.setFontSize(8.5)
  doc.text(String(safeText(sale.invoice_number || '')), factureUnderlineX + factureUnderlineW - 0.5, y + CLIENT_H / 2 + 1, { align: 'right' })

  y += CLIENT_H + GAP_M

  const qteW = 16
  const punitW = 24
  const totalW = 24
  const designationW = innerW - qteW - punitW - totalW

  const tableY = y
  doc.setFillColor(207, 224, 247)
  doc.setDrawColor(26, 79, 160)
  doc.setLineWidth(0.4)
  doc.rect(innerX, tableY, innerW, TABLE_HEADER_H, 'FD')
  setFontSafe(doc, 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(26, 79, 160)
  doc.text('QTE', innerX + qteW / 2, tableY + TABLE_HEADER_H / 2 + 1.5, { align: 'center' })
  doc.text('DESIGNATION', innerX + qteW + designationW / 2, tableY + TABLE_HEADER_H / 2 + 1.5, { align: 'center' })
  doc.text('P. UNIT.', innerX + qteW + designationW + punitW / 2, tableY + TABLE_HEADER_H / 2 + 1.5, { align: 'center' })
  doc.text('PRIX TOTAL', innerX + qteW + designationW + punitW + totalW / 2, tableY + TABLE_HEADER_H / 2 + 1.5, { align: 'center' })
  doc.line(innerX + qteW, tableY, innerX + qteW, tableY + TABLE_HEADER_H)
  doc.line(innerX + qteW + designationW, tableY, innerX + qteW + designationW, tableY + TABLE_HEADER_H)
  doc.line(innerX + qteW + designationW + punitW, tableY, innerX + qteW + designationW + punitW, tableY + TABLE_HEADER_H)

  setFontSafe(doc, 'normal')
  doc.setFontSize(7)
  doc.setTextColor(0)
  for (let i = 0; i < NUM_ROWS; i++) {
    const rowY = tableY + TABLE_HEADER_H + ROW_H * i
    doc.setDrawColor(26, 79, 160)
    doc.setLineWidth(0.3)
    doc.rect(innerX, rowY, innerW, ROW_H, 'D')
    doc.line(innerX + qteW, rowY, innerX + qteW, rowY + ROW_H)
    doc.line(innerX + qteW + designationW, rowY, innerX + qteW + designationW, rowY + ROW_H)
    doc.line(innerX + qteW + designationW + punitW, rowY, innerX + qteW + designationW + punitW, rowY + ROW_H)

    const item = items[i]
    if (item) {
      const saleItem = item.sale_items || {}
      const unitPrice = Number(saleItem.unit_price || 0)
      const lineTotal = Number(item.quantity_delivered || 0) * unitPrice
      doc.text(String(item.quantity_delivered || ''), innerX + qteW / 2, rowY + ROW_H / 2 + 1.5, { align: 'center' })
      doc.text(safeText(saleItem.product_name || ''), innerX + qteW + 2, rowY + ROW_H / 2 + 1.5)
      doc.text(currency(unitPrice), innerX + qteW + designationW + punitW - 2, rowY + ROW_H / 2 + 1.5, { align: 'right' })
      doc.text(currency(lineTotal), innerX + qteW + designationW + punitW + totalW - 2, rowY + ROW_H / 2 + 1.5, { align: 'right' })
    }
  }

  const totalRowY = tableY + TABLE_HEADER_H + ROW_H * NUM_ROWS
  doc.setFillColor(207, 224, 247)
  doc.setDrawColor(26, 79, 160)
  doc.setLineWidth(0.4)
  doc.rect(innerX, totalRowY, innerW, TOTAL_ROW_H, 'FD')
  doc.line(innerX + qteW + designationW + punitW, totalRowY, innerX + qteW + designationW + punitW, totalRowY + TOTAL_ROW_H)
  setFontSafe(doc, 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(26, 79, 160)
  doc.text('MONTANT TOTAL', innerX + (qteW + designationW + punitW) / 2, totalRowY + TOTAL_ROW_H / 2 + 1.5, { align: 'center' })
  const totalDelivered = items.reduce((sum, item) => sum + Number(item.quantity_delivered || 0) * Number(item.sale_items?.unit_price || 0), 0)
  doc.text(currency(totalDelivered), innerX + qteW + designationW + punitW + totalW / 2, totalRowY + TOTAL_ROW_H / 2 + 1.5, { align: 'center' })

  y = totalRowY + TOTAL_ROW_H + GAP_M

  setFontSafe(doc, 'normal')
  doc.setFontSize(7)
  doc.setTextColor(51, 51, 51)
  doc.text('Arrêtée à présente livraison à la somme de', innerX + 2, y + ARRETE_H / 2)

  doc.setDrawColor(120)
  doc.setLineWidth(0.25)
  doc.setLineDashPattern([1, 1], 0)
  doc.line(innerX + 60, y + ARRETE_H / 2, innerX + innerW - 2, y + ARRETE_H / 2)
  doc.setLineDashPattern([], 0)

  return doc
}

export async function downloadDeliveryPDF(delivery) {
  const doc = await generateDeliveryPDF(delivery)
  if (doc && typeof doc.save === 'function') {
    doc.save(`${delivery.delivery_number}.pdf`)
  } else {
    console.error('Could not save PDF - doc is invalid', doc)
  }
}

export async function getDeliveryPDFBlob(delivery) {
  const doc = await generateDeliveryPDF(delivery)
  if (doc && typeof doc.output === 'function') return doc.output('blob')
  throw new Error('Could not produce blob from PDF document')
}
