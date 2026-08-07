import type { Product, ProductCategory } from '@/types'
import { InputStep, ProductSize, RoundType } from '@/types'

/**
 * De productcatalogus, overgenomen van de papieren bestellijsten die nu in
 * gebruik zijn: dezelfde namen, dezelfde volgorde, dezelfde eenheden.
 *
 * De volgorde is niet cosmetisch. Een teller loopt de kiosk af in deze
 * volgorde; hem anders zetten kost tijd bij elke kiosk opnieuw.
 */

// ─── Categorieën ──────────────────────────────────────────────────────────

export const CAT_BIERBEKERS_ID = 'cat-bierbekers'
export const CAT_DRANK_ID = 'cat-drank'
export const CAT_CHIPS_ID = 'cat-chips'
export const CAT_POSTMIX_ID = 'cat-postmix'
export const CAT_SNOEP_ID = 'cat-snoep'
export const CAT_KOFFIE_ID = 'cat-koffie'
export const CAT_VERPAKKINGEN_ID = 'cat-verpakkingen'
export const CAT_SAUZEN_ID = 'cat-sauzen'
export const CAT_SCHOONMAAK_ID = 'cat-schoonmaak'

export const demoCategories: ProductCategory[] = [
  { id: CAT_BIERBEKERS_ID, name: 'Bierbekers', sortOrder: 1, isActive: true },
  { id: CAT_DRANK_ID, name: 'Drank', sortOrder: 2, isActive: true },
  { id: CAT_CHIPS_ID, name: 'Chips', sortOrder: 3, isActive: true },
  { id: CAT_POSTMIX_ID, name: 'Post-mix', sortOrder: 4, isActive: true },
  { id: CAT_SNOEP_ID, name: 'Snoep', sortOrder: 5, isActive: true },
  { id: CAT_KOFFIE_ID, name: 'Koffie en thee', sortOrder: 6, isActive: true },
  { id: CAT_VERPAKKINGEN_ID, name: 'Verpakkingen', sortOrder: 7, isActive: true },
  { id: CAT_SAUZEN_ID, name: 'Sauzen', sortOrder: 8, isActive: true },
  { id: CAT_SCHOONMAAK_ID, name: 'Schoonmaak', sortOrder: 9, isActive: true },
]

// ─── Producten ────────────────────────────────────────────────────────────

function product(
  id: string,
  categoryId: string,
  name: string,
  shortName: string,
  countUnit: string,
  packagingUnit: string,
  sortOrder: number,
  overrides: Partial<Product> = {}
): Product {
  return {
    id,
    categoryId,
    name,
    shortName,
    countUnit,
    packagingUnit,
    sortOrder,
    isActive: true,
    inputStep: InputStep.ONE,
    allowPartialPackage: false,
    roundType: RoundType.AUTO,
    productSize: ProductSize.MEDIUM,
    estimatedPalletLoad: 1,
    ownRoundThreshold: 20,
    priority: 0,
    refrigerated: false,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

/** Grote stroom; halve pakken komen voor, dus eigen ronde en halve stappen. */
const BULK: Partial<Product> = {
  productSize: ProductSize.LARGE,
  roundType: RoundType.PRODUCT_ROUND,
  inputStep: InputStep.HALF,
  allowPartialPackage: true,
  estimatedPalletLoad: 2,
  priority: 10,
}

/** Klein spul dat op een gemengde pallet meegaat. */
const SMALL: Partial<Product> = {
  productSize: ProductSize.SMALL,
  roundType: RoundType.MIXED_PALLET,
  estimatedPalletLoad: 0.3,
}

/** Half te tellen, maar niet groot genoeg voor een eigen ronde. */
const HALF_STEP: Partial<Product> = {
  inputStep: InputStep.HALF,
  allowPartialPackage: true,
}

export const demoProducts: Product[] = [
  // ── Bierbekers ─────────────────────────────────────────────────────────
  product('bierbeker-05', CAT_BIERBEKERS_ID, 'Bierbekers 0,5', 'Beker 0,5', 'rol', 'rollen', 1, BULK),
  product('bierbeker-04', CAT_BIERBEKERS_ID, 'Bierbekers 0,4', 'Beker 0,4', 'rol', 'rollen', 2, BULK),
  product('bierbeker-03', CAT_BIERBEKERS_ID, 'Bierbekers 0,3', 'Beker 0,3', 'rol', 'rollen', 3, {
    ...BULK,
    roundType: RoundType.AUTO,
  }),

  // ── Drank; staat alleen in kiosken met een koeling ──────────────────────
  product('chaudfontaine-blauw', CAT_DRANK_ID, 'Chaudfontaine Blauw', 'Chaud. Blauw', 'pak', 'pakken', 10, { ...BULK, refrigerated: true }),
  product('chaudfontaine-rood', CAT_DRANK_ID, 'Chaudfontaine Rood', 'Chaud. Rood', 'pak', 'pakken', 11, { ...BULK, refrigerated: true }),
  product('fuze-tea', CAT_DRANK_ID, 'Fuze Tea', 'Fuze Tea', 'pak', 'pakken', 12, { ...BULK, refrigerated: true }),
  product('heineken-00', CAT_DRANK_ID, 'Heineken 0.0%', 'Heineken 0.0', 'pak', 'pakken', 13, {
    ...HALF_STEP,
    refrigerated: true,
    priority: 6,
  }),
  product('radler', CAT_DRANK_ID, 'Radler 2.0%', 'Radler', 'pak', 'pakken', 14, {
    ...HALF_STEP,
    refrigerated: true,
    priority: 6,
  }),
  product('bacardi-lemon', CAT_DRANK_ID, 'Bacardi Lemon', 'Bac. Lemon', 'blikje', 'trays', 15, {
    ...HALF_STEP,
    refrigerated: true,
  }),
  product('stelz-icetea', CAT_DRANK_ID, 'Stelz Icetea', 'Stelz', 'blikje', 'trays', 16, {
    ...HALF_STEP,
    refrigerated: true,
    priority: 5,
  }),
  product('jack-daniels', CAT_DRANK_ID, 'Jack Daniels', 'Jack D.', 'blikje', 'trays', 17, {
    ...SMALL,
    refrigerated: true,
  }),
  product('redbull', CAT_DRANK_ID, 'Redbull', 'Redbull', 'blikje', 'trays', 18, {
    ...SMALL,
    refrigerated: true,
  }),
  product('bacardi-cola', CAT_DRANK_ID, 'Bacardi Cola', 'Bac. Cola', 'blikje', 'trays', 19, {
    ...HALF_STEP,
    refrigerated: true,
  }),
  product('witte-wijn', CAT_DRANK_ID, 'Witte Wijn', 'Witte Wijn', 'fles', 'dozen', 20, {
    ...SMALL,
    refrigerated: true,
  }),

  // ── Chips ──────────────────────────────────────────────────────────────
  product('chips-blauw', CAT_CHIPS_ID, 'Chips Blauw', 'Chips Blauw', 'zak', 'dozen', 30, SMALL),
  product('chips-rood', CAT_CHIPS_ID, 'Chips Rood', 'Chips Rood', 'zak', 'dozen', 31, SMALL),
  product('chips-oranje', CAT_CHIPS_ID, 'Chips Oranje', 'Chips Oranje', 'zak', 'dozen', 32, SMALL),

  // ── Post-mix ───────────────────────────────────────────────────────────
  product('cola', CAT_POSTMIX_ID, 'Coca-Cola', 'Cola', 'pak', 'pakken', 40),
  product('cola-zero', CAT_POSTMIX_ID, 'Coca-Cola Zero', 'Zero', 'pak', 'pakken', 41),
  product('fanta', CAT_POSTMIX_ID, 'Fanta', 'Fanta', 'pak', 'pakken', 42, SMALL),
  product('sprite', CAT_POSTMIX_ID, 'Sprite', 'Sprite', 'pak', 'pakken', 43, SMALL),
  product('koolzuur', CAT_POSTMIX_ID, 'Koolzuur', 'Koolzuur', 'cilinder', 'cilinders', 44, {
    productSize: ProductSize.LARGE,
    estimatedPalletLoad: 3,
  }),

  // ── Snoep ──────────────────────────────────────────────────────────────
  product('winegums', CAT_SNOEP_ID, 'Winegums', 'Winegums', 'zak', 'dozen', 50, SMALL),
  product('twix', CAT_SNOEP_ID, 'Twix', 'Twix', 'reep', 'dozen', 51, SMALL),
  product('snickers', CAT_SNOEP_ID, 'Snickers', 'Snickers', 'reep', 'dozen', 52, SMALL),
  product('mars', CAT_SNOEP_ID, 'Mars', 'Mars', 'reep', 'dozen', 53, SMALL),

  // ── Koffie en thee ─────────────────────────────────────────────────────
  product('koffie', CAT_KOFFIE_ID, 'Koffie', 'Koffie', 'pak', 'pakken', 60, SMALL),
  product('cacao-zak', CAT_KOFFIE_ID, 'Cacao Zak', 'Cacao', 'zak', 'zakken', 61, SMALL),
  product('melk', CAT_KOFFIE_ID, 'Melk', 'Melk', 'pak', 'pakken', 62, { ...SMALL, refrigerated: true }),
  product('suiker', CAT_KOFFIE_ID, 'Suiker', 'Suiker', 'doos', 'dozen', 63, SMALL),
  product('roerstaafjes', CAT_KOFFIE_ID, 'Roerstaafjes', 'Roerstaafjes', 'pak', 'pakken', 64, SMALL),
  product('koffiebekers', CAT_KOFFIE_ID, 'Koffie Bekers', 'Koffiebekers', 'sleeve', 'dozen', 65, {
    ownRoundThreshold: 40,
  }),
  product('thee-earl-grey', CAT_KOFFIE_ID, 'Thee Earl Grey', 'Earl Grey', 'doos', 'dozen', 66, SMALL),
  product('thee-lemon', CAT_KOFFIE_ID, 'Thee Lemon', 'Thee Lemon', 'doos', 'dozen', 67, SMALL),
  product('opschuimmelk', CAT_KOFFIE_ID, 'Opschuimmelk', 'Opschuimmelk', 'pak', 'pakken', 68, {
    ...SMALL,
    refrigerated: true,
  }),

  // ── Verpakkingen ───────────────────────────────────────────────────────
  product('square-bakjes', CAT_VERPAKKINGEN_ID, 'Square Bakjes', 'Square Bakjes', 'pak', 'pakken', 70, SMALL),
  product('rectangular-bakjes', CAT_VERPAKKINGEN_ID, 'Rectangular Bakjes', 'Rect. Bakjes', 'pak', 'pakken', 71, SMALL),
  product('patat-bakjes', CAT_VERPAKKINGEN_ID, 'Patat Bakjes', 'Patat Bakjes', 'pak', 'pakken', 72, SMALL),
  product('patat-vorkjes', CAT_VERPAKKINGEN_ID, 'Patat Vorkjes', 'Patat Vorkjes', 'pak', 'pakken', 73, SMALL),
  product('servetten', CAT_VERPAKKINGEN_ID, 'Servetten', 'Servetten', 'pak', 'pakken', 74, SMALL),
  product('sixpacks', CAT_VERPAKKINGEN_ID, 'Sixpacks', 'Sixpacks', 'pak', 'pakken', 75, SMALL),
  product('arena-blaadjes', CAT_VERPAKKINGEN_ID, 'Arena Blaadjes', 'Arena Blaadjes', 'pak', 'pakken', 76, SMALL),
  product('kassa-bonnen', CAT_VERPAKKINGEN_ID, 'Kassa Bonnen', 'Kassabonnen', 'rol', 'rollen', 77, SMALL),
  product('hotdog-broodjes', CAT_VERPAKKINGEN_ID, 'Hotdog Broodjes', 'Hotdogbroodjes', 'zak', 'zakken', 78, SMALL),
  product('hotdog-worsten', CAT_VERPAKKINGEN_ID, 'Hotdog Worsten', 'Hotdogworsten', 'pak', 'pakken', 79, {
    ...SMALL,
    refrigerated: true,
  }),
  product('kroketten', CAT_VERPAKKINGEN_ID, 'Kroketten', 'Kroketten', 'zak', 'dozen', 80, {
    ...SMALL,
    refrigerated: true,
  }),
  product('kipburgers', CAT_VERPAKKINGEN_ID, 'Kipburgers', 'Kipburgers', 'zak', 'dozen', 81, {
    ...SMALL,
    refrigerated: true,
  }),
  product('broodjes', CAT_VERPAKKINGEN_ID, 'Broodjes', 'Broodjes', 'zak', 'zakken', 82, SMALL),

  // ── Sauzen ─────────────────────────────────────────────────────────────
  product('mayo-emmers', CAT_SAUZEN_ID, 'Mayo Emmers', 'Mayo emmer', 'emmer', 'emmers', 80, SMALL),
  product('ketchup-emmers', CAT_SAUZEN_ID, 'Ketchup Emmers', 'Ketchup emmer', 'emmer', 'emmers', 81, SMALL),
  // Flessen worden per pak geteld, niet per fles: een norm staat dus in pakken.
  product('mayo-flessen', CAT_SAUZEN_ID, 'Mayo Flessen', 'Mayo', 'pak', 'pakken', 82, SMALL),
  product('ketchup-flessen', CAT_SAUZEN_ID, 'Ketchup Flessen', 'Ketchup', 'pak', 'pakken', 83, SMALL),
  product('mosterd-flessen', CAT_SAUZEN_ID, 'Mosterd Flessen', 'Mosterd', 'pak', 'pakken', 84, SMALL),

  // ── Schoonmaak ─────────────────────────────────────────────────────────
  product('tork-rol', CAT_SCHOONMAAK_ID, 'Tork Rol', 'Tork', 'rol', 'rollen', 90, SMALL),
  product('vuilniszakken', CAT_SCHOONMAAK_ID, 'Vuilniszakken', 'Vuilniszakken', 'rol', 'rollen', 91, SMALL),
]
