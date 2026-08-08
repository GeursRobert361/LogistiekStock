import { fromQuarterUnits } from '@/lib/quarterUnits'
import { toPalletEquivalents } from '@/domain/restocking/planRestock'
import { isReliable, type ConsumptionRow } from './consumption'

/**
 * Vergelijkbare cijfers per kiosk.
 *
 * Het oude kioskgetal was de som van alle verbruikte kwarteenheden. Daar zaten
 * water, servetten, bekers en saus in één getal — appels en peren met een
 * eenheid die niets voorstelt. Een kiosk die veel servetten doorheen jaagt
 * scoorde daardoor hoger dan een kiosk die twee pallets water leegtrok.
 *
 * Twee getallen die wél iets betekenen:
 *
 *   1. Hoe leeg de kiosk raakte ten opzichte van wat erin stond. Dat is een
 *      verhouding, dus eenheidsloos en over producten heen op te tellen.
 *   2. Hoeveel er fysiek naartoe moest. Dat is een schatting in
 *      pallet-equivalenten en zegt iets over de logistieke belasting.
 */

export interface KioskMetrics {
  kioskId: string
  /**
   * Gemiddeld deel van de aanwezige voorraad dat erdoorheen ging, 0–1.
   *
   * Het gemiddelde van de verhoudingen per product, niet de verhouding van de
   * totalen: dat laatste zou de aantallen van verschillende verpakkingssoorten
   * weer bij elkaar optellen. Elk product telt hier dus even zwaar.
   *
   * `null` wanneer er niets betrouwbaar te meten viel.
   */
  averageConsumptionRatio: number | null
  /**
   * Geschatte logistieke belasting in pallet-equivalenten.
   *
   * `estimatedPalletLoad` is een schatting per verpakking; het totaal is dat
   * dus ook. Bedoeld om kiosken met elkaar te vergelijken, niet om een
   * vrachtbrief mee te vullen.
   */
  estimatedPalletLoad: number
  /** Producten waar een hard verbruikscijfer uit kwam. */
  measuredProductCount: number
  /** Producten waarvan het verbruik niet vast te stellen was. */
  unknownProductCount: number
}

export function calculateKioskMetrics(
  rows: ConsumptionRow[],
  palletLoadByProduct: Map<string, number>
): KioskMetrics[] {
  return rows.map((row) => {
    const measured = row.products.filter(isReliable)

    const ratios: number[] = []
    let totalLoad = 0

    for (const product of measured) {
      const consumedQuarters = product.consumedQuarters ?? 0

      // Een kiosk waar niets stond en niets bij kwam zegt niets over verbruik.
      if (product.availableQuarters > 0) {
        ratios.push(consumedQuarters / product.availableQuarters)
      }

      totalLoad +=
        (palletLoadByProduct.get(product.productId) ?? 0) * fromQuarterUnits(consumedQuarters)
    }

    return {
      kioskId: row.kioskId,
      averageConsumptionRatio:
        ratios.length > 0 ? ratios.reduce((sum, ratio) => sum + ratio, 0) / ratios.length : null,
      estimatedPalletLoad: toPalletEquivalents(totalLoad),
      measuredProductCount: measured.length,
      unknownProductCount: row.products.length - measured.length,
    }
  })
}

/** Aflopend op logistieke belasting: waar het meeste werk zat. */
export function byLogisticLoad(a: KioskMetrics, b: KioskMetrics): number {
  return b.estimatedPalletLoad - a.estimatedPalletLoad
}

/** Aflopend op verbruikspercentage; kiosken zonder cijfer achteraan. */
export function byConsumptionRatio(a: KioskMetrics, b: KioskMetrics): number {
  return (b.averageConsumptionRatio ?? -1) - (a.averageConsumptionRatio ?? -1)
}

export function formatConsumptionRatio(ratio: number | null): string {
  if (ratio === null) return '—'
  return `${Math.round(ratio * 100)}%`
}
