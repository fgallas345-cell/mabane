// Signature électronique des documents : préparation de l'image, lecture de la
// signature active d'un document et dessin du bloc « signature » dans les PDF.
import { setFontSafe } from './pdfFonts'

export const SIGNATURE_BLOCK_H = 27

/** Types de documents signables (identiques à la contrainte SQL) et libellés « Signer … » */
export const DOC_LABELS = {
  invoice: 'la facture',
  delivery: 'le bon de livraison',
  payment_receipt: 'le reçu',
  deposit_receipt: 'le reçu',
  deposit_statement: 'le relevé',
}

/** Règle identique au serveur (signature_pin_is_valid) : 4 chiffres, pas de suite triviale */
const WEAK_PINS = new Set(['0123', '1234', '2345', '3456', '4567', '5678', '6789', '9876', '8765', '7654', '6543', '5432', '4321', '3210'])
export function pinError(pin) {
  if (!/^\d{4}$/.test(pin || '')) return 'Le code PIN doit comporter exactement 4 chiffres.'
  if (/^(\d)\1{3}$/.test(pin) || WEAK_PINS.has(pin)) return 'Code trop simple (ex. 0000, 1234) : choisissez-en un autre.'
  return ''
}

/** Signature active (non révoquée) d'un document, ou null */
export async function fetchActiveSignature(docType, docId) {
  if (!docId) return null
  docId = String(docId)
  const { supabase } = await import('../lib/supabase')
  const { data, error } = await supabase
    .from('document_signatures')
    .select('*')
    .eq('doc_type', docType)
    .eq('doc_id', docId)
    .is('revoked_at', null)
    .maybeSingle()
  if (error) throw error
  return data
}

/**
 * Version tolérante pour la génération des PDF : une erreur réseau (ou la migration
 * non appliquée) ne doit jamais empêcher de produire le document, il sort simplement sans signature.
 */
export async function loadSignatureSafe(docType, docId) {
  try {
    return await fetchActiveSignature(docType, docId)
  } catch (error) {
    console.warn('Signature du document indisponible', error)
    return null
  }
}

/** La signature reste valable tant que le montant du document n'a pas changé depuis la signature */
export function isSignatureCurrent(signature, amount) {
  if (!signature) return false
  if (signature.signed_amount == null || amount == null) return true
  return Math.abs(Number(signature.signed_amount) - Number(amount)) < 0.005
}

export function formatSignedAt(date) {
  const d = new Date(date)
  return `${d.toLocaleDateString('fr-FR')} à ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
}

/**
 * Bloc signature aligné à droite : « Le Gérant », l'image, puis la mention de signature électronique.
 * Occupe SIGNATURE_BLOCK_H mm de hauteur à partir de y.
 */
export function drawSignatureBlock(doc, signature, x, y, w, title = 'Le Gérant') {
  const blockW = 52
  const bx = x + w - blockW - 2
  const cx = bx + blockW / 2

  setFontSafe(doc, 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(26, 79, 160)
  doc.text(title, cx, y + 3, { align: 'center' })

  const maxH = 15
  const maxW = blockW - 6
  let imgW = maxW
  let imgH = maxH
  try {
    const props = doc.getImageProperties(signature.signature_image)
    const ratio = props.width / props.height
    imgH = Math.min(maxH, maxW / ratio)
    imgW = imgH * ratio
  } catch {
    /* dimensions par défaut */
  }
  doc.addImage(signature.signature_image, 'PNG', cx - imgW / 2, y + 4.5 + (maxH - imgH) / 2, imgW, imgH)

  setFontSafe(doc, 'normal')
  doc.setFontSize(5.8)
  doc.setTextColor(90, 90, 90)
  doc.text(`Signé électroniquement le ${formatSignedAt(signature.signed_at)}`, cx, y + 23, { align: 'center' })
  return y + SIGNATURE_BLOCK_H
}

/** Dessine l'image centrée dans une case existante (bons de livraison, reçus de dépôt) + la date en bas */
export function drawSignatureInBox(doc, signature, x, y, w, h) {
  const maxW = w - 6
  const maxH = h - 9
  let imgW = maxW
  let imgH = maxH
  try {
    const props = doc.getImageProperties(signature.signature_image)
    const ratio = props.width / props.height
    imgH = Math.min(maxH, maxW / ratio)
    imgW = imgH * ratio
  } catch {
    /* dimensions par défaut */
  }
  doc.addImage(signature.signature_image, 'PNG', x + (w - imgW) / 2, y + 5 + (maxH - imgH) / 2, imgW, imgH)
  setFontSafe(doc, 'normal')
  doc.setFontSize(5)
  doc.setTextColor(90, 90, 90)
  doc.text(`Signé électroniquement le ${formatSignedAt(signature.signed_at)}`, x + w / 2, y + h - 1.5, { align: 'center' })
}

/**
 * Prépare une photo / un scan de signature : fond clair rendu transparent, encre conservée,
 * recadrage automatique et réduction à 800 px de large. Retourne un data URL PNG.
 */
export async function prepareSignatureImage(file) {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('Image illisible.'))
      el.src = url
    })
    const scale = Math.min(1, 1600 / Math.max(img.width, img.height))
    const w = Math.round(img.width * scale)
    const h = Math.round(img.height * scale)
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    ctx.drawImage(img, 0, 0, w, h)
    const data = ctx.getImageData(0, 0, w, h)
    const px = data.data

    // Une image déjà transparente (PNG détouré) est conservée telle quelle
    let transparent = 0
    for (let i = 3; i < px.length; i += 4 * 50) if (px[i] < 250) transparent++
    const alreadyClean = transparent > px.length / (4 * 50) / 10

    let minX = w, minY = h, maxX = -1, maxY = -1
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4
        if (!alreadyClean) {
          const lum = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]
          const a = Math.max(0, Math.min(1, (185 - lum) / 70))
          px[i + 3] = Math.round(a * 255)
        }
        if (px[i + 3] > 60) {
          if (x < minX) minX = x
          if (x > maxX) maxX = x
          if (y < minY) minY = y
          if (y > maxY) maxY = y
        }
      }
    }
    if (maxX < 0) throw new Error('Aucune signature détectée sur l’image.')
    ctx.putImageData(data, 0, 0)

    const pad = 6
    const cropX = Math.max(0, minX - pad)
    const cropY = Math.max(0, minY - pad)
    const cropW = Math.min(w, maxX + pad) - cropX
    const cropH = Math.min(h, maxY + pad) - cropY
    const outScale = Math.min(1, 800 / cropW)
    const out = document.createElement('canvas')
    out.width = Math.round(cropW * outScale)
    out.height = Math.round(cropH * outScale)
    out.getContext('2d').drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, out.width, out.height)
    return out.toDataURL('image/png')
  } finally {
    URL.revokeObjectURL(url)
  }
}
