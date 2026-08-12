import { DrinkStorageType } from '@/types/enums'

/**
 * Mag het centrale magazijn dit tekort aanvullen?
 *
 * Eén plek voor deze regel, want hij wordt op drie plaatsen gebruikt — bij het
 * genereren van behoeften, in de vulplanning en in de analyse — en drie
 * uitvoeringen van dezelfde regel worden er vroeg of laat twee die van elkaar
 * afwijken.
 *
 * De regel zelf is smal. Een satelliet verkoopt water en Fuze Tea, maar heeft
 * geen koeling: er staat een werkvoorraad van één, en tijdens het evenement
 * wordt bijgehaald uit een grote kiosk in de buurt. Een tekort daar is dus geen
 * magazijnwerk. Alles wat die satelliet verder voert — bekers, chips, post-mix,
 * koffie, verpakkingen, sauzen, schoonmaak — wordt volstrekt normaal aangevuld.
 *
 * Twee dingen die deze regel nadrukkelijk NIET zijn:
 *
 *   1. Geen regel op de norm. `targetQuantity === 1` zou toevallig ook een
 *      grote koeling raken die één pak van iets voert.
 *   2. Geen regel op de categorie. "Drank" is te grof: Caprisun staat bij
 *      Ziggo Platform als gewone voorraad en moet gewoon aangevuld worden.
 *      Daarom een kenmerk op het product zelf.
 */

export interface CentralRestockInput {
  kiosk: { drinkStorageType: DrinkStorageType }
  product: { suppliedFromLargeCoolerForSatellite: boolean }
}

export function shouldGenerateCentralRestock(input: CentralRestockInput): boolean {
  const isSatellite = input.kiosk.drinkStorageType === DrinkStorageType.SATELLITE
  return !(isSatellite && input.product.suppliedFromLargeCoolerForSatellite)
}

/**
 * Telpunten waarvan de drank in een grote drankronde hoort.
 *
 * Een kleine bar mag wél centraal aangevuld worden, maar hoort niet
 * automatisch in dezelfde pallet als de grote koelingen: dat is een andere
 * hoeveelheid en een andere route.
 */
export function isLargeCoolerDrinkStock(kiosk: { drinkStorageType: DrinkStorageType }): boolean {
  return kiosk.drinkStorageType === DrinkStorageType.LARGE_COOLER
}
