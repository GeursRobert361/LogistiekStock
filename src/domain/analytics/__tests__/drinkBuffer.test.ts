import { describe, it, expect } from 'vitest'
import { summariseDrinkBuffer } from '../drinkBuffer'
import { DrinkStorageType } from '@/types'

describe('summariseDrinkBuffer', () => {
  it('telt alleen grote koelingen als buffervoorraad', () => {
    const summary = summariseDrinkBuffer([
      {
        kioskId: 'kiosk-401',
        drinkStorageType: DrinkStorageType.LARGE_COOLER,
        drinkStandardQuarters: 400,
      },
      {
        kioskId: 'kiosk-402',
        drinkStorageType: DrinkStorageType.SATELLITE,
        drinkStandardQuarters: 40,
      },
      {
        kioskId: 'kiosk-420-bar',
        drinkStorageType: DrinkStorageType.SMALL_BAR,
        drinkStandardQuarters: 80,
      },
      {
        kioskId: 'kiosk-422',
        drinkStorageType: DrinkStorageType.NONE,
        drinkStandardQuarters: 0,
      },
    ])

    expect(summary.largeCoolerQuarters).toBe(400)
    expect(summary.smallBarQuarters).toBe(80)
    expect(summary.satelliteQuarters).toBe(40)
  })

  it('laat de werkvoorraad van satellieten buiten de buffer', () => {
    // Twaalf satellieten met tien producten van norm 1 zou de buffer met 120
    // verpakkingen ophogen zonder dat er iets extra's staat.
    const satellieten = Array.from({ length: 12 }, (_, i) => ({
      kioskId: `kiosk-sat-${i}`,
      drinkStorageType: DrinkStorageType.SATELLITE,
      drinkStandardQuarters: 40,
    }))

    const summary = summariseDrinkBuffer(satellieten)
    expect(summary.largeCoolerQuarters).toBe(0)
    expect(summary.satelliteKioskCount).toBe(12)
  })

  it('telt kiosken zonder dubbeltelling', () => {
    const summary = summariseDrinkBuffer([
      {
        kioskId: 'kiosk-401',
        drinkStorageType: DrinkStorageType.LARGE_COOLER,
        drinkStandardQuarters: 100,
      },
      {
        kioskId: 'kiosk-401',
        drinkStorageType: DrinkStorageType.LARGE_COOLER,
        drinkStandardQuarters: 100,
      },
    ])

    expect(summary.largeCoolerKioskCount).toBe(1)
    expect(summary.largeCoolerQuarters).toBe(200)
  })
})
