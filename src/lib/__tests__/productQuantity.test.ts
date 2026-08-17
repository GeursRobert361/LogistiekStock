import { describe, it, expect } from 'vitest'
import { formatProductQuantity, packagingUnitFor, hasSingularForm } from '../productQuantity'
import { demoProducts } from '@/lib/seed/catalogue'
import type { Product } from '@/types'

/** Alleen de velden die deze helper leest. */
function product(packagingUnit: string): Pick<Product, 'packagingUnit'> {
  return { packagingUnit }
}

const doos = product('dozen')
const tray = product('trays')
const rol = product('rollen')

describe('formatProductQuantity', () => {
  it('gebruikt enkelvoud bij precies één', () => {
    expect(formatProductQuantity(doos, 1)).toBe('1 doos')
    expect(formatProductQuantity(rol, 1)).toBe('1 rol')
  })

  it('gebruikt meervoud vanaf twee', () => {
    expect(formatProductQuantity(doos, 2)).toBe('2 dozen')
    expect(formatProductQuantity(rol, 3)).toBe('3 rollen')
  })

  it('schrijft een halve verpakking in het enkelvoud', () => {
    // Een halve doos is een deel van één doos, geen "0,5 dozen".
    expect(formatProductQuantity(doos, 0.5)).toBe('0,5 doos')
    expect(formatProductQuantity(tray, 0.25)).toBe('0,25 tray')
  })

  it('schrijft meer dan één in het meervoud, ook met een fractie', () => {
    expect(formatProductQuantity(doos, 1.5)).toBe('1,5 dozen')
    expect(formatProductQuantity(tray, 2.75)).toBe('2,75 trays')
  })

  it('gebruikt een komma en geen punt', () => {
    // De rest van de app doet dat ook; een Amerikaanse punt op papier leest als
    // een ander getal.
    expect(formatProductQuantity(doos, 1.5)).not.toContain('.')
  })

  it('houdt nul in het meervoud', () => {
    expect(formatProductQuantity(doos, 0)).toBe('0 dozen')
  })
})

describe('packagingUnitFor', () => {
  it('gaat uit van de verpakking en niet van wat de kiosk telt', () => {
    // Bacardi Lime & Lemonade telt blikjes maar wordt per tray geleverd. Een
    // vullijst die "1 blikje" zegt stuurt iemand met één blikje op pad.
    const bacardi = demoProducts.find((p) => p.id === 'bacardi-lemon')!
    expect(bacardi.countUnit).toBe('blikje')
    expect(packagingUnitFor(bacardi, 1)).toBe('tray')
  })

  it('doet hetzelfde bij wijn en Caprisun', () => {
    const wijn = demoProducts.find((p) => p.id === 'witte-wijn')!
    const caprisun = demoProducts.find((p) => p.id === 'caprisun')!

    expect(packagingUnitFor(wijn, 1)).toBe('doos')
    expect(packagingUnitFor(caprisun, 1)).toBe('doos')
  })

  it('laat een onbekende eenheid staan in plaats van er een te verzinnen', () => {
    expect(packagingUnitFor(product('kratten'), 1)).toBe('kratten')
  })
})

describe('de catalogus', () => {
  it('heeft voor elke verpakkingseenheid een enkelvoud', () => {
    // Dit is de vangnettest: komt er een verpakkingseenheid bij zonder
    // enkelvoud, dan hoort dat hier om te vallen en niet op een geprinte lijst.
    const zonder = [...new Set(demoProducts.map((p) => p.packagingUnit))]
      .filter((unit) => !hasSingularForm(unit))
      .sort()

    expect(zonder).toEqual([])
  })
})
