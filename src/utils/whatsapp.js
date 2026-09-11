import { WHATSAPP_MESSAGE, currency } from '../lib/constants'
import { getInvoicePDFBlob } from './invoicePdf'
import { getPaymentReceiptPDFBlob } from './paymentReceiptPdf'

export async function sendReceiptViaWhatsApp(receipt) {
  const phone = normalizePhone(receipt.clientName)
  if (!phone) return

  const message = `Reçu de paiement ${receipt.receiptNumber} pour la facture ${receipt.invoiceNumber} : ${currency(receipt.amount)} payé sur ${currency(receipt.total)}. Reste : ${currency(receipt.remaining || 0)}.`

  try {
    const pdfBlob = await getPaymentReceiptPDFBlob(receipt)
    const pdfFile = new File([pdfBlob], `${receipt.receiptNumber || 'recu'}.pdf`, { type: 'application/pdf' })

    if (navigator.share && navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
      await navigator.share({
        title: `Reçu ${receipt.receiptNumber}`,
        text: message,
        files: [pdfFile],
      })
      return
    }

    if (navigator.share) {
      await navigator.share({
        title: `Reçu ${receipt.receiptNumber}`,
        text: message,
        files: [pdfFile],
      })
      return
    }
  } catch (error) {
    console.warn('Impossible de partager le reçu PDF, ouverture de WhatsApp en fallback', error)
  }

  openWhatsAppLink(phone, message)
}

/**
 * Normalise un numéro de téléphone sénégalais/international pour wa.me
 */
export function normalizePhone(phone) {
  if (!phone) return ''
  let cleaned = phone.replace(/[\s.\-()]/g, '')
  if (cleaned.startsWith('00')) cleaned = '+' + cleaned.slice(2)
  if (!cleaned.startsWith('+')) {
    // Numéro sénégalais local (9 chiffres) -> ajouter indicatif +221
    cleaned = cleaned.startsWith('221') ? '+' + cleaned : '+221' + cleaned.replace(/^0/, '')
  }
  return cleaned.replace('+', '')
}

function openWhatsAppLink(phone, message) {
  const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
  window.open(url, '_blank')
}

/**
 * Partage la facture en PDF via le Web Share API si possible, sinon ouvre WhatsApp Web avec le message.
 */
export async function sendInvoiceViaWhatsApp(sale) {
  const phone = normalizePhone(sale.clients?.phone)
  if (!phone) return

  const message = WHATSAPP_MESSAGE(sale.clients?.name, sale.invoice_number, currency(sale.total))

  try {
    const pdfBlob = await getInvoicePDFBlob(sale)
    const pdfFile = new File([pdfBlob], `${sale.invoice_number}.pdf`, { type: 'application/pdf' })

    if (navigator.share && navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
      await navigator.share({
        title: `Facture ${sale.invoice_number}`,
        text: message,
        files: [pdfFile],
      })
      return
    }

    // Certains navigateurs supportent share() sans canShare()
    if (navigator.share) {
      await navigator.share({
        title: `Facture ${sale.invoice_number}`,
        text: message,
        files: [pdfFile],
      })
      return
    }
  } catch (error) {
    console.warn('Impossible de partager le PDF, ouverture de WhatsApp en fallback', error)
  }

  openWhatsAppLink(phone, message)
}
