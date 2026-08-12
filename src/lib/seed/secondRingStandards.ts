import { DrinkStorageType } from '@/types'

/**
 * De echte voorraadnormen van de tweede ring, overgenomen van de papieren
 * bestellijsten.
 *
 * Dit is stamdata en geen berekening. De rest van de app leidt normen af uit
 * regels op het kiosknummer (`assortmentForKiosk`); dat was een redelijke
 * benadering zolang er geen echte lijsten waren, maar voor deze locaties zijn
 * ze er nu wel. Waar deze config iets zegt, is zij leidend.
 *
 * Twee dingen die uit de papieren lijst komen en die je moet weten om hem te
 * lezen:
 *
 *   1. De kolom "Standaard" is de norm. De kolom "Bestellen" is wat er op dat
 *      moment bijgevuld moest worden — historie, geen stamdata. Alleen
 *      "Standaard" staat hier.
 *   2. Een leeg vak betekent "geen actieve norm", niet "norm 0". Een product
 *      dat hieronder niet genoemd wordt, krijgt bij die kiosk dus geen norm.
 *
 * De aantallen staan in hele verpakkingen; `demoData` rekent ze om naar
 * kwarteenheden.
 */

export interface KioskStandardConfig {
  /** Sleutel van de kiosk in de seed, zoals `kiosk-401`. */
  kioskKey: string
  drinkStorageType: DrinkStorageType
  /** Product-id → norm in hele verpakkingen. */
  standards: Record<string, number>
}

/**
 * Dranknormen van de grote koelingen, telronde 12 augustus 2026.
 *
 * Deze vervangen de oudere gedrukte dranknormen: waar het papier en deze lijst
 * elkaar tegenspreken, geldt deze.
 */
const LARGE_COOLER_DRINKS: Record<string, Record<string, number>> = {
  'kiosk-401': {
    'chaudfontaine-blauw': 25,
    'chaudfontaine-rood': 6,
    'fuze-tea': 25,
    'heineken-00': 12,
    radler: 8,
    'stelz-icetea': 30, // genoteerd als "30 (? buffer)" — nog uitproberen
    'bacardi-cola': 30, // genoteerd als "30???" — nog uitproberen
    'bacardi-lemon': 10, // tijdelijk
    'jack-daniels': 8, // tijdelijk
    redbull: 10, // tijdelijk
  },
  'kiosk-403': {
    'chaudfontaine-blauw': 25,
    'chaudfontaine-rood': 6,
    'fuze-tea': 15,
    'heineken-00': 10,
    radler: 8,
    'stelz-icetea': 20,
    'bacardi-cola': 25,
    redbull: 8,
    'bacardi-lemon': 8, // tijdelijk
    'jack-daniels': 6, // tijdelijk
  },
  'kiosk-407': {
    'chaudfontaine-blauw': 20,
    'chaudfontaine-rood': 6,
    'fuze-tea': 21,
    'heineken-00': 7,
    radler: 7,
    'stelz-icetea': 29, // genoteerd als "29 (? buffer)" — nog uitproberen
    'bacardi-cola': 15,
    'bacardi-lemon': 12,
    'jack-daniels': 12,
    redbull: 10, // tijdelijk
  },
  'kiosk-410': {
    'chaudfontaine-blauw': 25,
    'chaudfontaine-rood': 8,
    'fuze-tea': 21,
    'heineken-00': 10,
    radler: 7,
    'stelz-icetea': 25,
    'bacardi-cola': 30,
    'bacardi-lemon': 10,
    redbull: 10,
    'jack-daniels': 8, // tijdelijk
  },
  'kiosk-416': {
    'chaudfontaine-blauw': 25,
    'chaudfontaine-rood': 6,
    'fuze-tea': 20,
    'heineken-00': 10,
    radler: 10,
    'stelz-icetea': 24,
    'bacardi-cola': 30, // genoteerd als "30(?)" — nog uitproberen
    'bacardi-lemon': 8,
    'jack-daniels': 6,
    redbull: 10, // tijdelijk
  },
  'kiosk-419': {
    'chaudfontaine-blauw': 20,
    'chaudfontaine-rood': 6,
    'fuze-tea': 20,
    'heineken-00': 10,
    radler: 7,
    'stelz-icetea': 15,
    'bacardi-cola': 30,
    'bacardi-lemon': 8,
    redbull: 10,
    'jack-daniels': 8, // tijdelijk
  },
  'kiosk-420': {
    'chaudfontaine-blauw': 25,
    'chaudfontaine-rood': 8,
    'fuze-tea': 25, // genoteerd als "25(?)" — nog uitproberen
    'heineken-00': 15,
    radler: 10,
    'stelz-icetea': 25,
    'bacardi-cola': 20,
    'bacardi-lemon': 12,
    'jack-daniels': 8,
    redbull: 10,
  },
  'kiosk-423': {
    'chaudfontaine-blauw': 20,
    'chaudfontaine-rood': 6,
    'fuze-tea': 20,
    'heineken-00': 15, // genoteerd als "15(?)" — nog uitproberen
    'stelz-icetea': 15,
    'bacardi-cola': 25,
    radler: 10, // tijdelijk
    'bacardi-lemon': 10, // tijdelijk
    'jack-daniels': 6, // tijdelijk
    redbull: 10, // tijdelijk
  },
  'kiosk-426': {
    'chaudfontaine-blauw': 25,
    'chaudfontaine-rood': 6,
    'fuze-tea': 28,
    'heineken-00': 15, // genoteerd als "15(?)" — nog uitproberen
    radler: 10,
    'stelz-icetea': 15,
    'bacardi-cola': 30,
    'bacardi-lemon': 10,
    redbull: 10,
    'jack-daniels': 8, // tijdelijk
  },
}

/**
 * Aannames die nog bevestigd moeten worden.
 *
 * Bewust geen databasekolom: dit zegt iets over ons vertrouwen in een getal,
 * niet over de voorraad. Een kolom zou meegemigreerd en onderhouden moeten
 * worden voor iets dat over een paar weken achterhaald is.
 */
export const temporaryStandardAssumptions: ReadonlyArray<{
  kioskKey: string
  productId: string
  reason: string
}> = [
  { kioskKey: 'kiosk-401', productId: 'bacardi-lemon', reason: 'tijdelijke waarde' },
  { kioskKey: 'kiosk-401', productId: 'jack-daniels', reason: 'tijdelijke waarde' },
  { kioskKey: 'kiosk-401', productId: 'redbull', reason: 'tijdelijke waarde' },
  { kioskKey: 'kiosk-401', productId: 'stelz-icetea', reason: 'geteld als "30 (? buffer)"' },
  { kioskKey: 'kiosk-401', productId: 'bacardi-cola', reason: 'geteld als "30???"' },
  { kioskKey: 'kiosk-403', productId: 'bacardi-lemon', reason: 'tijdelijke waarde' },
  { kioskKey: 'kiosk-403', productId: 'jack-daniels', reason: 'tijdelijke waarde' },
  { kioskKey: 'kiosk-407', productId: 'redbull', reason: 'tijdelijke waarde' },
  { kioskKey: 'kiosk-407', productId: 'stelz-icetea', reason: 'geteld als "29 (? buffer)"' },
  { kioskKey: 'kiosk-410', productId: 'jack-daniels', reason: 'tijdelijke waarde' },
  { kioskKey: 'kiosk-416', productId: 'redbull', reason: 'tijdelijke waarde' },
  { kioskKey: 'kiosk-416', productId: 'bacardi-cola', reason: 'geteld als "30(?)"' },
  { kioskKey: 'kiosk-419', productId: 'jack-daniels', reason: 'tijdelijke waarde' },
  { kioskKey: 'kiosk-420', productId: 'fuze-tea', reason: 'geteld als "25(?)"' },
  { kioskKey: 'kiosk-423', productId: 'radler', reason: 'tijdelijke waarde' },
  { kioskKey: 'kiosk-423', productId: 'bacardi-lemon', reason: 'tijdelijke waarde' },
  { kioskKey: 'kiosk-423', productId: 'jack-daniels', reason: 'tijdelijke waarde' },
  { kioskKey: 'kiosk-423', productId: 'redbull', reason: 'tijdelijke waarde' },
  { kioskKey: 'kiosk-423', productId: 'heineken-00', reason: 'geteld als "15(?)"' },
  { kioskKey: 'kiosk-426', productId: 'jack-daniels', reason: 'tijdelijke waarde' },
  { kioskKey: 'kiosk-426', productId: 'heineken-00', reason: 'geteld als "15(?)"' },
]

/**
 * De werkvoorraad drank van een satelliet: overal één.
 *
 * Dat is geen buffer maar een assortimentsindicatie — het product staat er,
 * en tijdens het evenement wordt bijgehaald uit een grote kiosk in de buurt.
 * De norm blijft zichtbaar bij het tellen; alleen het magazijn hoeft er niets
 * mee.
 */
const SATELLITE_DRINKS: Record<string, number> = {
  'chaudfontaine-blauw': 1,
  'chaudfontaine-rood': 1,
  'fuze-tea': 1,
  'heineken-00': 1,
  radler: 1,
  'stelz-icetea': 1,
  'bacardi-lemon': 1,
  'jack-daniels': 1,
  redbull: 1,
  'bacardi-cola': 1,
}

/** De koffiehoek zoals die op vrijwel elke lijst terugkomt. */
const KOFFIEHOEK: Record<string, number> = {
  koffie: 2,
  'cacao-zak': 2,
  melk: 1,
  suiker: 1,
  roerstaafjes: 1,
  koffiebekers: 8,
  'thee-earl-grey': 2,
  'thee-lemon': 2,
  opschuimmelk: 2,
}

export const secondRingStandards: KioskStandardConfig[] = [
  {
    kioskKey: 'kiosk-401',
    drinkStorageType: DrinkStorageType.LARGE_COOLER,
    standards: {
      'bierbeker-05': 5,
      'bierbeker-04': 4,
      ...LARGE_COOLER_DRINKS['kiosk-401']!,
      'chips-blauw': 7,
      'chips-rood': 6,
      'chips-oranje': 6,
      cola: 6,
      'cola-zero': 6,
      fanta: 4,
      sprite: 3,
      koolzuur: 2,
      ...KOFFIEHOEK,
      'rectangular-bakjes': 2,
      servetten: 5,
      sixpacks: 3,
      'arena-blaadjes': 1,
      'tork-rol': 6,
      vuilniszakken: 1,
      'ketchup-flessen': 15,
      'mosterd-flessen': 15,
    },
  },
  {
    kioskKey: 'kiosk-402',
    drinkStorageType: DrinkStorageType.SATELLITE,
    standards: {
      'bierbeker-05': 1,
      'bierbeker-04': 1,
      'bierbeker-03': 1,
      ...SATELLITE_DRINKS,
      'chips-blauw': 2,
      'chips-rood': 2,
      'chips-oranje': 2,
      ...KOFFIEHOEK,
      'tork-rol': 6,
      vuilniszakken: 1,
    },
  },
  {
    kioskKey: 'kiosk-403',
    drinkStorageType: DrinkStorageType.LARGE_COOLER,
    standards: {
      'bierbeker-05': 3,
      'bierbeker-04': 2,
      ...LARGE_COOLER_DRINKS['kiosk-403']!,
      'chips-blauw': 6,
      'chips-rood': 5,
      'chips-oranje': 5,
      ...KOFFIEHOEK,
      'square-bakjes': 2,
      'patat-bakjes': 3,
      servetten: 5,
      sixpacks: 3,
      'patat-vorkjes': 1,
      'tork-rol': 6,
      vuilniszakken: 1,
      'mayo-emmers': 5,
      'ketchup-flessen': 15,
    },
  },
  {
    kioskKey: 'kiosk-404',
    drinkStorageType: DrinkStorageType.SATELLITE,
    standards: {
      'bierbeker-05': 3,
      'bierbeker-04': 2,
      ...SATELLITE_DRINKS,
      'chips-blauw': 5,
      'chips-rood': 5,
      'chips-oranje': 5,
      cola: 2,
      'cola-zero': 2,
      fanta: 2,
      sprite: 2,
      koolzuur: 2,
      ...KOFFIEHOEK,
      'rectangular-bakjes': 2,
      servetten: 5,
      sixpacks: 3,
      'arena-blaadjes': 1,
      'tork-rol': 6,
      vuilniszakken: 1,
    },
  },
  {
    // De bestaande kiosk 406 is "406 Oud": dezelfde rij, alleen een opschrift
    // erbij. De sleutel blijft daarom `kiosk-406`, zodat de koppeling met de
    // database (op ring + nummer) niet verschuift.
    kioskKey: 'kiosk-406',
    drinkStorageType: DrinkStorageType.SATELLITE,
    standards: {
      'bierbeker-05': 2,
      'bierbeker-04': 2,
      ...SATELLITE_DRINKS,
      'chips-blauw': 5,
      'chips-rood': 4,
      'chips-oranje': 3,
      cola: 3,
      'cola-zero': 3,
      fanta: 3,
      sprite: 2,
      koolzuur: 2,
      ...KOFFIEHOEK,
      latiz: 2,
      'lavazza-bekers': 5,
      'lavazza-cupjes': 3,
      'rectangular-bakjes': 2,
      servetten: 5,
      sixpacks: 3,
      'arena-blaadjes': 1,
      'tork-rol': 6,
      vuilniszakken: 1,
      'ketchup-flessen': 15,
      'mosterd-flessen': 15,
    },
  },
  {
    kioskKey: 'kiosk-406-nieuw',
    drinkStorageType: DrinkStorageType.SATELLITE,
    standards: {
      'bierbeker-05': 3,
      'bierbeker-04': 2,
      'bierbeker-03': 1,
      ...SATELLITE_DRINKS,
      'chips-blauw': 5,
      'chips-rood': 4,
      'chips-oranje': 4,
      ...KOFFIEHOEK,
      'rectangular-bakjes': 2,
      'square-bakjes': 2,
      servetten: 5,
      sixpacks: 3,
      'arena-blaadjes': 1,
      'tork-rol': 6,
      vuilniszakken: 1,
      'ketchup-flessen': 15,
      'mayo-flessen': 15,
      'mosterd-flessen': 15,
    },
  },
  {
    kioskKey: 'kiosk-407',
    drinkStorageType: DrinkStorageType.LARGE_COOLER,
    standards: {
      'bierbeker-05': 4,
      'bierbeker-04': 4,
      'bierbeker-03': 2,
      ...LARGE_COOLER_DRINKS['kiosk-407']!,
      'chips-blauw': 6,
      'chips-rood': 6,
      'chips-oranje': 6,
      cola: 1,
      'cola-zero': 1,
      fanta: 1,
      sprite: 1,
      koolzuur: 2,
      ...KOFFIEHOEK,
      'square-bakjes': 2,
      'patat-bakjes': 3,
      servetten: 5,
      sixpacks: 3,
      'patat-vorkjes': 1,
      'arena-blaadjes': 1,
      'tork-rol': 6,
      vuilniszakken: 1,
      theedoeken: 4,
      'mayo-emmers': 5,
      'ketchup-flessen': 15,
    },
  },
  {
    kioskKey: 'kiosk-409',
    drinkStorageType: DrinkStorageType.SATELLITE,
    standards: {
      'bierbeker-05': 1,
      'bierbeker-04': 1,
      'bierbeker-03': 1,
      ...SATELLITE_DRINKS,
      'chips-blauw': 2,
      'chips-rood': 2,
      'chips-oranje': 2,
      ...KOFFIEHOEK,
      sixpacks: 1,
      'tork-rol': 6,
      vuilniszakken: 1,
    },
  },
  {
    kioskKey: 'kiosk-410',
    drinkStorageType: DrinkStorageType.LARGE_COOLER,
    standards: {
      'bierbeker-05': 5,
      'bierbeker-04': 4,
      ...LARGE_COOLER_DRINKS['kiosk-410']!,
      'chips-blauw': 7,
      'chips-rood': 6,
      'chips-oranje': 6,
      cola: 6,
      'cola-zero': 5,
      fanta: 4,
      sprite: 3,
      koolzuur: 2,
      ...KOFFIEHOEK,
      'rectangular-bakjes': 3,
      servetten: 5,
      sixpacks: 3,
      'patat-vorkjes': 1,
      'arena-blaadjes': 1,
      'tork-rol': 6,
      vuilniszakken: 1,
      'ketchup-flessen': 15,
      'mosterd-flessen': 15,
    },
  },
  {
    kioskKey: 'kiosk-412',
    drinkStorageType: DrinkStorageType.SATELLITE,
    standards: {
      'bierbeker-05': 3,
      'bierbeker-04': 3,
      ...SATELLITE_DRINKS,
      'chips-blauw': 2,
      'chips-rood': 2,
      'chips-oranje': 2,
      ...KOFFIEHOEK,
      'rectangular-bakjes': 3,
      'square-bakjes': 3,
      servetten: 5,
      sixpacks: 3,
      'tork-rol': 6,
      vuilniszakken: 1,
      'ketchup-flessen': 15,
      'mayo-flessen': 15,
      'mosterd-flessen': 15,
    },
  },
  {
    kioskKey: 'kiosk-414',
    drinkStorageType: DrinkStorageType.SATELLITE,
    standards: {
      'bierbeker-05': 3,
      'bierbeker-04': 3,
      ...SATELLITE_DRINKS,
      'chips-blauw': 2,
      'chips-rood': 2,
      'chips-oranje': 2,
      ...KOFFIEHOEK,
      'rectangular-bakjes': 3,
      'square-bakjes': 3,
      servetten: 5,
      sixpacks: 3,
      'tork-rol': 6,
      vuilniszakken: 1,
      'ketchup-flessen': 15,
      'mayo-flessen': 15,
      'mosterd-flessen': 15,
    },
  },
  {
    kioskKey: 'kiosk-416',
    drinkStorageType: DrinkStorageType.LARGE_COOLER,
    standards: {
      'bierbeker-05': 4,
      'bierbeker-04': 3,
      ...LARGE_COOLER_DRINKS['kiosk-416']!,
      'chips-blauw': 7,
      'chips-rood': 6,
      'chips-oranje': 6,
      cola: 6,
      'cola-zero': 5,
      fanta: 4,
      sprite: 3,
      koolzuur: 2,
      ...KOFFIEHOEK,
      'rectangular-bakjes': 2,
      servetten: 5,
      sixpacks: 3,
      'arena-blaadjes': 1,
      'tork-rol': 6,
      vuilniszakken: 1,
      'ketchup-flessen': 15,
      'mosterd-flessen': 15,
    },
  },
  {
    kioskKey: 'kiosk-417',
    drinkStorageType: DrinkStorageType.SATELLITE,
    standards: {
      'bierbeker-05': 2,
      'bierbeker-04': 2,
      ...SATELLITE_DRINKS,
      'chips-blauw': 5,
      'chips-rood': 4,
      'chips-oranje': 4,
      ...KOFFIEHOEK,
      'rectangular-bakjes': 2,
      servetten: 5,
      sixpacks: 3,
      'arena-blaadjes': 1,
      'tork-rol': 6,
      vuilniszakken: 1,
      'ketchup-flessen': 15,
      'mayo-flessen': 15,
      'mosterd-flessen': 15,
    },
  },
  {
    // Geen post-mix en geen rectangular bakjes: die staan expliciet niet op de
    // lijst van 419, ook al voeren de buren ze wel.
    kioskKey: 'kiosk-419',
    drinkStorageType: DrinkStorageType.LARGE_COOLER,
    standards: {
      'bierbeker-05': 3,
      'bierbeker-04': 2,
      ...LARGE_COOLER_DRINKS['kiosk-419']!,
      'chips-blauw': 6,
      'chips-rood': 5,
      'chips-oranje': 5,
      ...KOFFIEHOEK,
      'square-bakjes': 2,
      'patat-bakjes': 3,
      servetten: 5,
      sixpacks: 3,
      'patat-vorkjes': 1,
      'arena-blaadjes': 1,
      'tork-rol': 6,
      vuilniszakken: 1,
      'mayo-emmers': 5,
      'ketchup-flessen': 15,
    },
  },
  {
    kioskKey: 'kiosk-420',
    drinkStorageType: DrinkStorageType.LARGE_COOLER,
    standards: {
      'bierbeker-04': 3,
      ...LARGE_COOLER_DRINKS['kiosk-420']!,
      'chips-blauw': 6,
      'chips-rood': 6,
      'chips-oranje': 6,
      cola: 5,
      'cola-zero': 7,
      fanta: 4,
      sprite: 3,
      koolzuur: 2,
      ...KOFFIEHOEK,
      'rectangular-bakjes': 3,
      'square-bakjes': 3,
      servetten: 5,
      sixpacks: 3,
      'arena-blaadjes': 1,
      'tork-rol': 6,
      vuilniszakken: 1,
      theedoeken: 4,
      'ketchup-flessen': 15,
      'mayo-flessen': 15,
      'mosterd-flessen': 15,
    },
  },
  {
    // Kleine bar, geen satelliet: deze dranknormen van 2 zijn echte voorraad
    // en mogen dus gewoon vanuit het magazijn worden aangevuld.
    kioskKey: 'kiosk-420-bar',
    drinkStorageType: DrinkStorageType.SMALL_BAR,
    standards: {
      'bierbeker-05': 4,
      'bierbeker-04': 3,
      'bierbeker-03': 2,
      'chaudfontaine-blauw': 2,
      'chaudfontaine-rood': 2,
      'fuze-tea': 2,
      'heineken-00': 2,
      radler: 2,
      'stelz-icetea': 2,
      'bacardi-lemon': 2,
      'jack-daniels': 2,
      redbull: 2,
      'bacardi-cola': 2,
      'chips-blauw': 10,
      'chips-rood': 10,
      'chips-oranje': 10,
      cola: 2,
      'cola-zero': 2,
      fanta: 2,
      sprite: 2,
      koolzuur: 2,
      sixpacks: 3,
      'tork-rol': 6,
      vuilniszakken: 1,
    },
  },
  {
    // Koffie- en Lavazza-locatie; geen normale drankvoorraad.
    kioskKey: 'kiosk-422',
    drinkStorageType: DrinkStorageType.NONE,
    standards: {
      'cacao-zak': 2,
      melk: 1,
      suiker: 1,
      roerstaafjes: 1,
      koffiebekers: 8,
      'thee-earl-grey': 2,
      'thee-lemon': 2,
      latiz: 2,
      'lavazza-bekers': 5,
      'lavazza-cupjes': 3,
      servetten: 5,
      'tork-rol': 6,
      vuilniszakken: 1,
    },
  },
  {
    kioskKey: 'kiosk-423',
    drinkStorageType: DrinkStorageType.LARGE_COOLER,
    standards: {
      'bierbeker-05': 4,
      'bierbeker-04': 3,
      ...LARGE_COOLER_DRINKS['kiosk-423']!,
      'chips-blauw': 6,
      'chips-rood': 5,
      'chips-oranje': 5,
      ...KOFFIEHOEK,
      'square-bakjes': 2,
      'patat-bakjes': 3,
      servetten: 5,
      sixpacks: 3,
      'patat-vorkjes': 1,
      'tork-rol': 6,
      vuilniszakken: 1,
      'mayo-emmers': 5,
      'ketchup-flessen': 15,
    },
  },
  {
    kioskKey: 'kiosk-424',
    drinkStorageType: DrinkStorageType.SATELLITE,
    standards: {
      'bierbeker-05': 1,
      'bierbeker-04': 1,
      ...SATELLITE_DRINKS,
      'chips-blauw': 2,
      'chips-rood': 2,
      'chips-oranje': 2,
      ...KOFFIEHOEK,
      'tork-rol': 6,
      vuilniszakken: 1,
    },
  },
  {
    kioskKey: 'kiosk-426',
    drinkStorageType: DrinkStorageType.LARGE_COOLER,
    standards: {
      'bierbeker-05': 5,
      'bierbeker-04': 4,
      ...LARGE_COOLER_DRINKS['kiosk-426']!,
      'chips-blauw': 6,
      'chips-rood': 5,
      'chips-oranje': 5,
      cola: 6,
      'cola-zero': 6,
      fanta: 4,
      sprite: 3,
      koolzuur: 2,
      ...KOFFIEHOEK,
      'rectangular-bakjes': 2,
      servetten: 5,
      sixpacks: 3,
      'arena-blaadjes': 1,
      'tork-rol': 6,
      vuilniszakken: 1,
      'ketchup-flessen': 15,
      'mosterd-flessen': 15,
    },
  },
  {
    kioskKey: 'kiosk-427',
    drinkStorageType: DrinkStorageType.SATELLITE,
    standards: {
      'bierbeker-05': 3,
      'bierbeker-04': 3,
      ...SATELLITE_DRINKS,
      'chips-blauw': 2,
      'chips-rood': 2,
      'chips-oranje': 2,
      ...KOFFIEHOEK,
      'rectangular-bakjes': 2,
      'square-bakjes': 2,
      servetten: 5,
      sixpacks: 3,
      'tork-rol': 6,
      vuilniszakken: 1,
      'ketchup-flessen': 15,
      'mayo-flessen': 15,
      'mosterd-flessen': 15,
    },
  },
  {
    kioskKey: 'kiosk-429',
    drinkStorageType: DrinkStorageType.SATELLITE,
    standards: {
      'bierbeker-05': 3,
      'bierbeker-04': 3,
      ...SATELLITE_DRINKS,
      'chips-blauw': 2,
      'chips-rood': 2,
      'chips-oranje': 2,
      ...KOFFIEHOEK,
      'rectangular-bakjes': 2,
      'square-bakjes': 2,
      servetten: 5,
      sixpacks: 3,
      'tork-rol': 6,
      vuilniszakken: 1,
      'ketchup-flessen': 15,
      'mayo-flessen': 15,
      'mosterd-flessen': 15,
    },
  },
  {
    // Caprisun staat hier als gewone voorraad en wordt dus normaal vanuit het
    // magazijn aangevuld, ondanks dat dit een satelliet is.
    kioskKey: 'kiosk-ziggo-platform',
    drinkStorageType: DrinkStorageType.SATELLITE,
    standards: {
      'bierbeker-05': 1,
      'bierbeker-04': 1,
      ...SATELLITE_DRINKS,
      'chips-blauw': 2,
      'chips-rood': 2,
      'chips-oranje': 2,
      cola: 2,
      'cola-zero': 2,
      fanta: 2,
      sprite: 2,
      caprisun: 1,
      sixpacks: 3,
      'tork-rol': 6,
      vuilniszakken: 1,
    },
  },
]

/**
 * Voor welke kiosken deze config gezag heeft.
 *
 * Gebruikt om het uitschakelen van verouderde normen te begrenzen: alleen hier
 * mag de seed normen op non-actief zetten. Een eerste-ringkiosk of een
 * tweede-ringkiosk waarvoor nog geen lijst is aangeleverd moet ongemoeid
 * blijven.
 */
export const authoritativeKioskKeys: ReadonlySet<string> = new Set(
  secondRingStandards.map((config) => config.kioskKey)
)
