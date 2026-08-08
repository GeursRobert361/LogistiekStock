import { describe, it, expect } from 'vitest'
import { calculateKioskMetrics, formatConsumptionRatio } from '../kioskMetrics'
import { buildConsumptionRows, key } from '../consumption'
import { toQuarterUnits } from '@/lib/quarterUnits'

const qu = toQuarterUnits

/** Water weegt zwaar op een pallet, servetten nauwelijks. */
const PALLET_LOAD = new Map([
  ['water', 2],
  ['servetten', 0.1],
])

describe('calculateKioskMetrics', () => {
  it('rekent het verbruik af tegen wat er stond', () => {
    // 10 beschikbaar, 4 over → 6 verbruikt van 10 = 60%.
    const rows = buildConsumptionRows({
      countedBefore: new Map([[key('kiosk-101', 'water'), qu(10)]]),
      delivered: new Map(),
      countedAfter: new Map([[key('kiosk-101', 'water'), qu(4)]]),
    })

    expect(calculateKioskMetrics(rows, PALLET_LOAD)[0]!.averageConsumptionRatio).toBeCloseTo(0.6)
  })

  it('laat elk product even zwaar meetellen in het percentage', () => {
    // Water 50%, servetten 100%. Zou je op aantallen wegen, dan zou het water
    // het servettencijfer wegdrukken — en tel je verpakkingssoorten weer op.
    const rows = buildConsumptionRows({
      countedBefore: new Map([
        [key('kiosk-101', 'water'), qu(40)],
        [key('kiosk-101', 'servetten'), qu(2)],
      ]),
      delivered: new Map(),
      countedAfter: new Map([
        [key('kiosk-101', 'water'), qu(20)],
        [key('kiosk-101', 'servetten'), 0],
      ]),
    })

    expect(calculateKioskMetrics(rows, PALLET_LOAD)[0]!.averageConsumptionRatio).toBeCloseTo(0.75)
  })

  it('weegt de logistieke belasting met de palletbelasting per product', () => {
    // 6 water × 2 + 10 servetten × 0,1 = 13 belasting, oftewel 13/80 pallet.
    const rows = buildConsumptionRows({
      countedBefore: new Map([
        [key('kiosk-101', 'water'), qu(10)],
        [key('kiosk-101', 'servetten'), qu(10)],
      ]),
      delivered: new Map(),
      countedAfter: new Map([
        [key('kiosk-101', 'water'), qu(4)],
        [key('kiosk-101', 'servetten'), 0],
      ]),
    })

    expect(calculateKioskMetrics(rows, PALLET_LOAD)[0]!.estimatedPalletLoad).toBeCloseTo(13 / 80)
  })

  it('rekent alleen met wat betrouwbaar gemeten is', () => {
    const rows = buildConsumptionRows({
      countedBefore: new Map([
        [key('kiosk-101', 'water'), qu(10)],
        [key('kiosk-101', 'servetten'), qu(10)],
      ]),
      delivered: new Map(),
      // Servetten zijn niet opnieuw geteld.
      countedAfter: new Map([[key('kiosk-101', 'water'), qu(5)]]),
    })

    const metrics = calculateKioskMetrics(rows, PALLET_LOAD)[0]!
    expect(metrics.measuredProductCount).toBe(1)
    expect(metrics.unknownProductCount).toBe(1)
    expect(metrics.averageConsumptionRatio).toBeCloseTo(0.5)
    expect(metrics.estimatedPalletLoad).toBeCloseTo(10 / 80) // alleen het water
  })

  it('telt een voorraadverschil niet mee', () => {
    const rows = buildConsumptionRows({
      countedBefore: new Map([[key('kiosk-101', 'water'), qu(2)]]),
      delivered: new Map(),
      countedAfter: new Map([[key('kiosk-101', 'water'), qu(9)]]),
    })

    const metrics = calculateKioskMetrics(rows, PALLET_LOAD)[0]!
    expect(metrics.averageConsumptionRatio).toBeNull()
    expect(metrics.estimatedPalletLoad).toBe(0)
    expect(metrics.unknownProductCount).toBe(1)
  })

  it('geeft geen percentage als er niets stond en niets bij kwam', () => {
    const rows = buildConsumptionRows({
      countedBefore: new Map([[key('kiosk-101', 'water'), 0]]),
      delivered: new Map(),
      countedAfter: new Map([[key('kiosk-101', 'water'), 0]]),
    })

    expect(calculateKioskMetrics(rows, PALLET_LOAD)[0]!.averageConsumptionRatio).toBeNull()
  })

  it('gebruikt geen palletbelasting voor een product zonder schatting', () => {
    const rows = buildConsumptionRows({
      countedBefore: new Map([[key('kiosk-101', 'onbekend'), qu(10)]]),
      delivered: new Map(),
      countedAfter: new Map([[key('kiosk-101', 'onbekend'), qu(2)]]),
    })

    expect(calculateKioskMetrics(rows, PALLET_LOAD)[0]!.estimatedPalletLoad).toBe(0)
  })
})

describe('formatConsumptionRatio', () => {
  it('toont hele procenten', () => {
    expect(formatConsumptionRatio(0.7412)).toBe('74%')
  })

  it('toont een streepje zonder cijfer', () => {
    expect(formatConsumptionRatio(null)).toBe('—')
  })
})
