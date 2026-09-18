import { describe, it, expect } from 'vitest'
import { itemsGrossMargin, getSaleGrossMargin, getSmallSaleGrossMargin, isCountedSale, saleBalanceDue } from '../utils/finance'

describe('itemsGrossMargin', () => {
  it('somme (prix vente − prix achat) × quantité', () => {
    const items = [
      { unit_price: 1000, purchase_price: 700, quantity: 3 }, // 900
      { unit_price: 500, purchase_price: 500, quantity: 10 }, // 0
    ]
    expect(itemsGrossMargin(items)).toBe(900)
  })

  it('accepte les valeurs numériques sous forme de chaînes (numeric PostgreSQL)', () => {
    expect(itemsGrossMargin([{ unit_price: '1200.50', purchase_price: '1000', quantity: '2' }])).toBeCloseTo(401)
  })

  it('renvoie 0 sans lignes', () => {
    expect(itemsGrossMargin()).toBe(0)
    expect(itemsGrossMargin([])).toBe(0)
  })
})

describe('getSaleGrossMargin / getSmallSaleGrossMargin', () => {
  it('déduit la remise de la marge', () => {
    const sale = { discount: 100, sale_items: [{ unit_price: 1000, purchase_price: 600, quantity: 1 }] }
    expect(getSaleGrossMargin(sale)).toBe(300)
  })

  it('peut être négative si la remise dépasse la marge', () => {
    const sale = { discount: 500, small_sale_items: [{ unit_price: 1000, purchase_price: 800, quantity: 1 }] }
    expect(getSmallSaleGrossMargin(sale)).toBe(-300)
  })
})

describe('isCountedSale', () => {
  it('exclut les annulées et les devis', () => {
    expect(isCountedSale({ status: 'payee', quote_status: 'confirmed' })).toBe(true)
    expect(isCountedSale({ status: 'annulee', quote_status: 'confirmed' })).toBe(false)
    expect(isCountedSale({ status: 'credit', quote_status: 'draft' })).toBe(false)
  })
})

describe('saleBalanceDue', () => {
  it('total − encaissé, jamais négatif', () => {
    expect(saleBalanceDue({ total: 10000, amount_paid: 4000 })).toBe(6000)
    expect(saleBalanceDue({ total: 10000, amount_paid: 10000 })).toBe(0)
    expect(saleBalanceDue({ total: 100, amount_paid: 150 })).toBe(0)
  })
})
