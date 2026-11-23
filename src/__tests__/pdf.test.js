import { describe, it, expect } from 'vitest'
import { amountInWords, numberToFrench } from '../utils/pdfCommon'
import { generateInvoicePDF } from '../utils/invoicePdf'
import { generateDeliveryPDF } from '../utils/deliveryPdf'
import { generatePaymentReceiptPDF } from '../utils/paymentReceiptPdf'
import { pinError } from '../utils/signature'

describe('numberToFrench', () => {
  it.each([
    [0, 'zéro'],
    [21, 'vingt et un'],
    [71, 'soixante et onze'],
    [80, 'quatre-vingts'],
    [95, 'quatre-vingt-quinze'],
    [100, 'cent'],
    [200, 'deux cents'],
    [1000, 'mille'],
    [80000, 'quatre-vingt mille'],
    [163550, 'cent soixante-trois mille cinq cent cinquante'],
    [2401550, 'deux millions quatre cent un mille cinq cent cinquante'],
  ])('%i', (n, words) => expect(numberToFrench(n)).toBe(words))

  it('accorde « franc(s) CFA »', () => {
    expect(amountInWords(1)).toBe('un franc CFA')
    expect(amountInWords(35000)).toBe('trente-cinq mille francs CFA')
  })
})

describe('génération des PDF', () => {
  const items = Array.from({ length: 14 }, (_, i) => ({
    id: String(i),
    product_name: `Produit numéro ${i + 1} avec un nom très long pour tester le retour à la ligne`,
    quantity: i + 1,
    unit_price: 1500 + i * 100,
  }))

  it('la facture garde les 14 articles et reste sur une seule page', async () => {
    const doc = await generateInvoicePDF({
      invoice_number: 'FAC-2026-0001',
      created_at: '2026-10-19T10:00:00Z',
      clients: { name: 'Mamadou Faye', phone: '771234567' },
      sale_items: items,
      subtotal: 100000,
      discount: 5000,
      total: 95000,
      amount_paid: 50000,
      status: 'partielle',
      quote_status: 'confirmed',
      delivery_status: 'partielle',
    })
    expect(doc.getNumberOfPages()).toBe(1)
    expect(doc.internal.pageSize.getHeight()).toBeGreaterThan(200)
  })

  it('la facture signée est plus haute et la signature disparaît si le montant change', async () => {
    // PNG 1x1 transparent
    const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
    const sale = { invoice_number: 'FAC-2026-0002', created_at: '2026-10-19T10:00:00Z', sale_items: items.slice(0, 2), total: 3100, amount_paid: 0, status: 'credit', quote_status: 'confirmed' }
    const signature = { signature_image: png, signer_name: 'Gérant', signed_at: '2026-10-20T09:30:00Z', signed_amount: 3100 }
    const plain = await generateInvoicePDF(sale)
    const signed = await generateInvoicePDF(sale, { signature })
    const outdated = await generateInvoicePDF(sale, { signature: { ...signature, signed_amount: 9999 } })
    const h = (d) => d.internal.pageSize.getHeight()
    expect(h(signed)).toBeGreaterThan(h(plain))
    expect(h(outdated)).toBe(h(plain))
  })

  it('règles du code PIN', () => {
    expect(pinError('4821')).toBe('')
    expect(pinError('123')).not.toBe('')
    expect(pinError('0000')).not.toBe('')
    expect(pinError('1234')).not.toBe('')
  })

  it('bon de livraison et reçu se génèrent', async () => {
    const bl = await generateDeliveryPDF({
      delivery_number: 'BL-2026-0001',
      created_at: '2026-10-19T10:00:00Z',
      notes: 'Livré au comptoir',
      sale: { invoice_number: 'FAC-2026-0001', clients: { name: 'Mamadou Faye' } },
      delivery_items: [{ quantity_delivered: 3, ordered: 10, remaining: 7, sale_items: { product_name: 'Ciment', quantity: 10 } }],
    })
    expect(bl.getNumberOfPages()).toBe(1)
    const recu = await generatePaymentReceiptPDF({
      receiptNumber: 'REC-2026-000001',
      invoiceNumber: 'FAC-2026-0001',
      clientName: 'Mamadou Faye',
      amount: 25000,
      method: 'mobile_money',
      remaining: 0,
      total: 95000,
      createdAt: '2026-10-19T10:00:00Z',
      notes: 'Solde',
    })
    expect(recu.getNumberOfPages()).toBe(1)
  })
})

describe('PDF des dépôts clients', () => {
  const entries = [
    { id: '1', number: 'DEP-2026-0001', type: 'depot', amount: 267000, balance_after: 267000, method: 'especes', created_at: '2026-09-01T09:00:00Z' },
    { id: '2', number: 'RET-2026-0001', type: 'retrait', amount: -5000, balance_after: 262000, method: 'especes', created_at: '2026-09-01T10:00:00Z' },
    { id: '3', number: 'UTI-2026-0001', type: 'achat', amount: -10000, balance_after: 252000, method: 'depot', created_at: '2026-09-02T10:00:00Z', sales: { invoice_number: 'FAC-2026-0003' } },
  ]

  it('le reçu de retrait se génère avec le solde restant', async () => {
    const { generateDepositReceiptPDF } = await import('../utils/depositPdf')
    const doc = await generateDepositReceiptPDF(entries[1], { name: 'Moussa Diop', phone: '771234567' })
    expect(doc.getNumberOfPages()).toBe(1)
  })

  it('le relevé garde toutes les opérations sur une page', async () => {
    const { generateDepositStatementPDF, depositEntryLabel } = await import('../utils/depositPdf')
    const doc = await generateDepositStatementPDF({ name: 'Moussa Diop' }, entries)
    expect(doc.getNumberOfPages()).toBe(1)
    expect(depositEntryLabel(entries[2])).toBe('Achat facture FAC-2026-0003')
  })
})
