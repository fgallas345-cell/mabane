import { describe, it, expect } from 'vitest'
import { currency } from '../lib/constants'

describe('currency', () => {
  it('formate en FCFA sans décimales avec séparateur de milliers', () => {
    expect(currency(1234567)).toBe('1 234 567 FCFA')
    expect(currency('2500.6')).toBe('2 501 FCFA')
  })

  it('traite null/undefined comme 0', () => {
    expect(currency(null)).toBe('0 FCFA')
    expect(currency(undefined)).toBe('0 FCFA')
  })
})
