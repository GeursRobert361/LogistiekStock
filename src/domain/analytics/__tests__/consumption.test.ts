import { describe, it, expect } from 'vitest'
import { calculateConsumption, buildConsumptionRows, totalsByProduct, key } from '../consumption'
import { toQuarterUnits, fromQuarterUnits } from '@/lib/quarterUnits'

const qu = toQuarterUnits

describe('calculateConsumption', () => {
  it('trekt de volgende telling af van wat er stond plus wat erbij kwam', () => {
    // 4 stonden er, 11 bijgevuld, 3 over → 12 verbruikt.
    const result = calculateConsumption({
      countedBeforeQuarters: qu(4),
      deliveredPackages: 11,
      countedAfterQuarters: qu(3),
    })

    expect(fromQuarterUnits(result.consumedQuarters!)).toBe(12)
    expect(fromQuarterUnits(result.availableQuarters)).toBe(15)
    expect(result.isImplausible).toBe(false)
  })

  it('rekent met kwarten, niet met hele verpakkingen', () => {
    const result = calculateConsumption({
      countedBeforeQuarters: qu(4.5),
      deliveredPackages: 10,
      countedAfterQuarters: qu(2.25),
    })

    expect(fromQuarterUnits(result.consumedQuarters!)).toBe(12.25)
  })

  it('geeft niets terug zolang er nog niet opnieuw geteld is', () => {
    const result = calculateConsumption({
      countedBeforeQuarters: qu(4),
      deliveredPackages: 11,
      countedAfterQuarters: null,
    })

    expect(result.consumedQuarters).toBeNull()
    expect(fromQuarterUnits(result.availableQuarters)).toBe(15)
  })

  it('meldt het wanneer er meer overblijft dan er ooit stond', () => {
    // Buiten de app om bijgevuld, of een telling klopt niet. Wegpoetsen zou
    // dat verbergen.
    const result = calculateConsumption({
      countedBeforeQuarters: qu(2),
      deliveredPackages: 3,
      countedAfterQuarters: qu(9),
    })

    expect(fromQuarterUnits(result.consumedQuarters!)).toBe(-4)
    expect(result.isImplausible).toBe(true)
  })

  it('telt een kiosk die alleen gevuld is gewoon mee', () => {
    const result = calculateConsumption({
      countedBeforeQuarters: 0,
      deliveredPackages: 6,
      countedAfterQuarters: qu(1),
    })

    expect(fromQuarterUnits(result.consumedQuarters!)).toBe(5)
  })
})

describe('buildConsumptionRows', () => {
  it('groepeert per kiosk en telt het verbruik op', () => {
    const rows = buildConsumptionRows({
      countedBefore: new Map([
        [key('kiosk-101', 'water'), qu(4)],
        [key('kiosk-101', 'cola'), qu(2)],
        [key('kiosk-102', 'water'), qu(1)],
      ]),
      delivered: new Map([
        [key('kiosk-101', 'water'), 11],
        [key('kiosk-102', 'water'), 5],
      ]),
      countedAfter: new Map([
        [key('kiosk-101', 'water'), qu(3)],
        [key('kiosk-101', 'cola'), qu(1)],
        [key('kiosk-102', 'water'), qu(2)],
      ]),
    })

    const first = rows.find((row) => row.kioskId === 'kiosk-101')!
    expect(first.products).toHaveLength(2)
    expect(fromQuarterUnits(first.totalConsumedQuarters)).toBe(13) // 12 water + 1 cola

    const second = rows.find((row) => row.kioskId === 'kiosk-102')!
    expect(fromQuarterUnits(second.totalConsumedQuarters)).toBe(4)
  })

  it('neemt een product mee dat alleen in de levering voorkomt', () => {
    const rows = buildConsumptionRows({
      countedBefore: new Map(),
      delivered: new Map([[key('kiosk-101', 'servetten'), 3]]),
      countedAfter: new Map([[key('kiosk-101', 'servetten'), qu(1)]]),
    })

    expect(rows[0]!.products[0]).toMatchObject({ productId: 'servetten', deliveredPackages: 3 })
    expect(fromQuarterUnits(rows[0]!.totalConsumedQuarters)).toBe(2)
  })

  it('laat het verbruik leeg zolang de volgende telling ontbreekt', () => {
    const rows = buildConsumptionRows({
      countedBefore: new Map([[key('kiosk-101', 'water'), qu(4)]]),
      delivered: new Map([[key('kiosk-101', 'water'), 11]]),
      countedAfter: null,
    })

    expect(rows[0]!.products[0]!.consumedQuarters).toBeNull()
    expect(rows[0]!.totalConsumedQuarters).toBe(0)
  })

  it('behandelt een ontbrekende volgende telling als onbekend, niet als nul', () => {
    // Het product stond er wel, maar is bij de volgende telling niet ingevuld.
    // Dat als "alles op" lezen verzint verbruik dat niemand gemeten heeft.
    const rows = buildConsumptionRows({
      countedBefore: new Map([[key('kiosk-101', 'water'), qu(4)]]),
      delivered: new Map(),
      countedAfter: new Map([[key('kiosk-101', 'cola'), qu(1)]]),
    })

    const water = rows[0]!.products.find((p) => p.productId === 'water')!
    expect(water.consumedQuarters).toBeNull()
    expect(water.confidence).toBe('NEXT_COUNT_MISSING')
  })

  it('leest een getelde nul wél als leeg', () => {
    // Nul is een gemeten waarde: de teller heeft gekeken en er stond niets.
    const rows = buildConsumptionRows({
      countedBefore: new Map([[key('kiosk-101', 'water'), qu(4)]]),
      delivered: new Map(),
      countedAfter: new Map([[key('kiosk-101', 'water'), 0]]),
    })

    expect(fromQuarterUnits(rows[0]!.products[0]!.consumedQuarters!)).toBe(4)
    expect(rows[0]!.products[0]!.confidence).toBe('KNOWN')
  })
})

describe('betrouwbaarheid van een regel', () => {
  const before = new Map([[key('kiosk-101', 'water'), qu(4)]])

  it('noemt een overgeslagen of dichte kiosk onbekend', () => {
    const rows = buildConsumptionRows({
      countedBefore: before,
      delivered: new Map(),
      countedAfter: new Map([[key('kiosk-102', 'water'), qu(1)]]),
      countedKioskIdsAfter: new Set(['kiosk-102']),
    })

    const row = rows.find((r) => r.kioskId === 'kiosk-101')!
    expect(row.products[0]!.confidence).toBe('KIOSK_SKIPPED')
    expect(row.products[0]!.consumedQuarters).toBeNull()
  })

  it('noemt een product zonder actieve norm een assortimentswijziging', () => {
    const rows = buildConsumptionRows({
      countedBefore: before,
      delivered: new Map(),
      countedAfter: new Map([[key('kiosk-101', 'cola'), qu(1)]]),
      countedKioskIdsAfter: new Set(['kiosk-101']),
      activeStandardsAfter: new Set([key('kiosk-101', 'cola')]),
    })

    const water = rows[0]!.products.find((p) => p.productId === 'water')!
    expect(water.confidence).toBe('ASSORTMENT_CHANGED')
  })

  it('noemt een geteld product dat gewoon niet ingevuld is onbekend', () => {
    const rows = buildConsumptionRows({
      countedBefore: before,
      delivered: new Map(),
      countedAfter: new Map([[key('kiosk-101', 'cola'), qu(1)]]),
      countedKioskIdsAfter: new Set(['kiosk-101']),
      activeStandardsAfter: new Set([key('kiosk-101', 'water'), key('kiosk-101', 'cola')]),
    })

    const water = rows[0]!.products.find((p) => p.productId === 'water')!
    expect(water.confidence).toBe('NEXT_COUNT_MISSING')
  })

  it('markeert een negatief verbruik als voorraadverschil', () => {
    const rows = buildConsumptionRows({
      countedBefore: new Map([[key('kiosk-101', 'water'), qu(2)]]),
      delivered: new Map([[key('kiosk-101', 'water'), 3]]),
      countedAfter: new Map([[key('kiosk-101', 'water'), qu(9)]]),
    })

    expect(rows[0]!.products[0]!.confidence).toBe('IMPLAUSIBLE')
    expect(rows[0]!.implausibleCount).toBe(1)
    // Telt niet mee in het kiosk-totaal, maar verdwijnt ook niet.
    expect(rows[0]!.totalConsumedQuarters).toBe(0)
  })

  it('houdt bij hoeveel regels bruikbaar zijn', () => {
    const rows = buildConsumptionRows({
      countedBefore: new Map([
        [key('kiosk-101', 'water'), qu(4)],
        [key('kiosk-101', 'cola'), qu(2)],
        [key('kiosk-101', 'chips'), qu(1)],
      ]),
      delivered: new Map(),
      countedAfter: new Map([[key('kiosk-101', 'water'), qu(1)]]),
      countedKioskIdsAfter: new Set(['kiosk-101']),
    })

    expect(rows[0]!.knownCount).toBe(1)
    expect(rows[0]!.unknownCount).toBe(2)
  })

  it('laat een onbekende regel niet meetellen in het producttotaal', () => {
    const rows = buildConsumptionRows({
      countedBefore: new Map([
        [key('kiosk-101', 'water'), qu(4)],
        [key('kiosk-102', 'water'), qu(6)],
      ]),
      delivered: new Map(),
      countedAfter: new Map([[key('kiosk-101', 'water'), qu(1)]]),
      countedKioskIdsAfter: new Set(['kiosk-101']),
    })

    const water = totalsByProduct(rows)[0]!
    expect(fromQuarterUnits(water.consumedQuarters)).toBe(3)
    expect(water.perKiosk).toHaveLength(1)
  })
})

describe('totalsByProduct', () => {
  const rows = buildConsumptionRows({
    countedBefore: new Map([
      [key('kiosk-101', 'water'), qu(4)],
      [key('kiosk-102', 'water'), qu(1)],
      [key('kiosk-101', 'cola'), qu(2)],
    ]),
    delivered: new Map([
      [key('kiosk-101', 'water'), 11],
      [key('kiosk-102', 'water'), 5],
    ]),
    countedAfter: new Map([
      [key('kiosk-101', 'water'), qu(3)],
      [key('kiosk-102', 'water'), qu(2)],
      [key('kiosk-101', 'cola'), qu(1)],
    ]),
  })

  it('telt een product op over alle kiosken', () => {
    const water = totalsByProduct(rows).find((total) => total.productId === 'water')!

    expect(fromQuarterUnits(water.consumedQuarters)).toBe(16) // 12 + 4
    expect(water.perKiosk).toHaveLength(2)
  })

  it('zet het drukste product vooraan, en binnen een product de drukste kiosk', () => {
    const totals = totalsByProduct(rows)

    expect(totals.map((total) => total.productId)).toEqual(['water', 'cola'])
    expect(totals[0]!.perKiosk[0]!.kioskId).toBe('kiosk-101')
  })

  it('laat een product zonder verbruik weg', () => {
    const empty = buildConsumptionRows({
      countedBefore: new Map([[key('kiosk-101', 'water'), qu(4)]]),
      delivered: new Map(),
      countedAfter: new Map([[key('kiosk-101', 'water'), qu(4)]]),
    })

    expect(totalsByProduct(empty)).toEqual([])
  })

  it('trekt een onmogelijk negatief getal niet van het totaal af', () => {
    const odd = buildConsumptionRows({
      countedBefore: new Map([
        [key('kiosk-101', 'water'), qu(10)],
        [key('kiosk-102', 'water'), qu(1)],
      ]),
      delivered: new Map(),
      countedAfter: new Map([
        [key('kiosk-101', 'water'), qu(2)],
        [key('kiosk-102', 'water'), qu(6)], // meer dan er stond
      ]),
    })

    expect(fromQuarterUnits(totalsByProduct(odd)[0]!.consumedQuarters)).toBe(8)
  })
})
