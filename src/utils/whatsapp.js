import { WHATSAPP_MESSAGE, currency } from '../lib/constants'
import { getInvoicePDFBlob } from './invoicePdf'
import { getPaymentReceiptPDFBlob } from './paymentReceiptPdf'

/**
 * Normalise un numéro de téléphone sénégalais/international pour wa.me
 */
export function normalizePhone(phone) {
  if (!phone) return ''
  let cleaned = String(phone).replace(/[\s.\-()]/g, '')
  if (cleaned.startsWith('00')) cleaned = '+' + cleaned.slice(2)
  if (!cleaned.startsWith('+')) {
    // Numéro sénégalais local (9 chiffres) -> ajouter indicatif +221
    cleaned = cleaned.startsWith('221') ? '+' + cleaned : '+221' + cleaned.replace(/^0/, '')
  }
  cleaned = cleaned.replace('+', '')
  // Un numéro wa.me ne contient que des chiffres
  return /^\d{8,15}$/.test(cleaned) ? cleaned : ''
}

function openWhatsAppLink(phone, message) {
  const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
  window.open(url, '_blank')
}

/**
 * Tente de partager un PDF via le Web Share API (mobile) ; renvoie false si impossible
 * (navigateur sans support fichiers, partage annulé, etc.).
 */
async function sharePdf({ title, text, blob, fileName }) {
  if (!navigator.share) return false
  const file = new File([blob], fileName, { type: 'application/pdf' })
  if (navigator.canShare && !navigator.canShare({ files: [file] })) return false
  try {
    await navigator.share({ title, text, files: [file] })
    return true
  } catch (error) {
    // AbortError = l'utilisateur a fermé la feuille de partage : on ne force pas le fallback
    if (error?.name === 'AbortError') return true
    console.warn('Partage du PDF impossible, ouverture de WhatsApp en fallback', error)
    return false
  }
}

/**
 * Partage la facture en PDF via le Web Share API si possible, sinon ouvre WhatsApp avec le message.
 */
export async function sendInvoiceViaWhatsApp(sale) {
  const phone = normalizePhone(sale.clients?.phone)
  if (!phone) return

  const message = WHATSAPP_MESSAGE(sale.clients?.name, sale.invoice_number, currency(sale.total))

  try {
    const blob = await getInvoicePDFBlob(sale)
    const shared = await sharePdf({
      title: `Facture ${sale.invoice_number}`,
      text: message,
      blob,
      fileName: `${sale.invoice_number}.pdf`,
    })
    if (shared) return
  } catch (error) {
    console.warn('Génération du PDF impossible, ouverture de WhatsApp en fallback', error)
  }

  openWhatsAppLink(phone, message)
}

/**
 * Même principe pour un reçu de paiement. `receipt.clientPhone` est requis.
 */
export async function sendReceiptViaWhatsApp(receipt) {
  const phone = normalizePhone(receipt.clientPhone)
  if (!phone) return

  const message = `Reçu de paiement ${receipt.receiptNumber} pour la facture ${receipt.invoiceNumber} : ${currency(receipt.amount)} payé sur ${currency(receipt.total)}. Reste : ${currency(receipt.remaining || 0)}.`

  try {
    const blob = await getPaymentReceiptPDFBlob(receipt)
    const shared = await sharePdf({
      title: `Reçu ${receipt.receiptNumber}`,
      text: message,
      blob,
      fileName: `${receipt.receiptNumber || 'recu'}.pdf`,
    })
    if (shared) return
  } catch (error) {
    console.warn('Génération du PDF impossible, ouverture de WhatsApp en fallback', error)
  }

  openWhatsAppLink(phone, message)
}
