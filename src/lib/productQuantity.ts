import { formatQuantity } from './quarterUnits'
import type { Product } from '@/types'

/**
 * Een aantal verpakkingen met de eenheid erachter: "1 doos", "2 dozen",
 * "0,5 doos", "2,75 trays".
 *
 * Op het scherm staat het aantal groot en de eenheid ernaast, en dan valt niet
 * op dat er "1 dozen" staat. Op papier leest iemand een hele regel achter
 * elkaar, en daar stoort dat wel.
 *
 * De eenheid komt altijd van `packagingUnit`, ook in het enkelvoud. Dat is niet
 * hetzelfde als `countUnit`: bij Bacardi Lime & Lemonade telt de kiosk blikjes
 * maar levert het magazijn trays, en "1 blikje" op een vullijst stuurt iemand
 * met één blikje op pad. Dezelfde val zit bij Witte Wijn (fles/dozen) en
 * Caprisun (pak/dozen). `plannedPackages` telt verpakkingen, dus de
 * verpakkingseenheid is het antwoord — hooguit in het enkelvoud gezet.
 */

/**
 * Het enkelvoud van elke verpakkingseenheid die de catalogus kent.
 *
 * Een gesloten lijst en geen afleidingsregel: het Nederlands kent er te veel
 * uitzonderingen voor om te raden, en fout raden levert een papieren lijst op
 * die niemand vertrouwt. Komt er een eenheid bij, dan valt dat om in de test
 * `elke verpakkingseenheid uit de catalogus heeft een enkelvoud` — in CI dus,
 * en niet op de vloer.
 */
const SINGULAR_PACKAGING_UNITS: Record<string, string> = {
  bakken: 'bak',
  cilinders: 'cilinder',
  doosjes: 'doosje',
  dozen: 'doos',
  emmers: 'emmer',
  flessen: 'fles',
  pakken: 'pak',
  rollen: 'rol',
  trays: 'tray',
  zakken: 'zak',
}

/** Kent deze verpakkingseenheid een enkelvoud? Voor de catalogustest. */
export function hasSingularForm(packagingUnit: string): boolean {
  return packagingUnit.trim().toLowerCase() in SINGULAR_PACKAGING_UNITS
}

/**
 * De eenheid bij dit aantal.
 *
 * Enkelvoud vanaf meer dan niets tot en met één: "0,5 doos" en "0,25 tray"
 * gaan over een deel van één verpakking. Daarboven meervoud, en bij nul ook —
 * "nul dozen".
 */
export function packagingUnitFor(
  product: Pick<Product, 'packagingUnit'>,
  quantity: number
): string {
  const plural = product.packagingUnit
  if (quantity <= 0 || quantity > 1) return plural

  return SINGULAR_PACKAGING_UNITS[plural.trim().toLowerCase()] ?? plural
}

/**
 * "3 dozen", "1 rol", "0,5 doos".
 *
 * Het aantal gaat door `formatQuantity`, dus met een komma en zonder overbodige
 * nullen — Nederlandse notatie, zoals de rest van de app.
 */
export function formatProductQuantity(
  product: Pick<Product, 'packagingUnit'>,
  quantity: number
): string {
  return `${formatQuantity(quantity)} ${packagingUnitFor(product, quantity)}`
}
