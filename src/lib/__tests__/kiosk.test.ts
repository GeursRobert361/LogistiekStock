import { describe, expect, it } from 'vitest'
import { kioskLabel, kioskTitle } from '../kiosk'
import type { Kiosk } from '@/types'
import { DrinkStorageType } from '@/types'

function kiosk(overrides: Partial<Kiosk> = {}): Kiosk {
  return {
    id: 'k1',
    ringId: 'r1',
    number: 120,
    sortOrder: 200,
    isActive: true,
    drinkStorageType: DrinkStorageType.NONE,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('kioskLabel', () => {
  it('valt terug op het nummer als er geen opschrift is', () => {
    expect(kioskLabel(kiosk())).toBe('120')
  })

  it('gebruikt het opschrift als dat er wel is', () => {
    expect(kioskLabel(kiosk({ number: 1201, label: '120 Cubes' }))).toBe('120 Cubes')
  })

  it('negeert een opschrift dat alleen uit spaties bestaat', () => {
    expect(kioskLabel(kiosk({ label: '   ' }))).toBe('120')
  })

  it('geeft een lege string voor een onbekende kiosk', () => {
    expect(kioskLabel(undefined)).toBe('')
    expect(kioskLabel(null)).toBe('')
  })
})

describe('kioskTitle', () => {
  it('zet "Kiosk" voor een kaal nummer', () => {
    expect(kioskTitle(kiosk())).toBe('Kiosk 120')
  })

  it('laat een opschrift ongemoeid — "Kiosk 120 Cubes" leest verkeerd', () => {
    expect(kioskTitle(kiosk({ number: 1201, label: '120 Cubes' }))).toBe('120 Cubes')
  })

  it('geeft een lege string voor een onbekende kiosk', () => {
    expect(kioskTitle(undefined)).toBe('')
  })
})
