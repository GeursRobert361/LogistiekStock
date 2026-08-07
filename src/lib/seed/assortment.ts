/**
 * Het assortiment en de voorraadnormen, gemodelleerd naar de papieren
 * bestellijsten die nu in gebruik zijn.
 *
 * Twee dingen die uit die lijsten blijken en die het model bepalen:
 *
 *   1. Niet elke kiosk verkoopt hetzelfde. Kiosk 110 heeft wijn en snoep maar
 *      geen koffiehoek, 120 heeft een hotdogkar, 116 en 120 hebben patat.
 *      Een kiosk telt dus alleen wat hij daadwerkelijk voert.
 *   2. Alleen bepaalde kiosken hebben een grote drankkoeling. Zonder koeling
 *      staat er geen gekoelde drank, en hoeft die daar dus ook niet geteld of
 *      gevuld te worden.
 *
 * De aantallen zijn fictief maar in de orde van grootte van de echte lijsten.
 */

/** Kiosken met een grote drankkoeling. Opgegeven door de vloer. */
export const KIOSKS_WITH_DRINKS_FRIDGE = new Set([
  // Eerste ring
  110, 112, 116, 118, 120, 122, 126, 128,
  // Tweede ring
  401, 403, 407, 410, 416, 419, 420, 423, 426,
])

/** Kiosken met een patatpunt: extra bakjes, vorkjes en sauzen in emmers. */
export const KIOSKS_WITH_FRIES = new Set([116, 120, 126, 407, 419])

/** Kiosken met een hotdogkar ernaast. */
export const KIOSKS_WITH_HOTDOG = new Set([120, 419])

/** Kiosken die ook snoep en wijn voeren. */
export const KIOSKS_WITH_SWEETS = new Set([110, 401])

/** Kiosken zonder koffiehoek. */
export const KIOSKS_WITHOUT_COFFEE = new Set([110, 401])

export interface AssortmentItem {
  productId: string
  /** Norm in hele verpakkingen. */
  target: number
}

/**
 * Iets van variatie tussen kiosken, maar reproduceerbaar: dezelfde kiosk
 * krijgt altijd dezelfde norm. Anders is een testtelling elke keer anders.
 */
function vary(base: number, kioskNumber: number, spread = 0): number {
  if (spread === 0) return base
  const offset = (kioskNumber % (spread * 2 + 1)) - spread
  return Math.max(1, base + offset)
}

/** De norm voor één kiosk: welke producten, en hoeveel ervan. */
export function assortmentForKiosk(kioskNumber: number): AssortmentItem[] {
  const items: AssortmentItem[] = []
  const add = (productId: string, target: number) => {
    if (target > 0) items.push({ productId, target })
  }

  // ── Bierbekers — overal, en de grootste stroom van allemaal ──────────────
  add('bierbeker-05', 2)
  add('bierbeker-04', 2)
  add('bierbeker-03', 1)

  // ── Gekoelde drank — alleen met koeling ──────────────────────────────────
  if (KIOSKS_WITH_DRINKS_FRIDGE.has(kioskNumber)) {
    add('chaudfontaine-blauw', vary(14, kioskNumber, 5))
    add('chaudfontaine-rood', vary(7, kioskNumber, 2))
    add('fuze-tea', vary(20, kioskNumber, 4))
    add('heineken-00', vary(9, kioskNumber, 3))
    add('radler', vary(7, kioskNumber, 2))
    add('bacardi-lemon', vary(8, kioskNumber, 2))
    add('stelz-icetea', vary(10, kioskNumber, 3))
    add('jack-daniels', vary(5, kioskNumber, 1))
    add('redbull', vary(6, kioskNumber, 2))
    add('bacardi-cola', vary(9, kioskNumber, 2))
  }

  if (KIOSKS_WITH_SWEETS.has(kioskNumber)) {
    add('witte-wijn', 6)
    add('winegums', 4)
    add('twix', 3)
    add('snickers', 3)
    add('mars', 3)
  }

  // ── Chips — overal ───────────────────────────────────────────────────────
  add('chips-blauw', vary(6, kioskNumber, 1))
  add('chips-rood', vary(6, kioskNumber, 1))
  add('chips-oranje', vary(5, kioskNumber, 1))

  // ── Post-mix — overal, kleine aantallen ──────────────────────────────────
  add('cola', vary(3, kioskNumber, 2))
  add('cola-zero', vary(5, kioskNumber, 3))
  add('fanta', 3)
  add('sprite', vary(3, kioskNumber, 1))
  add('koolzuur', vary(3, kioskNumber, 1))

  // ── Koffie en thee ───────────────────────────────────────────────────────
  if (!KIOSKS_WITHOUT_COFFEE.has(kioskNumber)) {
    add('koffie', 1)
    add('cacao-zak', vary(1, kioskNumber, 1))
    add('melk', vary(1, kioskNumber, 1))
    add('suiker', vary(1, kioskNumber, 1))
    add('roerstaafjes', 2)
    add('koffiebekers', 10)
    add('thee-earl-grey', 2)
    add('thee-lemon', 2)
    add('opschuimmelk', 4)
  }

  // ── Verpakkingen ─────────────────────────────────────────────────────────
  add('square-bakjes', vary(3, kioskNumber, 1))
  add('servetten', 8)
  add('sixpacks', vary(1, kioskNumber, 1))
  add('arena-blaadjes', 1)

  if (KIOSKS_WITH_FRIES.has(kioskNumber)) {
    add('rectangular-bakjes', 1)
    add('patat-bakjes', 4)
    add('patat-vorkjes', 1)
    add('mayo-emmers', 8)
    add('ketchup-emmers', 3)
    add('kassa-bonnen', 6)
  } else {
    add('mayo-flessen', 15)
    add('ketchup-flessen', 15)
    add('mosterd-flessen', 15)
  }

  if (KIOSKS_WITH_HOTDOG.has(kioskNumber)) {
    add('hotdog-broodjes', 15)
    add('hotdog-worsten', 15)
  }

  // ── Schoonmaak — overal ──────────────────────────────────────────────────
  add('tork-rol', 6)
  add('vuilniszakken', 4)

  return items
}
