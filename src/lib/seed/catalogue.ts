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
    suppliedFromLargeCoolerForSatellite: false,
    collectedAfterEvent: false,
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

/**
 * Per kwart te tellen.
 *
 * Voor verpakkingen die uit vier gelijke delen bestaan: een tray bier is vier
 * sixpacks, een doos biertrays telt af per kwart. Een kwart is daar geen
 * schatting maar een aantal dat je kunt aanwijzen.
 */
const QUARTER_STEP: Partial<Product> = {
  inputStep: InputStep.QUARTER,
  allowPartialPackage: true,
}

/**
 * De gekoelde tray- en pakkendranken die een satelliet tijdens een evenement
 * uit een grote koeling haalt in plaats van uit het magazijn.
 *
 * Dit kenmerk en niet de categorie "Drank": daar zitten ook Caprisun en witte
 * wijn in, en die worden bij een satelliet gewoon centraal aangevuld. Zie
 * `shouldGenerateCentralRestock`.
 */
const SATELLITE_SUPPLIED: Partial<Product> = {
  suppliedFromLargeCoolerForSatellite: true,
}

export const demoProducts: Product[] = [
  // ── Bierbekers ─────────────────────────────────────────────────────────
  product('bierbeker-05', CAT_BIERBEKERS_ID, 'Bierbekers 0,5', 'Beker 0,5', 'doos', 'dozen', 1, BULK),
  product('bierbeker-04', CAT_BIERBEKERS_ID, 'Bierbekers 0,4', 'Beker 0,4', 'doos', 'dozen', 2, BULK),
  product('bierbeker-03', CAT_BIERBEKERS_ID, 'Bierbekers 0,3', 'Beker 0,3', 'doos', 'dozen', 3, {
    ...BULK,
    roundType: RoundType.AUTO,
  }),

  // ── Drank ───────────────────────────────────────────────────────────────
  // De namen volgen wat er op de bestellijst staat; de id's blijven zoals ze
  // waren, zodat eerdere tellingen naar hetzelfde product blijven wijzen.
  //
  // Alles met SATELLITE_SUPPLIED wordt bij een satelliet uit een grote koeling
  // bijgehaald en niet uit het magazijn. Caprisun en witte wijn staan er
  // bewust niet bij: die worden overal normaal aangevuld.
  product('chaudfontaine-blauw', CAT_DRANK_ID, 'Water Blauw', 'Water Blauw', 'pak', 'pakken', 10, { ...BULK, ...SATELLITE_SUPPLIED, refrigerated: true }),
  product('chaudfontaine-rood', CAT_DRANK_ID, 'Water Rood', 'Water Rood', 'pak', 'pakken', 11, { ...BULK, ...SATELLITE_SUPPLIED, refrigerated: true }),
  product('fuze-tea', CAT_DRANK_ID, 'Fuze Tea', 'Fuze Tea', 'pak', 'pakken', 12, { ...BULK, ...SATELLITE_SUPPLIED, refrigerated: true }),
  // Bier komt per tray van vier sixpacks. Een kwart tray is dus precies één
  // sixpack — een aantal dat de teller in zijn hand heeft, geen schatting.
  product('heineken-00', CAT_DRANK_ID, 'Heineken 0.0', 'Heineken 0.0', 'tray', 'trays', 13, {
    ...QUARTER_STEP,
    ...SATELLITE_SUPPLIED,
    refrigerated: true,
    priority: 6,
  }),
  product('radler', CAT_DRANK_ID, 'Radler 2.0', 'Radler', 'tray', 'trays', 14, {
    ...QUARTER_STEP,
    ...SATELLITE_SUPPLIED,
    refrigerated: true,
    priority: 6,
  }),
  product('bacardi-lemon', CAT_DRANK_ID, 'Bacardi Lime & Lemonade', 'Bac. Lime', 'blikje', 'trays', 15, {
    ...HALF_STEP,
    ...SATELLITE_SUPPLIED,
    refrigerated: true,
  }),
  product('stelz-icetea', CAT_DRANK_ID, 'Stelz Ice Tea', 'Stelz', 'blikje', 'trays', 16, {
    ...HALF_STEP,
    ...SATELLITE_SUPPLIED,
    refrigerated: true,
    priority: 5,
  }),
  product('jack-daniels', CAT_DRANK_ID, 'Jack Daniels Cola', 'Jack D.', 'blikje', 'trays', 17, {
    ...SMALL,
    ...SATELLITE_SUPPLIED,
    refrigerated: true,
  }),
  product('redbull', CAT_DRANK_ID, 'Red Bull', 'Red Bull', 'blikje', 'trays', 18, {
    ...SMALL,
    ...SATELLITE_SUPPLIED,
    refrigerated: true,
  }),
  product('bacardi-cola', CAT_DRANK_ID, 'Bacardi Cola', 'Bac. Cola', 'blikje', 'trays', 19, {
    ...HALF_STEP,
    ...SATELLITE_SUPPLIED,
    refrigerated: true,
  }),
  product('witte-wijn', CAT_DRANK_ID, 'Witte Wijn', 'Witte Wijn', 'fles', 'dozen', 20, {
    ...SMALL,
    refrigerated: true,
  }),
  // Staat bij Ziggo Platform als gewone voorraad: wordt dus normaal vanuit het
  // magazijn aangevuld, ook al is het een satelliet.
  product('caprisun', CAT_DRANK_ID, 'Caprisun', 'Caprisun', 'pak', 'dozen', 21, {
    ...SMALL,
    refrigerated: true,
  }),

  // ── Chips ──────────────────────────────────────────────────────────────
  // Een halve doos is hier een echt aantal: een aangebroken doos onder het
  // luik komt in elke kiosk voor. Vandaar halve stappen, met dezelfde betekenis
  // als bij de bekers en de dranken — `calculateRestockQuantity` doet er
  // niets bijzonders mee.
  product('chips-blauw', CAT_CHIPS_ID, 'Chips Blauw', 'Chips Blauw', 'doos', 'dozen', 30, {
    ...SMALL,
    ...HALF_STEP,
  }),
  product('chips-rood', CAT_CHIPS_ID, 'Chips Rood', 'Chips Rood', 'doos', 'dozen', 31, {
    ...SMALL,
    ...HALF_STEP,
  }),
  product('chips-oranje', CAT_CHIPS_ID, 'Chips Oranje', 'Chips Oranje', 'doos', 'dozen', 32, {
    ...SMALL,
    ...HALF_STEP,
  }),

  // ── Post-mix ───────────────────────────────────────────────────────────
  // Geteld worden de reservepakken buiten het rek; het pak dat aangesloten zit
  // telt niet mee. Vandaar hele pakken: `inputStep = ONE` en geen halve
  // verpakkingen. Zie POSTMIX_COUNTING_RULE in secondRingStandards.ts.
  //
  // De namen blijven staan zoals ze zijn. De koppeling met productie loopt via
  // de productnaam (`resolveProductIds`), dus "Fanta" hernoemen naar "Fanta
  // Orange" zou de bestaande rij niet meer vinden en er een tweede naast
  // zetten — precies de duplicaten die de historie breken.
  product('cola', CAT_POSTMIX_ID, 'Coca-Cola', 'Cola', 'pak', 'pakken', 40),
  product('cola-zero', CAT_POSTMIX_ID, 'Coca-Cola Zero', 'Zero', 'pak', 'pakken', 41),
  product('fanta', CAT_POSTMIX_ID, 'Fanta', 'Fanta', 'pak', 'pakken', 42, SMALL),
  product('sprite', CAT_POSTMIX_ID, 'Sprite', 'Sprite', 'pak', 'pakken', 43, SMALL),
  product('koolzuur', CAT_POSTMIX_ID, 'Koolzuur', 'Koolzuur', 'cilinder', 'cilinders', 44, {
    productSize: ProductSize.LARGE,
    estimatedPalletLoad: 3,
  }),
  // Een eigen product, niet de gekoelde `fuze-tea` uit de drankkast: dit is een
  // Post-mixpak voor de tap bij 407. Zelfde smaaknaam, andere verpakking,
  // andere voorraad — één id voor allebei zou de tellingen door elkaar halen.
  //
  // Staat achter Koolzuur omdat de volgorde van bestaande producten niet
  // meeverhuist naar productie: de sync werkt `sort_order` bewust niet bij, dus
  // hem hier tussenvoegen zou lokaal en in productie uit elkaar lopen.
  product(
    'fuze-tea-peach-hibiscus',
    CAT_POSTMIX_ID,
    'Fuze Tea Peach Hibiscus',
    'Fuze Peach',
    'pak',
    'pakken',
    45,
    SMALL
  ),

  // ── Snoep ──────────────────────────────────────────────────────────────
  product('winegums', CAT_SNOEP_ID, 'Winegums', 'Winegums', 'zak', 'dozen', 50, SMALL),
  product('twix', CAT_SNOEP_ID, 'Twix', 'Twix', 'reep', 'dozen', 51, SMALL),
  product('snickers', CAT_SNOEP_ID, 'Snickers', 'Snickers', 'reep', 'dozen', 52, SMALL),
  product('mars', CAT_SNOEP_ID, 'Mars', 'Mars', 'reep', 'dozen', 53, SMALL),

  // ── Koffie en thee ─────────────────────────────────────────────────────
  // Koffie hoort gekoeld te staan en kan dus alleen bij een telpunt met een
  // koeling. Welke telpunten dat zijn staat in `standardPolicies.ts`; die haalt
  // koffie weg bij de rest, ook waar een oudere lijst hem nog noemt.
  product('koffie', CAT_KOFFIE_ID, 'Koffie', 'Koffie', 'pak', 'pakken', 60, {
    ...SMALL,
    refrigerated: true,
  }),
  product('cacao-zak', CAT_KOFFIE_ID, 'Cacao Zak', 'Cacao', 'zak', 'zakken', 61, SMALL),
  product('melk', CAT_KOFFIE_ID, 'Melk', 'Melk', 'pak', 'pakken', 62, { ...SMALL, refrigerated: true }),
  product('suiker', CAT_KOFFIE_ID, 'Suiker', 'Suiker', 'doos', 'dozen', 63, SMALL),
  product('roerstaafjes', CAT_KOFFIE_ID, 'Roerstaafjes', 'Roerstaafjes', 'pak', 'pakken', 64, SMALL),
  product('koffiebekers', CAT_KOFFIE_ID, 'Koffie Bekers', 'Koffiebekers', 'rol', 'rollen', 65, {
    ownRoundThreshold: 40,
  }),
  product('thee-earl-grey', CAT_KOFFIE_ID, 'Thee Earl Grey', 'Earl Grey', 'doos', 'dozen', 66, SMALL),
  product('thee-lemon', CAT_KOFFIE_ID, 'Thee Lemon', 'Thee Lemon', 'doos', 'dozen', 67, SMALL),
  // Eén doosje is de norm, overal. Een aangebroken doosje gaat gewoon door en
  // hoeft niet vervangen te worden; pas onder de helft komt er een nieuw doosje
  // bij. Vandaar halve stappen — anders is "een half doosje" niet in te voeren —
  // en `FractionStrategy.HALF_COUNTS_FULL`, zodat die helft ook als vol telt.
  product('opschuimmelk', CAT_KOFFIE_ID, 'Opschuimmelk', 'Opschuimmelk', 'doosje', 'doosjes', 68, {
    ...SMALL,
    ...HALF_STEP,
    refrigerated: true,
  }),
  product('latiz', CAT_KOFFIE_ID, 'Latiz', 'Latiz', 'pak', 'pakken', 69, SMALL),
  product('lavazza-bekers', CAT_KOFFIE_ID, 'Lavazza Bekers', 'Lavazza bekers', 'sleeve', 'dozen', 70, SMALL),
  product('lavazza-cupjes', CAT_KOFFIE_ID, 'Lavazza Cupjes', 'Lavazza cupjes', 'doos', 'dozen', 71, SMALL),

  // ── Verpakkingen ───────────────────────────────────────────────────────
  product('square-bakjes', CAT_VERPAKKINGEN_ID, 'Square Bakjes', 'Square Bakjes', 'doos', 'dozen', 72, SMALL),
  product('rectangular-bakjes', CAT_VERPAKKINGEN_ID, 'Rectangular Bakjes', 'Rect. Bakjes', 'doos', 'dozen', 73, SMALL),
  product('patat-bakjes', CAT_VERPAKKINGEN_ID, 'Patat Bakjes', 'Patat Bakjes', 'doos', 'dozen', 74, SMALL),
  product('patat-vorkjes', CAT_VERPAKKINGEN_ID, 'Patat Vorkjes', 'Patat Vorkjes', 'pak', 'pakken', 75, SMALL),
  product('servetten', CAT_VERPAKKINGEN_ID, 'Servetten', 'Servetten', 'pak', 'pakken', 76, SMALL),
  // Heette "Sixpacks", maar het gaat om dozen met biertrays; de oude naam liet
  // tellers naar losse sixpacks zoeken. Het id blijft `sixpacks`, zodat elke
  // eerdere telling naar dezelfde rij blijft wijzen. Een aangebroken doos telt
  // af per kwart, en pas vanaf driekwart telt hij nog als vol — zie
  // `fractionStrategy.ts`.
  product('sixpacks', CAT_VERPAKKINGEN_ID, 'Biertrays', 'Biertrays', 'doos', 'dozen', 77, {
    ...SMALL,
    ...QUARTER_STEP,
  }),
  product('arena-blaadjes', CAT_VERPAKKINGEN_ID, 'Arena Blaadjes', 'Arena Blaadjes', 'pak', 'pakken', 78, SMALL),
  product('kassa-bonnen', CAT_VERPAKKINGEN_ID, 'Kassa Bonnen', 'Kassabonnen', 'rol', 'rollen', 79, SMALL),
  // Het eten zelf — broodjes, worsten, kroketten, kipburgers — telt logistiek
  // niet; dat loopt via de keuken.

  // ── Sauzen ─────────────────────────────────────────────────────────────
  product('mayo-emmers', CAT_SAUZEN_ID, 'Mayo Emmers', 'Mayo emmer', 'emmer', 'emmers', 80, SMALL),
  product('ketchup-emmers', CAT_SAUZEN_ID, 'Ketchup Emmers', 'Ketchup emmer', 'emmer', 'emmers', 81, SMALL),
  // Per fles, niet per pak. De bestellijst geeft hier normen van 15, en dat is
  // een aantal flessen — vijftien pakken saus staat in geen enkele kiosk. De
  // teller hoort te zien wat hij in zijn hand heeft.
  product('mayo-flessen', CAT_SAUZEN_ID, 'Mayo Flessen', 'Mayo', 'fles', 'flessen', 82, SMALL),
  product('ketchup-flessen', CAT_SAUZEN_ID, 'Ketchup Flessen', 'Ketchup', 'fles', 'flessen', 83, SMALL),
  product('mosterd-flessen', CAT_SAUZEN_ID, 'Mosterd Flessen', 'Mosterd', 'fles', 'flessen', 84, SMALL),

  // ── Schoonmaak ─────────────────────────────────────────────────────────
  product('tork-rol', CAT_SCHOONMAAK_ID, 'Tork Rol', 'Tork', 'rol', 'rollen', 90, SMALL),
  product('vuilniszakken', CAT_SCHOONMAAK_ID, 'Vuilniszakken', 'Vuilniszakken', 'rol', 'rollen', 91, SMALL),
  product('theedoeken', CAT_SCHOONMAAK_ID, 'Theedoeken', 'Theedoeken', 'stuk', 'pakken', 92, SMALL),
  // De GFT-bak wordt na elk evenement opgehaald. De kiosk begint dus elke keer
  // met niets, en dan is tellen zinloos: het antwoord is altijd nul en er moet
  // altijd één bak gebracht worden. Vandaar `collectedAfterEvent` — niet op de
  // tellijst, wel elke ronde op de vullijst.
  //
  // Hele bakken, geen halve: "een halve GFT-bak" is geen aantal dat iemand kan
  // aanwijzen. Dat zijn de standaardwaarden van `product()` en die blijven
  // staan, ook al wordt er niet geteld — de vuller ziet ze terug als norm.
  //
  // Bij Schoonmaak/afval, want daar hoort het. Achteraan in de sorteervolgorde:
  // de sync werkt `sort_order` bewust niet bij, dus ertussen schuiven zou
  // lokaal en in productie uit elkaar lopen.
  product('gft-bak', CAT_SCHOONMAAK_ID, 'GFT Bak', 'GFT', 'bak', 'bakken', 93, {
    ...SMALL,
    collectedAfterEvent: true,
  }),
]
