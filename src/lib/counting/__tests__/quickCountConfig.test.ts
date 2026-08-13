import { describe, it, expect } from 'vitest'
import { QUICK_COUNT_CONFIG, getQuickCountConfig } from '../quickCountConfig'
import { demoProducts } from '@/lib/seed/catalogue'
import { InputStep } from '@/types'

/**
 * Welke producten snelknoppen krijgen.
 *
 * Een lijst met product-id's als sleutel breekt stil: hernoem of verwijder een
 * product en de config wijst naar niets, zonder dat er iets stukgaat — het
 * product valt gewoon terug op de gewone invoer en niemand merkt dat de
 * versnelling weg is. Vandaar een test op de koppeling.
 */

const byId = new Map(demoProducts.map((p) => [p.id, p]))

describe('de config zelf', () => {
  it('verwijst alleen naar bestaande producten', () => {
    for (const productId of Object.keys(QUICK_COUNT_CONFIG)) {
      expect(byId.has(productId), productId).toBe(true)
    }
  })

  it('heeft overal een bruikbaar maximum', () => {
    for (const [productId, config] of Object.entries(QUICK_COUNT_CONFIG)) {
      // Onder de drie levert een rij knoppen niets op, boven de tien wordt het
      // een zoekplaatje.
      expect(config.max, productId).toBeGreaterThanOrEqual(3)
      expect(config.max, productId).toBeLessThanOrEqual(10)
    }
  })

  it('vraagt alleen halve verpakkingen waar het product die ook kent', () => {
    // Een halve-knop bij een product dat in hele stappen geteld wordt zou een
    // waarde opleveren die de rest van de app niet verwacht.
    for (const [productId, config] of Object.entries(QUICK_COUNT_CONFIG)) {
      if (config.mode !== 'HALF') continue
      const product = byId.get(productId)!

      expect(product.inputStep, productId).toBe(InputStep.HALF)
      expect(product.allowPartialPackage, productId).toBe(true)
    }
  })
})

describe('welke producten meedoen', () => {
  it('geeft bekers en chips halve verpakkingen', () => {
    for (const id of ['bierbeker-05', 'bierbeker-04', 'bierbeker-03']) {
      expect(getQuickCountConfig(id), id).toEqual({ mode: 'HALF', max: 5 })
    }
    for (const id of ['chips-blauw', 'chips-rood', 'chips-oranje']) {
      expect(getQuickCountConfig(id), id).toEqual({ mode: 'HALF', max: 6 })
    }
  })

  it('telt Post-mix in hele pakken tot acht', () => {
    for (const id of ['cola', 'cola-zero', 'fanta', 'sprite', 'fuze-tea-peach-hibiscus']) {
      expect(getQuickCountConfig(id), id).toEqual({ mode: 'INTEGER', max: 8 })
    }
    // Koolzuur is een cilinder; daar staan er nooit meer dan een paar.
    expect(getQuickCountConfig('koolzuur')).toEqual({ mode: 'INTEGER', max: 3 })
  })

  it('laat de gekoelde dranken met rust', () => {
    // Aantallen tot dertig, met halve pakken. Een rij van dertig knoppen is
    // geen versnelling.
    const dranken = [
      'chaudfontaine-blauw',
      'chaudfontaine-rood',
      'fuze-tea',
      'heineken-00',
      'radler',
      'stelz-icetea',
      'bacardi-lemon',
      'jack-daniels',
      'redbull',
      'bacardi-cola',
    ]

    for (const id of dranken) {
      expect(getQuickCountConfig(id), id).toBeUndefined()
    }
  })

  it('laat de sausflessen met rust', () => {
    // Normen rond de vijftien, per fles geteld: daar is typen sneller.
    for (const id of ['ketchup-flessen', 'mayo-flessen', 'mosterd-flessen']) {
      expect(getQuickCountConfig(id), id).toBeUndefined()
    }
    // De emmers wél: die staan er met een handjevol.
    expect(getQuickCountConfig('mayo-emmers')).toEqual({ mode: 'INTEGER', max: 5 })
  })

  it('geeft een onbekend product geen snelknoppen', () => {
    expect(getQuickCountConfig('bestaat-niet')).toBeUndefined()
  })
})

describe('chips tellen per halve doos', () => {
  it('staat in de catalogus op halve stappen', () => {
    for (const id of ['chips-blauw', 'chips-rood', 'chips-oranje']) {
      const chips = byId.get(id)!
      expect(chips.inputStep, id).toBe(InputStep.HALF)
      expect(chips.allowPartialPackage, id).toBe(true)
    }
  })

  it('laat de rest van de chipsgegevens ongemoeid', () => {
    const chips = byId.get('chips-blauw')!
    expect(chips.countUnit).toBe('zak')
    expect(chips.packagingUnit).toBe('dozen')
    expect(chips.categoryId).toBe('cat-chips')
  })
})
