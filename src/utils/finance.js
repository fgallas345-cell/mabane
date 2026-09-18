// Calculs financiers purs (sans React ni Supabase) : utilisés par Finances,
// le Dashboard et couverts par des tests unitaires.

/** Marge brute d'une liste de lignes : Σ (prix de vente − prix d'achat) × quantité */
export function itemsGrossMargin(items = []) {
  return items.reduce((sum, item) => {
    const purchasePrice = Number(item.purchase_price ?? 0)
    const unitPrice = Number(item.unit_price ?? 0)
    const quantity = Number(item.quantity ?? 0)
    return sum + (unitPrice - purchasePrice) * quantity
  }, 0)
}

/** Marge brute d'une facture (lignes − remise) */
export function getSaleGrossMargin(sale) {
  return itemsGrossMargin(sale.sale_items) - Number(sale.discount || 0)
}

/** Marge brute d'une petite vente (lignes − remise) */
export function getSmallSaleGrossMargin(sale) {
  return itemsGrossMargin(sale.small_sale_items) - Number(sale.discount || 0)
}

/** Une facture compte dans le chiffre d'affaires si elle n'est ni annulée ni un devis */
export function isCountedSale(sale) {
  return sale.status !== 'annulee' && sale.quote_status !== 'draft'
}

/** Reste dû d'une facture (jamais négatif) */
export function saleBalanceDue(sale) {
  return Math.max(0, Number(sale.total || 0) - Number(sale.amount_paid || 0))
}
