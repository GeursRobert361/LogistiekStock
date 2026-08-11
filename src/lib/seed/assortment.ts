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
 * De aantallen zijn richtaantallen in de orde van grootte van de echte lijsten,
 * behalve waar ze geteld zijn: de koeling van de tweede ring staat sinds de
 * telronde van 11 augustus 2026 op echte normen. Zie COUNTED_DRINK_STANDARDS.
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

/**
 * De getelde normen van de tweede ring — telronde 11 augustus 2026.
 *
 * Echte aantallen van de vloer, geen schatting. Negen kiosken, en alleen de
 * koeling: de rest van de lijst (bekers, chips, koffie, verpakkingen) is nog
 * niet geteld en houdt voorlopig de richtaantallen uit assortmentForKiosk.
 *
 * Een product dat hier niet staat valt terug op dat richtaantal. De telronde
 * was niet compleet, dus "nog niet geteld" mag geen "hoort hier niet" worden —
 * een norm op 0 haalt het product bij die kiosk weg, en dat is niet wat een
 * ontbrekende regel betekent. Waar de telling zelf een vraagteken had, staat
 * dat erbij: die aantallen zijn overgenomen maar nog niet bevestigd.
 */
const COUNTED_DRINK_STANDARDS: Record<number, Record<string, number>> = {
  401: {
    'chaudfontaine-blauw': 25,
    'chaudfontaine-rood': 6,
    'fuze-tea': 25,
    'heineken-00': 12,
    radler: 8,
    'stelz-icetea': 30, // geteld als "30 (? buffer)"
    'bacardi-cola': 30, // geteld als "30???"
  },
  403: {
    'chaudfontaine-blauw': 25,
    'chaudfontaine-rood': 6,
    'fuze-tea': 15,
    'heineken-00': 10,
    radler: 8,
    'stelz-icetea': 20,
    'bacardi-cola': 25,
    redbull: 8,
  },
  407: {
    'chaudfontaine-blauw': 20,
    'chaudfontaine-rood': 6,
    'fuze-tea': 21,
    'heineken-00': 7,
    radler: 7,
    'stelz-icetea': 29, // geteld als "29 (? buffer)"
    'bacardi-cola': 15,
    'bacardi-lemon': 12,
    'jack-daniels': 12,
  },
  410: {
    'chaudfontaine-blauw': 25,
    'chaudfontaine-rood': 8,
    'fuze-tea': 21,
    'heineken-00': 10,
    radler: 7,
    'stelz-icetea': 25,
    'bacardi-cola': 30,
    'bacardi-lemon': 10,
    // Stond op de lijst zonder aantal. De buren zitten op 8 tot 10; 10 dus,
    // tot de telling van morgen het echte getal geeft.
    redbull: 10,
  },
  416: {
    'chaudfontaine-blauw': 25,
    'chaudfontaine-rood': 6,
    'fuze-tea': 20,
    'heineken-00': 10,
    radler: 10,
    'stelz-icetea': 24,
    'bacardi-cola': 30, // geteld als "30 (?)"
    'bacardi-lemon': 8,
    'jack-daniels': 6,
  },
  419: {
    'chaudfontaine-blauw': 20,
    'chaudfontaine-rood': 6,
    'fuze-tea': 20,
    'heineken-00': 10,
    radler: 7,
    'stelz-icetea': 15,
    'bacardi-cola': 30,
    'bacardi-lemon': 8,
    redbull: 10,
  },
  420: {
    'chaudfontaine-blauw': 25,
    'chaudfontaine-rood': 8,
    'fuze-tea': 25, // geteld als "25 (?)"
    'heineken-00': 15,
    radler: 10,
    'stelz-icetea': 25,
    'bacardi-cola': 20,
    'bacardi-lemon': 12,
    redbull: 10,
    'jack-daniels': 8,
  },
  423: {
    'chaudfontaine-blauw': 20,
    'chaudfontaine-rood': 6,
    'fuze-tea': 20,
    'heineken-00': 15, // geteld als "15 (?)"
    'stelz-icetea': 15,
    'bacardi-cola': 25,
  },
  426: {
    'chaudfontaine-blauw': 25,
    'chaudfontaine-rood': 6,
    'fuze-tea': 28,
    'heineken-00': 15, // geteld als "15 (?)"
    radler: 10,
    'stelz-icetea': 15,
    'bacardi-cola': 30,
    'bacardi-lemon': 10,
    redbull: 10,
  },
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
    const counted = COUNTED_DRINK_STANDARDS[kioskNumber]
    /** Het getelde aantal als die kiosk geteld is, anders het richtaantal. */
    const drink = (productId: string, estimate: number) =>
      add(productId, counted?.[productId] ?? estimate)

    drink('chaudfontaine-blauw', vary(14, kioskNumber, 5))
    drink('chaudfontaine-rood', vary(6, kioskNumber, 2))
    drink('fuze-tea', vary(18, kioskNumber, 4))
    drink('heineken-00', vary(9, kioskNumber, 3))
    drink('radler', vary(4, kioskNumber, 1))
    drink('bacardi-lemon', vary(4, kioskNumber, 1))
    drink('stelz-icetea', vary(10, kioskNumber, 3))
    drink('jack-daniels', vary(2, kioskNumber, 1))
    drink('redbull', vary(3, kioskNumber, 1))
    drink('bacardi-cola', vary(9, kioskNumber, 2))
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
