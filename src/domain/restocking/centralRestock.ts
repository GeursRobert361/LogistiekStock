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
 *
 * ── De uitzondering op de uitzondering ──────────────────────────────────────
 *
 * `keepsOwnDrinkStock` gaat vóór alles. Het opslagtype is een vuistregel over
 * hoe een telpunt er meestal uitziet; een aangeleverde stocklijst is een
 * waarneming van hoe dít telpunt er werkelijk uitziet. Ziggo Platform is een
 * satelliet met een eigen lijst met echte dranknormen, en die drank komt uit
 * het magazijn.
 *
 * Zonder deze regel wordt zulke voorraad wél geteld en nooit aangevuld: de
 * teller ziet een tekort, de vulplanning ziet niets, en dat verschil valt pas
 * op als het platform droogstaat. Dat is de reden dat de uitzondering hier
 * staat en niet als filter ergens verderop.
 */

export interface CentralRestockInput {
  kiosk: {
    drinkStorageType: DrinkStorageType
    /** Zie `LOCAL_DRINK_STOCK_KIOSK_KEYS`; standaard onwaar. */
    keepsOwnDrinkStock?: boolean
  }
  product: { suppliedFromLargeCoolerForSatellite: boolean }
}

export function shouldGenerateCentralRestock(input: CentralRestockInput): boolean {
  if (input.kiosk.keepsOwnDrinkStock === true) return true

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
