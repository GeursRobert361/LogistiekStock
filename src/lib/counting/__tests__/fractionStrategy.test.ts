import { describe, it, expect } from 'vitest'
import { fractionStrategyFor, PRODUCTS_WITH_OWN_FRACTION_RULE } from '../fractionStrategy'
import { calculateRestockQuantity } from '@/domain/counting/calculateRestock'
import { buildCountEntry } from '@/services/countingService'
import { demoProducts } from '@/lib/seed/catalogue'
import { FractionRule, FractionStrategy } from '@/types'

/**
 * De afwijkende afrondregel voor Biertrays.
 *
 * Een aangebroken doos telt daar pas mee vanaf driekwart: een halve doos is
 * tijdens een evenement zo weg, dus wie hem als voorraad meerekent staat in de
 * tweede helft met lege handen. Voor al het andere blijft de algemene
 * 80%-regel gelden, en dat is precies wat hier ook bewaakt wordt.
 */

const BIERTRAYS = 'Biertrays'

/** Bijvuladvies volgens de regel van dit product. */
function advies(productName: string, norm: number, geteld: number) {
  return calculateRestockQuantity({
    targetQuantity: norm,
    countedQuantity: geteld,
    fractionStrategy: fractionStrategyFor(productName),
  })
}

describe('de strategie per product', () => {
  it('geeft Biertrays de afwijkende regel', () => {
    expect(fractionStrategyFor(BIERTRAYS)).toBe(FractionStrategy.BREAK_AT_THREE_QUARTER)
  })

  it('geeft al het andere de algemene regel', () => {
    for (const naam of ['Chips Blauw', 'Bierbekers 0,5', 'Water Blauw', 'Coca-Cola']) {
      expect(fractionStrategyFor(naam), naam).toBe(FractionStrategy.STANDARD)
    }
  })

  it('valt terug op de algemene regel bij een onbekend of ontbrekend product', () => {
    expect(fractionStrategyFor('Bestaat Niet')).toBe(FractionStrategy.STANDARD)
    expect(fractionStrategyFor(undefined)).toBe(FractionStrategy.STANDARD)
    expect(fractionStrategyFor(null)).toBe(FractionStrategy.STANDARD)
  })

  it('verwijst naar een product dat werkelijk zo heet', () => {
    // De sleutel is de productnaam, en dit product is net hernoemd van
    // "Sixpacks" naar "Biertrays". Loopt de naam hier en die in de catalogus
    // uit elkaar, dan hoort de build stuk te gaan — niet het bijvuladvies.
    const namen = new Set(demoProducts.map((p) => p.name))
    for (const naam of PRODUCTS_WITH_OWN_FRACTION_RULE) {
      expect(namen.has(naam), naam).toBe(true)
    }
  })

  it('hangt aan het product met id sixpacks', () => {
    // Het id blijft; alleen de zichtbare naam veranderde.
    const product = demoProducts.find((p) => p.id === 'sixpacks')!
    expect(product.name).toBe(BIERTRAYS)
    expect(fractionStrategyFor(product.name)).toBe(FractionStrategy.BREAK_AT_THREE_QUARTER)
  })
})

describe('Biertrays bij norm 3', () => {
  const gevallen: Array<[number, number, number]> = [
    // geteld, effectief, bijvullen
    [2, 2, 1],
    [2.25, 2, 1],
    [2.5, 2, 1],
    [2.75, 3, 0],
    [3, 3, 0],
  ]

  it.each(gevallen)('geteld %s → effectief %s, bijvullen %s', (geteld, effectief, bijvullen) => {
    const result = advies(BIERTRAYS, 3, geteld)

    expect(result.effectiveQuantity).toBe(effectief)
    expect(result.restockQuantity).toBe(bijvullen)
  })

  it('bewaart het werkelijk getelde aantal', () => {
    // De historie moet blijven tonen dat er 2,5 stond; alleen het advies rekent
    // met 2.
    const result = advies(BIERTRAYS, 3, 2.5)
    expect(result.countedQuantity).toBe(2.5)
  })
})

describe('Biertrays bij andere aantallen', () => {
  it.each([
    [1.25, 1],
    [1.5, 1],
    [1.75, 2],
  ])('geteld %s → effectief %s', (geteld, effectief) => {
    expect(advies(BIERTRAYS, 3, geteld).effectiveQuantity).toBe(effectief)
  })

  it('laat hele dozen met rust', () => {
    expect(advies(BIERTRAYS, 3, 0).effectiveQuantity).toBe(0)
    expect(advies(BIERTRAYS, 3, 1).effectiveQuantity).toBe(1)
    expect(advies(BIERTRAYS, 3, 4).effectiveQuantity).toBe(4)
  })
})

describe('de algemene regel blijft ongewijzigd', () => {
  it('telt een halve doos chips wél mee ver onder de norm', () => {
    // Norm 6, geteld 4,5: onder de 80%-drempel, dus de halve telt niet mee —
    // exact zoals het altijd was.
    const chips = advies('Chips Blauw', 6, 4.5)
    expect(chips.effectiveQuantity).toBe(4)
    expect(chips.appliedFractionRule).toBe(FractionRule.HALF_DOWN)
  })

  it('telt een halve verpakking boven de drempel omhoog', () => {
    // Norm 6, geteld 5,5: 5 ligt boven 80% van 6, dus afronden naar boven.
    const water = advies('Water Blauw', 6, 5.5)
    expect(water.effectiveQuantity).toBe(6)
    expect(water.appliedFractionRule).toBe(FractionRule.HALF_UP)
  })

  it('doet bij Biertrays juist niet aan die drempel', () => {
    // Zelfde getallen als hierboven, ander product: 5,5 van 6 blijft 5.
    const trays = advies(BIERTRAYS, 6, 5.5)
    expect(trays.effectiveQuantity).toBe(5)
    expect(trays.appliedFractionRule).toBe(FractionRule.HALF_DOWN)
  })

  it('laat kwart en driekwart in beide strategieën hetzelfde doen', () => {
    for (const naam of [BIERTRAYS, 'Chips Blauw']) {
      expect(advies(naam, 6, 5.25).effectiveQuantity, `${naam} .25`).toBe(5)
      expect(advies(naam, 6, 5.75).effectiveQuantity, `${naam} .75`).toBe(6)
    }
  })

  it('rekent zonder strategie precies als voorheen', () => {
    // Weglaten van de strategie mag niets veranderen aan bestaand gedrag.
    const zonder = calculateRestockQuantity({ targetQuantity: 6, countedQuantity: 5.5 })
    const metStandaard = calculateRestockQuantity({
      targetQuantity: 6,
      countedQuantity: 5.5,
      fractionStrategy: FractionStrategy.STANDARD,
    })

    expect(zonder).toEqual(metStandaard)
    expect(zonder.effectiveQuantity).toBe(6)
  })
})

describe('door de opslagflow heen', () => {
  const standard = { targetQuantityQuarters: 12, halfPackageThresholdPercentage: 80 }

  it('slaat het aantal exact op en het advies volgens de biertrayregel', () => {
    const entry = buildCountEntry({
      kioskCountId: 'kc-1',
      productId: 'sixpacks',
      standard,
      countedQuarters: 10, // 2,5 dozen
      userId: 'u-1',
      fractionStrategy: FractionStrategy.BREAK_AT_THREE_QUARTER,
    })

    // De telling blijft 2,5; alleen het effectieve aantal is 2.
    expect(entry.countedQuantityQuarters).toBe(10)
    expect(entry.effectiveQuantityQuarters).toBe(8)
    expect(entry.restockQuantityPackages).toBe(1)
  })

  it('laat een telling zonder strategie de algemene regel houden', () => {
    // Norm 6, geteld 5,5: vijf hele ligt boven 80% van zes, dus telt de halve
    // mee. Zelfde getallen zouden bij Biertrays op 5 uitkomen.
    const entry = buildCountEntry({
      kioskCountId: 'kc-1',
      productId: 'chips-blauw',
      standard: { targetQuantityQuarters: 24, halfPackageThresholdPercentage: 80 },
      countedQuarters: 22,
      userId: 'u-1',
    })

    expect(entry.effectiveQuantityQuarters).toBe(24)
    expect(entry.restockQuantityPackages).toBe(0)
  })
})
