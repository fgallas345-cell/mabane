import { describe, it, expect } from 'vitest'
import { normalizePhone } from '../utils/whatsapp'

describe('normalizePhone', () => {
  it('ajoute l’indicatif sénégalais aux numéros locaux', () => {
    expect(normalizePhone('77 845 28 72')).toBe('221778452872')
    expect(normalizePhone('077-845-28-72')).toBe('221778452872')
  })

  it('conserve un numéro international', () => {
    expect(normalizePhone('+221 78 213 33 12')).toBe('221782133312')
    expect(normalizePhone('00221782133312')).toBe('221782133312')
    expect(normalizePhone('221782133312')).toBe('221782133312')
  })

  it('renvoie une chaîne vide pour une valeur invalide (ex. un nom)', () => {
    expect(normalizePhone('')).toBe('')
    expect(normalizePhone(null)).toBe('')
    expect(normalizePhone('Mamadou Faye')).toBe('')
  })
})
