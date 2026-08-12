import { DrinkStorageType } from '@/types/enums'

/**
 * Hoeveel drank er als buffer in het stadion staat.
 *
 * Alleen de grote koelingen tellen mee. Een satelliet heeft overal een norm
 * van 1 staan — dat is een assortimentsindicatie, geen voorraad, en optellen
 * zou de buffer met tientallen ophogen zonder dat er iets extra's staat. Een
 * kleine bar heeft wél echte voorraad, maar in een orde van grootte die niets
 * met een koeling te maken heeft; die staat daarom apart.
 *
 * Let op: dit gaat uitsluitend over drank. Voor alle andere producten telt een
 * satelliet volstrekt normaal mee in analyses — hij is een gewone kiosk die
 * toevallig zijn drank ergens anders vandaan haalt.
 */

export interface DrinkBufferInput {
  kioskId: string
  drinkStorageType: DrinkStorageType
  /** Norm in kwarteenheden, alleen voor producten die als drank gelden. */
  drinkStandardQuarters: number
}

export interface DrinkBufferSummary {
  /** Buffervoorraad in kwarteenheden, alleen uit grote koelingen. */
  largeCoolerQuarters: number
  /** Idem voor de kleine bars, apart gehouden. */
  smallBarQuarters: number
  /**
   * Wat er bij satellieten aan werkvoorraad staat. Bewust niet opgeteld bij de
   * buffer, maar ook niet weggegooid: het is nuttig om te zien hoeveel
   * telpunten drank voeren zonder er voorraad van te hebben.
   */
  satelliteQuarters: number
  largeCoolerKioskCount: number
  satelliteKioskCount: number
}

export function summariseDrinkBuffer(inputs: DrinkBufferInput[]): DrinkBufferSummary {
  const summary: DrinkBufferSummary = {
    largeCoolerQuarters: 0,
    smallBarQuarters: 0,
    satelliteQuarters: 0,
    largeCoolerKioskCount: 0,
    satelliteKioskCount: 0,
  }

  const largeCoolerKiosks = new Set<string>()
  const satelliteKiosks = new Set<string>()

  for (const input of inputs) {
    switch (input.drinkStorageType) {
      case DrinkStorageType.LARGE_COOLER:
        summary.largeCoolerQuarters += input.drinkStandardQuarters
        largeCoolerKiosks.add(input.kioskId)
        break
      case DrinkStorageType.SMALL_BAR:
        summary.smallBarQuarters += input.drinkStandardQuarters
        break
      case DrinkStorageType.SATELLITE:
        summary.satelliteQuarters += input.drinkStandardQuarters
        satelliteKiosks.add(input.kioskId)
        break
      case DrinkStorageType.NONE:
        break
    }
  }

  summary.largeCoolerKioskCount = largeCoolerKiosks.size
  summary.satelliteKioskCount = satelliteKiosks.size
  return summary
}
