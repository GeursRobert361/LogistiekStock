/**
 * Het assortiment en de voorraadnormen, gemodelleerd naar de papieren
 * bestellijsten die nu in gebruik zijn.
 *
 * Twee dingen die uit die lijsten blijken en die het model bepalen:
 *
 *   1. Niet elk telpunt verkoopt hetzelfde. Kiosk 110 heeft wijn en snoep maar
 *      geen koffiehoek; 116, 120 en 126 hebben patat; de cubes tegenover 120
 *      verkopen alleen warme snacks. Een telpunt telt dus alleen wat het
 *      daadwerkelijk voert.
 *   2. Alleen bepaalde kiosken hebben een grote drankkoeling. Zonder koeling
 *      staat er geen gekoelde drank, en hoeft die daar dus ook niet geteld of
 *      gevuld te worden.
 *
 * De aantallen hier zijn richtaantallen, geen echte normen. Ze gelden voor de
 * eerste ring en voor tweede-ringlocaties waarvoor nog geen papieren lijst is
 * aangeleverd.
 *
 * Voor de locaties die zo'n lijst wél hebben is `secondRingStandards` de enige
 * bron; `demoData` gebruikt deze functie daar niet. Zet hier dus nooit "echte"
 * normen neer — dan zijn er weer twee bronnen die uit elkaar gaan lopen, en dan
 * is aan een getal niet meer te zien welke van de twee klopt.
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

/**
 * De cubes: drie hokjes tegenover kiosk 120 met warme snacks. Een eigen
 * telpunt met een eigen, korte lijst — geen drank, geen koffie, geen chips.
 * Het eten zelf loopt via de keuken en staat dus niet op de lijst; wat
 * logistiek aanvult is de verpakking, de saus en de schoonmaak.
 */
export const CUBE_KIOSK_NUMBERS = new Set([1201])

/**
 * Telpunten met een post-mixinstallatie. Alleen daar staan de BIB-pakken en
 * de koolzuurcilinders; de rest schenkt uit blik en fles.
 *
 * Opgegeven door de vloer. Wijzigt dit, dan kan het ook zonder nieuwe seed:
 * in Beheer → Voorraadnormen een norm op 0 zetten haalt het product bij die
 * kiosk weg.
 */
export const KIOSKS_WITH_POSTMIX = new Set([
  // Eerste ring
  101, 103, 106, 110, 112, 116, 118, 120, 122, 126,
  // Tweede ring
  401, 404, 406, 407, 410, 416, 420, 426,
  // De losse bar naast 420
  4201,
])

/** De losse bar naast kiosk 420: tappen en post-mix, verder niets. */
export const BAR_KIOSK_NUMBERS = new Set([4201])

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

  // ── Cubes: een eigen, korte lijst ────────────────────────────────────────
  // Warme snacks en wat erbij hoort. Geen drank, geen koffie, geen chips —
  // dat staat allemaal in de kiosk ertegenover.
  if (CUBE_KIOSK_NUMBERS.has(kioskNumber)) {
    add('rectangular-bakjes', 2)
    add('square-bakjes', 3)
    add('servetten', 3)
    add('patat-vorkjes', 1)

    add('ketchup-flessen', 2)
    add('mosterd-flessen', 1)
    add('mayo-flessen', 2)

    add('tork-rol', 3)
    add('vuilniszakken', 2)
    return items
  }

  // ── Bar: alleen tappen en post-mix ───────────────────────────────────────
  if (BAR_KIOSK_NUMBERS.has(kioskNumber)) {
    add('bierbeker-05', 2)
    add('bierbeker-04', 2)
    add('bierbeker-03', 1)

    add('cola', 2)
    add('cola-zero', 3)
    add('fanta', 1)
    add('sprite', 2)
    add('koolzuur', 2)

    add('servetten', 2)
    add('sixpacks', 1)
    add('tork-rol', 2)
    add('vuilniszakken', 2)
    return items
  }

  // ── Bierbekers — overal, en de grootste stroom van allemaal ──────────────
  add('bierbeker-05', 2)
  add('bierbeker-04', 2)
  add('bierbeker-03', 1)

  // ── Gekoelde drank — alleen met koeling ──────────────────────────────────
  // Hier zitten de echte volumes: water, Fuze Tea en de mixjes lopen op een
  // wedstrijd hard. De rest van de lijst haalt die aantallen bij lange na niet.
  if (KIOSKS_WITH_DRINKS_FRIDGE.has(kioskNumber)) {
    add('chaudfontaine-blauw', vary(14, kioskNumber, 5))
    add('chaudfontaine-rood', vary(6, kioskNumber, 2))
    add('fuze-tea', vary(18, kioskNumber, 4))
    add('heineken-00', vary(9, kioskNumber, 3))
    add('radler', vary(4, kioskNumber, 1))
    add('bacardi-lemon', vary(4, kioskNumber, 1))
    add('stelz-icetea', vary(10, kioskNumber, 3))
    add('jack-daniels', vary(2, kioskNumber, 1))
    add('redbull', vary(3, kioskNumber, 1))
    add('bacardi-cola', vary(9, kioskNumber, 2))
  }

  if (KIOSKS_WITH_SWEETS.has(kioskNumber)) {
    add('witte-wijn', 3)
    add('winegums', 2)
    add('twix', 2)
    add('snickers', 2)
    add('mars', 2)
  }

  // ── Chips — overal ───────────────────────────────────────────────────────
  add('chips-blauw', vary(3, kioskNumber, 1))
  add('chips-rood', vary(3, kioskNumber, 1))
  add('chips-oranje', vary(2, kioskNumber, 1))

  // ── Post-mix — alleen waar een installatie staat ─────────────────────────
  // Eén pak gaat lang mee; er staan er nooit meer dan een paar achter de tap.
  if (KIOSKS_WITH_POSTMIX.has(kioskNumber)) {
    add('cola', vary(2, kioskNumber, 1))
    add('cola-zero', vary(3, kioskNumber, 1))
    add('fanta', 1)
    add('sprite', vary(2, kioskNumber, 1))
    add('koolzuur', vary(2, kioskNumber, 1))
  }

  // ── Koffie en thee ───────────────────────────────────────────────────────
  if (!KIOSKS_WITHOUT_COFFEE.has(kioskNumber)) {
    add('koffie', 1)
    add('cacao-zak', 1)
    add('melk', vary(1, kioskNumber, 1))
    add('suiker', 1)
    add('roerstaafjes', 1)
    add('koffiebekers', vary(3, kioskNumber, 1))
    add('thee-earl-grey', 1)
    add('thee-lemon', 1)
    add('opschuimmelk', 2)
  }

  // ── Verpakkingen ─────────────────────────────────────────────────────────
  add('square-bakjes', vary(2, kioskNumber, 1))
  add('servetten', 3)
  add('sixpacks', 1)
  add('arena-blaadjes', 1)

  if (KIOSKS_WITH_FRIES.has(kioskNumber)) {
    add('rectangular-bakjes', 1)
    add('patat-bakjes', 3)
    add('patat-vorkjes', 1)
    add('mayo-emmers', 2)
    add('ketchup-emmers', 1)
    add('kassa-bonnen', 2)
  } else {
    // Per pak, niet per fles: twee pakken staat er ruim.
    add('mayo-flessen', 2)
    add('ketchup-flessen', 2)
    add('mosterd-flessen', 1)
  }

  // ── Schoonmaak — overal ──────────────────────────────────────────────────
  add('tork-rol', 3)
  add('vuilniszakken', 2)

  return items
}
