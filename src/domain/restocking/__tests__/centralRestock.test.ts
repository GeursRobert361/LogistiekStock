import { describe, it, expect } from 'vitest'
import { shouldGenerateCentralRestock, isLargeCoolerDrinkStock } from '../centralRestock'
import { buildRestockRequirements } from '../buildRequirements'
import { DrinkStorageType, KioskCountStatus, FractionRule } from '@/types'
import type { KioskCount, CountEntry } from '@/types'

/**
 * De satellietregel, en vooral: wat hij níet mag raken.
 *
 * Een satelliet verkoopt drank uit een werkvoorraad van één en haalt tijdens
 * het evenement bij uit een grote kiosk. Alles wat die satelliet verder voert
 * hoort volstrekt normaal aangevuld te worden — en dat is precies wat hier
 * tegen regressies wordt vastgelegd.
 */

const DRANK = { suppliedFromLargeCoolerForSatellite: true }
const GEEN_DRANK = { suppliedFromLargeCoolerForSatellite: false }

describe('shouldGenerateCentralRestock', () => {
  it('slaat gewone drank bij een satelliet over', () => {
    expect(
      shouldGenerateCentralRestock({
        kiosk: { drinkStorageType: DrinkStorageType.SATELLITE },
        product: DRANK,
      })
    ).toBe(false)
  })

  it.each([
    ['bierbekers', GEEN_DRANK],
    ['chips', GEEN_DRANK],
    ['post-mix', GEEN_DRANK],
    ['koffie', GEEN_DRANK],
    ['verpakkingen', GEEN_DRANK],
    ['sauzen', GEEN_DRANK],
    ['schoonmaak', GEEN_DRANK],
  ])('vult %s bij een satelliet gewoon aan', (_naam, product) => {
    expect(
      shouldGenerateCentralRestock({
        kiosk: { drinkStorageType: DrinkStorageType.SATELLITE },
        product,
      })
    ).toBe(true)
  })

  it('vult drank bij een grote koeling gewoon aan', () => {
    expect(
      shouldGenerateCentralRestock({
        kiosk: { drinkStorageType: DrinkStorageType.LARGE_COOLER },
        product: DRANK,
      })
    ).toBe(true)
  })

  it('vult drank bij een kleine bar gewoon aan', () => {
    // Een kleine bar is geen satelliet: die norm van 2 is echte voorraad.
    expect(
      shouldGenerateCentralRestock({
        kiosk: { drinkStorageType: DrinkStorageType.SMALL_BAR },
        product: DRANK,
      })
    ).toBe(true)
  })

  it('vult gewoon aan bij een locatie zonder drankvoorraad', () => {
    expect(
      shouldGenerateCentralRestock({
        kiosk: { drinkStorageType: DrinkStorageType.NONE },
        product: DRANK,
      })
    ).toBe(true)
  })

  it('vult drank wél aan bij een satelliet met eigen voorraad', () => {
    // Ziggo Platform: een satelliet met een eigen stocklijst en echte
    // dranknormen. Zonder deze uitzondering wordt die drank geteld en nooit
    // aangevuld — de teller ziet een tekort en de vulplanning ziet niets.
    expect(
      shouldGenerateCentralRestock({
        kiosk: { drinkStorageType: DrinkStorageType.SATELLITE, keepsOwnDrinkStock: true },
        product: DRANK,
      })
    ).toBe(true)
  })

  it('blijft zonder dat kenmerk gewoon overslaan', () => {
    // De uitzondering hoort expliciet te zijn. Een satelliet die er niets over
    // zegt valt onder de gewone regel.
    expect(
      shouldGenerateCentralRestock({
        kiosk: { drinkStorageType: DrinkStorageType.SATELLITE, keepsOwnDrinkStock: false },
        product: DRANK,
      })
    ).toBe(false)
  })
})

describe('isLargeCoolerDrinkStock', () => {
  it('telt alleen grote koelingen', () => {
    expect(isLargeCoolerDrinkStock({ drinkStorageType: DrinkStorageType.LARGE_COOLER })).toBe(true)
    expect(isLargeCoolerDrinkStock({ drinkStorageType: DrinkStorageType.SATELLITE })).toBe(false)
    expect(isLargeCoolerDrinkStock({ drinkStorageType: DrinkStorageType.SMALL_BAR })).toBe(false)
    expect(isLargeCoolerDrinkStock({ drinkStorageType: DrinkStorageType.NONE })).toBe(false)
  })
})

// ─── Via de echte behoeftegeneratie ──────────────────────────────────────────

function kioskCount(id: string, kioskId: string): KioskCount {
  return {
    id,
    countSessionId: 'sessie-1',
    kioskId,
    counterId: 'teller-1',
    status: KioskCountStatus.COMPLETED,
    startedAt: '2026-08-12T10:00:00Z',
    completedAt: '2026-08-12T10:30:00Z',
    createdAt: '2026-08-12T10:00:00Z',
    updatedAt: '2026-08-12T10:30:00Z',
  }
}

function entry(kioskCountId: string, productId: string, restock: number): CountEntry {
  return {
    id: `${kioskCountId}:${productId}`,
    kioskCountId,
    productId,
    targetQuantityQuarters: 4,
    countedQuantityQuarters: 0,
    effectiveQuantityQuarters: 0,
    restockQuantityPackages: restock,
    appliedFractionRule: FractionRule.NONE,
    lastModifiedAt: '2026-08-12T10:30:00Z',
    lastModifiedById: 'teller-1',
  }
}

/** Bouwt behoeften met één kiosk en een handvol regels. */
function behoeften(params: {
  storage: DrinkStorageType
  regels: Array<{ productId: string; restock: number }>
  drankProducten: string[]
  eigenDrankvoorraad?: boolean
}) {
  const kc = kioskCount('kc-1', 'kiosk-402')
  return buildRestockRequirements({
    eventId: 'event-1',
    kioskCounts: [kc],
    entriesByKioskCount: new Map([
      ['kc-1', params.regels.map((r) => entry('kc-1', r.productId, r.restock))],
    ]),
    kioskStorage: new Map([['kiosk-402', params.storage]]),
    satelliteSuppliedProductIds: new Set(params.drankProducten),
    localDrinkStockKioskIds: params.eigenDrankvoorraad ? new Set(['kiosk-402']) : undefined,
  })
}

describe('behoeften van een satelliet', () => {
  it('laat drank weg maar houdt alles daaromheen', () => {
    const result = behoeften({
      storage: DrinkStorageType.SATELLITE,
      drankProducten: ['fuze-tea', 'bacardi-cola'],
      regels: [
        { productId: 'fuze-tea', restock: 1 },
        { productId: 'bacardi-cola', restock: 1 },
        { productId: 'bierbeker-05', restock: 1 },
        { productId: 'chips-blauw', restock: 2 },
        { productId: 'cola', restock: 2 },
        { productId: 'tork-rol', restock: 5 },
        { productId: 'ketchup-flessen', restock: 5 },
      ],
    })

    // Deze vier moeten tegelijk kunnen bestaan met de weggelaten drank.
    expect(result.map((r) => [r.productId, r.requiredPackages])).toEqual([
      ['bierbeker-05', 1],
      ['chips-blauw', 2],
      ['cola', 2],
      ['ketchup-flessen', 5],
      ['tork-rol', 5],
    ])
  })

  it('vult bij een kleine bar dezelfde drank wél aan', () => {
    const result = behoeften({
      storage: DrinkStorageType.SMALL_BAR,
      drankProducten: ['fuze-tea'],
      regels: [{ productId: 'fuze-tea', restock: 2 }],
    })

    expect(result).toHaveLength(1)
    expect(result[0]!.requiredPackages).toBe(2)
  })

  it('vult bij een grote koeling gewoon aan', () => {
    const result = behoeften({
      storage: DrinkStorageType.LARGE_COOLER,
      drankProducten: ['chaudfontaine-blauw'],
      regels: [{ productId: 'chaudfontaine-blauw', restock: 15 }],
    })

    expect(result[0]!.requiredPackages).toBe(15)
  })

  it('sluit een product met norm 1 bij een grote koeling niet uit', () => {
    // De regel gaat over het opslagtype, niet over de hoogte van de norm.
    const result = behoeften({
      storage: DrinkStorageType.LARGE_COOLER,
      drankProducten: ['redbull'],
      regels: [{ productId: 'redbull', restock: 1 }],
    })

    expect(result).toHaveLength(1)
  })

  it('vult drank wél aan bij een satelliet met een eigen stocklijst', () => {
    // De tien dranken van Ziggo Platform, in het klein. Deze tekorten moeten
    // gewoon in de vulplanning terechtkomen; "wel tellen, niet bijvullen" is
    // precies wat hier niet mag gebeuren.
    const result = behoeften({
      storage: DrinkStorageType.SATELLITE,
      eigenDrankvoorraad: true,
      drankProducten: ['fuze-tea', 'bacardi-cola', 'redbull'],
      regels: [
        { productId: 'fuze-tea', restock: 2 },
        { productId: 'bacardi-cola', restock: 1 },
        { productId: 'redbull', restock: 1 },
        { productId: 'bierbeker-05', restock: 1 },
      ],
    })

    expect(result.map((r) => [r.productId, r.requiredPackages])).toEqual([
      ['bacardi-cola', 1],
      ['bierbeker-05', 1],
      ['fuze-tea', 2],
      ['redbull', 1],
    ])
  })

  it('laat diezelfde drank bij een gewone satelliet nog steeds weg', () => {
    const result = behoeften({
      storage: DrinkStorageType.SATELLITE,
      drankProducten: ['fuze-tea'],
      regels: [{ productId: 'fuze-tea', restock: 2 }],
    })

    expect(result).toEqual([])
  })

  it('vult gewoon aan wanneer het opslagtype onbekend is', () => {
    // Veiliger die kant op: een behoefte te veel valt op de vloer op, een
    // behoefte te weinig betekent een lege kiosk.
    const kc = kioskCount('kc-1', 'kiosk-402')
    const result = buildRestockRequirements({
      eventId: 'event-1',
      kioskCounts: [kc],
      entriesByKioskCount: new Map([['kc-1', [entry('kc-1', 'fuze-tea', 1)]]]),
    })

    expect(result).toHaveLength(1)
  })
})
