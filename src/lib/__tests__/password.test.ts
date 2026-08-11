import { describe, it, expect } from 'vitest'
import { generatePassword, validatePassword, MIN_PASSWORD_LENGTH } from '../password'

describe('generatePassword', () => {
  it('levert drie groepen van vier tekens', () => {
    expect(generatePassword()).toMatch(/^[a-z2-9]{4}-[a-z2-9]{4}-[a-z2-9]{4}$/)
  })

  it('gebruikt nooit tekens die verkeerd worden overgetikt', () => {
    // Ruim genoeg trekken om een zeldzaam teken alsnog te betrappen.
    for (let i = 0; i < 500; i++) {
      expect(generatePassword()).not.toMatch(/[l1IO0]/)
    }
  })

  it('geeft niet twee keer hetzelfde', () => {
    const trekkingen = new Set(Array.from({ length: 100 }, () => generatePassword()))
    expect(trekkingen.size).toBe(100)
  })
})

describe('validatePassword', () => {
  it('weigert een te kort wachtwoord', () => {
    expect(validatePassword('kort')).toMatch(/minstens/i)
  })

  it('laat een wachtwoord op de grens door', () => {
    expect(validatePassword('a'.repeat(MIN_PASSWORD_LENGTH))).toBeNull()
  })

  it('laat een gegenereerd wachtwoord door', () => {
    expect(validatePassword(generatePassword())).toBeNull()
  })
})
