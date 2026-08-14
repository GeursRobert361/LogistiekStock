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
  /**
   * Heeft dit telpunt een eigen drankvoorraad, ook zonder grote koeling?
   *
   * Zie `LOCAL_DRINK_STOCK_KIOSK_KEYS`. Wordt afgeleid en hoeft in
   * `PAPER_STANDARDS` niet ingevuld te worden.
   */
  keepsOwnDrinkStock?: boolean
  /** Product-id → norm in hele verpakkingen. */
  standards: Record<string, number>
}

/**
 * Bronprioriteit voor een voorraadnorm, van sterk naar zwak:
 *
 *   1. De specifieke Ziggo Platform-lijst, uitsluitend voor de producten die
 *      daar met name op staan. De meest specifieke bron wint, ook van de
 *      algemene Disposable-lijst — zie `LATEST_ZIGGO_PLATFORM_OVERRIDES`.
 *   2. De nieuwste Disposable-stocklijst, voor de zeven producten uit
 *      `DISPOSABLE_PRODUCT_IDS`.
 *   3. De nieuwste GFT-lijst, die bij acht locaties één GFT-bak neerzet.
 *   4. De eerdere nieuwste handmatige lijsten: drank, bekers, chips, Post-mix.
 *   5. De kolom "Standaard" van de papieren bestellijst van diezelfde kiosk.
 *   6. Geen actieve norm.
 *
 * Alles wat op geen enkele handmatige lijst staat — koffie, sauzen, Tork, en
 * de koolzuurcilinders — komt dus onveranderd van papier.
 *
 * Elke laag overschrijft alleen de combinaties kiosk + product die hij zélf
 * noemt. Een locatie die op een nieuwe lijst ontbreekt houdt wat hij had: een
 * lijst die over tweeëntwintig locaties gaat zegt niets over de drieëntwintigste.
 * Weglating is geen deactivering; alleen een expliciete 0 zet een norm uit.
 *
 * Nooit een andere kiosk als terugval gebruiken wanneer de eigen papieren
 * Standaard bekend is. Dat is eerder wél gebeurd — bij elf combinaties werd een
 * ontbrekende notitiewaarde ingevuld met het getal van een vergelijkbare grote
 * koeling — en dat leverde normen op die niemand had opgeschreven. Een kiosk
 * die zelf op papier 5 zegt hoort geen 10 te krijgen omdat de buurman dat heeft.
 *
 * De bronnen staan daarom apart en worden expliciet samengevoegd, zodat bij elk
 * getal te zien blijft waar het vandaan komt.
 */

/**
 * De dranknormen zoals ze op de papieren bestellijst staan — compleet.
 *
 * Alle tien de drankproducten per grote koeling, ook waar een latere handmatige
 * lijst ze overschrijft. Dat is niet overbodig: hier staat wat de kiosk volgens
 * de bestellijst hoort te hebben, en dat blijft de basis als een handmatige
 * waarde ooit vervalt. Eerder stonden hier alleen de gaten die de notitie
 * openliet, en dan lijkt een half ingevulde bron op de hele waarheid.
 */
const PAPER_DRINKS: Record<string, Record<string, number>> = {
  'kiosk-401': {
    'chaudfontaine-blauw': 15,
    'chaudfontaine-rood': 5,
    'fuze-tea': 15,
    'heineken-00': 12,
    radler: 5,
    'stelz-icetea': 10,
    'bacardi-lemon': 10,
    'jack-daniels': 6,
    redbull: 6,
    'bacardi-cola': 12,
  },
  'kiosk-403': {
    'chaudfontaine-blauw': 15,
    'chaudfontaine-rood': 4,
    'fuze-tea': 15,
    'heineken-00': 10,
    radler: 5,
    'stelz-icetea': 10,
    'bacardi-lemon': 8,
    'jack-daniels': 5,
    redbull: 6,
    'bacardi-cola': 10,
  },
  'kiosk-407': {
    'chaudfontaine-blauw': 15,
    'chaudfontaine-rood': 4,
    'fuze-tea': 10,
    'heineken-00': 10,
    radler: 5,
    'stelz-icetea': 10,
    'bacardi-lemon': 8,
    'jack-daniels': 5,
    redbull: 10,
    'bacardi-cola': 10,
  },
  'kiosk-410': {
    'chaudfontaine-blauw': 15,
    'chaudfontaine-rood': 6,
    'fuze-tea': 15,
    'heineken-00': 10,
    radler: 5,
    'stelz-icetea': 10,
    'bacardi-lemon': 10,
    'jack-daniels': 6,
    redbull: 6,
    'bacardi-cola': 12,
  },
  'kiosk-416': {
    'chaudfontaine-blauw': 15,
    'chaudfontaine-rood': 5,
    'fuze-tea': 15,
    'heineken-00': 10,
    radler: 5,
    'stelz-icetea': 10,
    'bacardi-lemon': 10,
    'jack-daniels': 6,
    redbull: 6,
    'bacardi-cola': 10,
  },
  'kiosk-419': {
    'chaudfontaine-blauw': 15,
    'chaudfontaine-rood': 4,
    'fuze-tea': 10,
    'heineken-00': 10,
    radler: 5,
    'stelz-icetea': 10,
    'bacardi-lemon': 8,
    'jack-daniels': 5,
    redbull: 6,
    'bacardi-cola': 10,
  },
  'kiosk-420': {
    'chaudfontaine-blauw': 25,
    'chaudfontaine-rood': 6,
    'fuze-tea': 15,
    'heineken-00': 15,
    radler: 10,
    'stelz-icetea': 15,
    'bacardi-lemon': 10,
    'jack-daniels': 8,
    redbull: 10,
    'bacardi-cola': 15,
  },
  'kiosk-423': {
    'chaudfontaine-blauw': 15,
    'chaudfontaine-rood': 4,
    'fuze-tea': 10,
    'heineken-00': 10,
    radler: 5,
    'stelz-icetea': 10,
    'bacardi-lemon': 10,
    'jack-daniels': 5,
    redbull: 6,
    'bacardi-cola': 10,
  },
  'kiosk-426': {
    'chaudfontaine-blauw': 15,
    'chaudfontaine-rood': 6,
    'fuze-tea': 15,
    'heineken-00': 10,
    radler: 5,
    'stelz-icetea': 10,
    'bacardi-lemon': 10,
    'jack-daniels': 6,
    redbull: 10,
    'bacardi-cola': 10,
  },
}

/**
 * Telpunten met een eigen drankvoorraad zonder grote koeling.
 *
 * De algemene regel hieronder is een vuistregel op het opslagtype, en die is
 * goed zolang niemand het beter weet. Soms weet iemand het beter: voor Ziggo
 * Platform is een eigen stocklijst aangeleverd met echte aantallen per
 * drankproduct. Dat is voorraad die geteld en aangevuld moet worden, geen
 * assortimentsindicatie.
 *
 * Dat wordt hier vastgelegd als een eigen kenmerk, en nadrukkelijk niet
 * opgelost door Ziggo maar `LARGE_COOLER` te noemen: er staat daar geen grote
 * koeling, en een opslagtype dat liegt over de vloer neemt later een andere
 * beslissing mee de verkeerde kant op — de vulronde-indeling bijvoorbeeld, die
 * `isLargeCoolerDrinkStock` gebruikt.
 *
 * Een expliciete lokale stocklijst wint dus van de generieke regel op het
 * opslagtype. Komt er een tweede locatie bij, dan is dat één sleutel erbij.
 *
 * Gaat mee naar de database als `kiosks.keeps_own_drink_stock`, want de
 * bijvulregel draait in productie op wat daar staat en niet op deze seed.
 */
export const LOCAL_DRINK_STOCK_KIOSK_KEYS: ReadonlySet<string> = new Set([
  'kiosk-ziggo-platform',
])

/**
 * Wie telt de gekoelde drank?
 *
 * In beginsel alleen een telpunt met een grote koeling. Nergens anders staat
 * drank als voorraad: een satelliet, een kleine bar en een koffiehoek verkopen
 * hem wel, maar hebben niets om hem in te bewaren.
 *
 * Hiervóór stond bij twaalf satellieten elk drankproduct op norm 1 en bij
 * 420 Bar op 2, bedoeld als "het staat in het assortiment". Dat leverde een
 * teller vijftien regels op die hij niet kon tellen omdat er geen koeling is,
 * en het magazijn een reeks tekorten van één. Een norm hoort te zeggen hoeveel
 * er moet liggen; als dat nergens is, is er geen norm.
 *
 * Daarop is één uitzondering, en die komt niet uit een regel maar uit een
 * lijst: `hasExplicitLocalStock`. Zie `LOCAL_DRINK_STOCK_KIOSK_KEYS`.
 *
 * Dit gaat uitsluitend over de categorie Drank. Post-mix, bekers, chips,
 * koffie, verpakkingen, sauzen en schoonmaak worden overal geteld waar ze op de
 * lijst staan.
 */
export function countsChilledDrinks(
  storage: DrinkStorageType,
  options: { hasExplicitLocalStock?: boolean } = {}
): boolean {
  if (options.hasExplicitLocalStock === true) return true
  return storage === DrinkStorageType.LARGE_COOLER
}

/** De tien drankproducten die op elke papieren bestellijst staan. */
export const PAPER_DRINK_PRODUCT_IDS = [
  'chaudfontaine-blauw',
  'chaudfontaine-rood',
  'fuze-tea',
  'heineken-00',
  'radler',
  'stelz-icetea',
  'bacardi-lemon',
  'jack-daniels',
  'redbull',
  'bacardi-cola',
] as const

/**
 * De nieuwste handmatige drankstocklijst.
 *
 * Vervangt de dranknotitie van 12 augustus 2026: waar die maar een deel van de
 * producten noemde, staan hier voor alle negen grote koelingen alle tien de
 * dranken. Voor deze combinaties valt er dus niets meer terug op papier — wat
 * niet betekent dat de papieren basis overbodig is: die blijft vastleggen wat
 * de kiosk volgens de bestellijst hoort te hebben, en is de basis zodra een
 * handmatige waarde vervalt.
 *
 * Een paar getallen stonden met een vraagteken genoteerd. Het getal geldt
 * gewoon; de twijfel staat apart in `unconfirmedStandards`.
 */
const LATEST_DRINK_OVERRIDES: Record<string, Record<string, number>> = {
  'kiosk-401': {
    'chaudfontaine-blauw': 25,
    'chaudfontaine-rood': 6,
    'fuze-tea': 25,
    'heineken-00': 12,
    radler: 8,
    'stelz-icetea': 30, // genoteerd als "30 (? Buffer)" — nog te bevestigen
    'bacardi-lemon': 10,
    'jack-daniels': 6,
    redbull: 8,
    'bacardi-cola': 30, // stond eerder met vraagtekens, nu zonder
  },
  'kiosk-403': {
    'chaudfontaine-blauw': 25,
    'chaudfontaine-rood': 6,
    'fuze-tea': 15,
    'heineken-00': 10,
    radler: 8,
    'stelz-icetea': 20,
    'bacardi-lemon': 10,
    'jack-daniels': 6,
    redbull: 8,
    'bacardi-cola': 25,
  },
  'kiosk-407': {
    'chaudfontaine-blauw': 20,
    'chaudfontaine-rood': 6,
    'fuze-tea': 21,
    'heineken-00': 7,
    radler: 7,
    'stelz-icetea': 29, // genoteerd als "29 (? Buffer)" — nog te bevestigen
    'bacardi-lemon': 10,
    'jack-daniels': 8,
    redbull: 8,
    'bacardi-cola': 15,
  },
  'kiosk-410': {
    'chaudfontaine-blauw': 25,
    'chaudfontaine-rood': 8,
    'fuze-tea': 21,
    'heineken-00': 10,
    radler: 7,
    'stelz-icetea': 25,
    'bacardi-lemon': 10,
    'jack-daniels': 8,
    redbull: 9,
    'bacardi-cola': 30,
  },
  'kiosk-416': {
    'chaudfontaine-blauw': 25,
    'chaudfontaine-rood': 6,
    'fuze-tea': 20,
    'heineken-00': 10,
    radler: 10,
    'stelz-icetea': 24,
    'bacardi-lemon': 10,
    'jack-daniels': 6,
    redbull: 10,
    'bacardi-cola': 30, // genoteerd als "30(?)" — nog te bevestigen
  },
  'kiosk-419': {
    'chaudfontaine-blauw': 20,
    'chaudfontaine-rood': 6,
    'fuze-tea': 20,
    'heineken-00': 10,
    radler: 7,
    'stelz-icetea': 15,
    'bacardi-lemon': 10,
    // Een eerdere versie van de handmatige lijst zei hier 6. De nieuwste zegt 8
    // en die is leidend; het papier zegt 5 en blijft de basis eronder.
    'jack-daniels': 8,
    redbull: 10,
    'bacardi-cola': 30,
  },
  'kiosk-420': {
    'chaudfontaine-blauw': 25,
    'chaudfontaine-rood': 8,
    'fuze-tea': 25, // genoteerd als "25(?)" — nog te bevestigen
    'heineken-00': 15,
    radler: 10,
    'stelz-icetea': 25,
    'bacardi-lemon': 12,
    'jack-daniels': 8,
    redbull: 10,
    'bacardi-cola': 20,
  },
  'kiosk-423': {
    'chaudfontaine-blauw': 20,
    'chaudfontaine-rood': 6,
    'fuze-tea': 20,
    'heineken-00': 15, // genoteerd als "15(?)" — nog te bevestigen
    radler: 8,
    'stelz-icetea': 15,
    'bacardi-lemon': 9,
    'jack-daniels': 6,
    redbull: 9,
    'bacardi-cola': 25,
  },
  'kiosk-426': {
    'chaudfontaine-blauw': 25,
    'chaudfontaine-rood': 6,
    'fuze-tea': 28,
    'heineken-00': 15, // genoteerd als "15(?)" — nog te bevestigen
    radler: 10,
    'stelz-icetea': 15,
    'bacardi-lemon': 10,
    'jack-daniels': 8,
    redbull: 8,
    'bacardi-cola': 30,
  },
}

/** De drie bekerformaten, in de volgorde waarin ze op de lijst staan. */
export const CUP_PRODUCT_IDS = ['bierbeker-05', 'bierbeker-04', 'bierbeker-03'] as const

/**
 * De nieuwste handmatige bekerlijst.
 *
 * Los van de dranklijst omdat het een aparte ronde langs de kiosken was, en
 * omdat hij iets doet wat de dranklijst niet doet: een **0 betekent hier dat
 * dat formaat bij die locatie geen actieve norm heeft**. Niet norm nul — dan
 * zou het formaat bij het tellen blijven opduiken met een streefwaarde van
 * niets. `applyStandardOverrides` haalt zo'n product uit de actieve normen.
 *
 * De nullen staan er expliciet in, en dat is het punt: zo blijft zichtbaar dat
 * iemand ernaar gekeken heeft en "niet voeren" bedoelde, in plaats van dat de
 * regel vergeten is.
 *
 * 422 en Ziggo Platform staan niet op deze lijst en houden dus wat ze hadden.
 * Ziggo heeft inmiddels een eigen, nieuwere lijst met alle drie de formaten;
 * die staat apart in `LATEST_ZIGGO_PLATFORM_OVERRIDES`.
 */
const MANUAL_CUP_OVERRIDES: Record<string, Record<string, number>> = {
  'kiosk-401': { 'bierbeker-05': 5, 'bierbeker-04': 4, 'bierbeker-03': 2 },
  'kiosk-402': { 'bierbeker-05': 1, 'bierbeker-04': 1, 'bierbeker-03': 1 },
  'kiosk-403': { 'bierbeker-05': 3, 'bierbeker-04': 3, 'bierbeker-03': 1 },
  'kiosk-404': { 'bierbeker-05': 2, 'bierbeker-04': 2, 'bierbeker-03': 1 },
  'kiosk-406': { 'bierbeker-05': 1, 'bierbeker-04': 2, 'bierbeker-03': 1 },
  'kiosk-406-nieuw': { 'bierbeker-05': 2, 'bierbeker-04': 2, 'bierbeker-03': 1 },
  'kiosk-407': { 'bierbeker-05': 4, 'bierbeker-04': 3, 'bierbeker-03': 2 },
  'kiosk-409': { 'bierbeker-05': 1, 'bierbeker-04': 1, 'bierbeker-03': 1 },
  'kiosk-410': { 'bierbeker-05': 4, 'bierbeker-04': 4, 'bierbeker-03': 2 },
  'kiosk-412': { 'bierbeker-05': 3, 'bierbeker-04': 3, 'bierbeker-03': 0 },
  'kiosk-414': { 'bierbeker-05': 3, 'bierbeker-04': 3, 'bierbeker-03': 0 },
  'kiosk-416': { 'bierbeker-05': 4, 'bierbeker-04': 4, 'bierbeker-03': 2 },
  'kiosk-417': { 'bierbeker-05': 2, 'bierbeker-04': 2, 'bierbeker-03': 1 },
  'kiosk-419': { 'bierbeker-05': 3, 'bierbeker-04': 3, 'bierbeker-03': 1 },
  'kiosk-420': { 'bierbeker-05': 0, 'bierbeker-04': 3, 'bierbeker-03': 1 },
  'kiosk-420-bar': { 'bierbeker-05': 4, 'bierbeker-04': 4, 'bierbeker-03': 2 },
  'kiosk-423': { 'bierbeker-05': 4, 'bierbeker-04': 4, 'bierbeker-03': 1 },
  'kiosk-424': { 'bierbeker-05': 2, 'bierbeker-04': 1, 'bierbeker-03': 1 },
  'kiosk-426': { 'bierbeker-05': 5, 'bierbeker-04': 4, 'bierbeker-03': 2 },
  'kiosk-427': { 'bierbeker-05': 3, 'bierbeker-04': 3, 'bierbeker-03': 0 },
  'kiosk-429': { 'bierbeker-05': 3, 'bierbeker-04': 3, 'bierbeker-03': 0 },
}

/**
 * Bij de bekerlijst stonden ook drie opmerkingen over waar de bekers liggen —
 * "1 doos achter in kiosk". Die zeggen niets over de norm (401 blijft 5 en
 * wordt geen 7) en horen op het scherm van de vuller; ze staan daarom in
 * `src/lib/storageNotes.ts`. Hetzelfde geldt voor de plaatsingsregels bij de
 * chips en de Post-mix.
 */

/** De drie chipssmaken, in de volgorde waarin ze op de lijst staan. */
export const CHIP_PRODUCT_IDS = ['chips-blauw', 'chips-rood', 'chips-oranje'] as const

/**
 * De nieuwste handmatige chipslijst.
 *
 * Eenentwintig locaties, elk met de drie smaken. 422 en Ziggo Platform staan er
 * niet op en houden hun papieren norm; voor Ziggo is er inmiddels een eigen,
 * nieuwere lijst die daar 2/2/2 bevestigt.
 *
 * Anders dan bij de bekers staat hier nergens een 0: de lijst noemt overal een
 * echt aantal, dus er wordt hier niets uitgezet.
 */
const MANUAL_CHIP_OVERRIDES: Record<string, Record<string, number>> = {
  'kiosk-401': { 'chips-blauw': 6, 'chips-rood': 6, 'chips-oranje': 6 },
  'kiosk-402': { 'chips-blauw': 2, 'chips-rood': 2, 'chips-oranje': 2 },
  // Op de bron staat dit blok onder het opschrift "402", direct onder het
  // échte 402 (2/2/2) en vlak vóór 404. 403 kwam op de lijst verder nergens
  // voor. Nagevraagd en bevestigd: het tweede "402" is 403.
  'kiosk-403': { 'chips-blauw': 8, 'chips-rood': 8, 'chips-oranje': 6 },
  'kiosk-404': { 'chips-blauw': 4, 'chips-rood': 4, 'chips-oranje': 4 },
  'kiosk-406': { 'chips-blauw': 5, 'chips-rood': 4, 'chips-oranje': 4 },
  'kiosk-406-nieuw': { 'chips-blauw': 5, 'chips-rood': 4, 'chips-oranje': 4 },
  'kiosk-407': { 'chips-blauw': 5, 'chips-rood': 4, 'chips-oranje': 4 },
  'kiosk-409': { 'chips-blauw': 2, 'chips-rood': 2, 'chips-oranje': 2 },
  'kiosk-410': { 'chips-blauw': 8, 'chips-rood': 6, 'chips-oranje': 6 },
  'kiosk-412': { 'chips-blauw': 3, 'chips-rood': 3, 'chips-oranje': 3 },
  'kiosk-414': { 'chips-blauw': 3, 'chips-rood': 3, 'chips-oranje': 3 },
  'kiosk-416': { 'chips-blauw': 7, 'chips-rood': 6, 'chips-oranje': 6 },
  'kiosk-417': { 'chips-blauw': 5, 'chips-rood': 4, 'chips-oranje': 4 },
  'kiosk-419': { 'chips-blauw': 7, 'chips-rood': 5, 'chips-oranje': 5 },
  'kiosk-420': { 'chips-blauw': 6, 'chips-rood': 6, 'chips-oranje': 6 },
  'kiosk-420-bar': { 'chips-blauw': 10, 'chips-rood': 10, 'chips-oranje': 10 },
  'kiosk-423': { 'chips-blauw': 8, 'chips-rood': 6, 'chips-oranje': 6 },
  'kiosk-424': { 'chips-blauw': 2, 'chips-rood': 2, 'chips-oranje': 2 },
  'kiosk-426': { 'chips-blauw': 6, 'chips-rood': 6, 'chips-oranje': 6 },
  'kiosk-427': { 'chips-blauw': 3, 'chips-rood': 3, 'chips-oranje': 3 },
  'kiosk-429': { 'chips-blauw': 3, 'chips-rood': 3, 'chips-oranje': 3 },
}

/**
 * De Post-mixproducten die in pakken geteld worden.
 *
 * Koolzuur staat er nadrukkelijk niet bij: dat is een cilinder en komt op de
 * nieuwe pakkenlijst nergens voor. Zie `MANUAL_POSTMIX_OVERRIDES`.
 */
export const POSTMIX_PACKAGE_PRODUCT_IDS = [
  'cola',
  'cola-zero',
  'fanta',
  'sprite',
  'fuze-tea-peach-hibiscus',
] as const

/**
 * Hoe Post-mix geteld hoort te worden.
 *
 * De norm hieronder gaat over **reservepakken buiten het rek**. Het pak dat
 * aangesloten zit telt niet mee. Norm 8 met één pak aan de tap en zes volle
 * pakken ernaast levert dus een telling van 6 op, niet 7.
 *
 * De procedure van de bron, in volgorde:
 *
 *   1. Vervang eerst de lege pakken.
 *   2. Staat een aangesloten pak onder de 25%, behandel het dan als leeg en
 *      vervang het ook — vóór er geteld wordt.
 *   3. Tel daarna pas de reservepakken.
 *   4. Vullen gaat altijd FIFO: het oudste pak eerst.
 *
 * Die 25% gaat over het pak aan de tap en over niets anders. Hij verandert de
 * invoer in de app niet: Post-mix wordt in hele pakken geteld
 * (`inputStep = ONE`, `allowPartialPackage = false`), en de globale
 * kwart-/halvepakkenlogica blijft ongemoeid.
 *
 * Staat als telinstructie op het telscherm; zie `src/lib/countingHints.ts`.
 */
export const POSTMIX_COUNTING_RULE = {
  countsReservePackagesOnly: true,
  /** Onder dit percentage geldt een aangesloten pak als leeg. */
  connectedPackageEmptyBelowPct: 25,
  refillOrder: 'FIFO',
} as const

/**
 * De nieuwe handmatige Post-mixlijst: reservepakken buiten het rek.
 *
 * Leidend voor de BIB-pakken van de genoemde locaties. Kiosken die hier niet
 * staan houden wat ze hadden, ook als ze nu een Post-mixnorm voeren — een lijst
 * die over negen locaties gaat zegt niets over de tiende.
 *
 * Twee dingen die deze lijst bewust níet aanraakt:
 *
 *   1. `koolzuur`. Dat is een cilinder, geen pak, en komt op deze lijst
 *      nergens voor. Hij staat daarom niet tussen de sleutels hieronder en
 *      blijft dus gewoon uit de papieren config komen.
 *   2. Andere kiosken. 419 voert geen Post-mix en houdt dat.
 *
 * Post-mix valt buiten de drankregel. Dat alleen een grote koeling de gekoelde
 * dranken telt, zegt niets over de BIB-pakken achter de tap: die staan er
 * gewoon en worden volstrekt normaal vanuit het magazijn aangevuld.
 *
 * "420 Hok" van de bron is de voorraadruimte van kiosk 420 en geen eigen
 * telpunt — er bestaat in de stamdata ook geen aparte locatie met die naam.
 * Het gaat dus naar `kiosk-420`; "420 Bar" (4201) is wél een eigen telpunt en
 * staat apart op de lijst. Dat die pakken in het hok links van de kiosk staan
 * en niet in de kiosk zelf, staat als opslagnotitie in
 * `src/lib/storageNotes.ts` — anders zoekt een teller bij 420 naar acht pakken
 * die daar niet staan.
 */
const MANUAL_POSTMIX_OVERRIDES: Record<string, Record<string, number>> = {
  'kiosk-401': { cola: 4, 'cola-zero': 8, fanta: 4, sprite: 4 },
  'kiosk-404': { cola: 2, 'cola-zero': 4, fanta: 2, sprite: 2 },
  // 406 Oud; de voorraad staat in het hok links van de kiosk, zie storageNotes.
  'kiosk-406': { cola: 2, 'cola-zero': 4, fanta: 2, sprite: 2 },
  'kiosk-407': {
    cola: 1,
    'cola-zero': 2,
    // Fanta staat niet op de nieuwe 407-lijst terwijl die de reservepakken van
    // 407 expliciet opsomt. Een 0 zet de norm dus uit in plaats van hem op nul.
    fanta: 0,
    sprite: 2,
    'fuze-tea-peach-hibiscus': 2,
  },
  'kiosk-410': { cola: 4, 'cola-zero': 8, fanta: 4, sprite: 4 },
  'kiosk-416': { cola: 2, 'cola-zero': 6, fanta: 3, sprite: 3 },
  // "420 Hok": de voorraadruimte van kiosk 420, niet een eigen telpunt.
  'kiosk-420': { cola: 4, 'cola-zero': 8, fanta: 4, sprite: 4 },
  'kiosk-420-bar': { cola: 4, 'cola-zero': 6, fanta: 3, sprite: 3 },
  'kiosk-426': { cola: 4, 'cola-zero': 8, fanta: 4, sprite: 4 },
}

/**
 * De zeven producten van de nieuwste Disposable-stocklijst, in de
 * kolomvolgorde van die lijst.
 *
 * `sixpacks` is het interne id van Biertrays. Het product heet op het scherm en
 * in de database "Biertrays" sinds c83cf53 en migratie 010; het seed-id bleef
 * `sixpacks` zodat elke eerdere telling naar dezelfde rij blijft wijzen. Hier
 * dus geen nieuwe Biertrays-rij.
 */
export const DISPOSABLE_PRODUCT_IDS = [
  'rectangular-bakjes',
  'square-bakjes',
  'patat-bakjes',
  'servetten',
  'sixpacks',
  'patat-vorkjes',
  'arena-blaadjes',
] as const

/**
 * Eén regel van de Disposable-lijst, in de kolomvolgorde van de bron.
 *
 * Zeven vaste posities in plaats van zeven sleutels per regel: dan staat een
 * regel hieronder er net zo bij als op het papier, en is hij regel voor regel
 * na te lopen. De tuple dwingt af dat er ook echt zeven getallen staan — een
 * kolom overslaan schuift anders alle volgende een plaats op.
 */
function disposableRow(
  ...aantallen: [number, number, number, number, number, number, number]
): Record<string, number> {
  return Object.fromEntries(DISPOSABLE_PRODUCT_IDS.map((id, index) => [id, aantallen[index]!]))
}

/**
 * De nieuwste Disposable-stocklijst.
 *
 * Leidend voor deze zeven producten, en voor niets anders. Chips, koffie, Tork,
 * vuilniszakken, drank, bekers en sauzen staan er niet op en veranderen hier
 * dus nergens door — ook niet bij een kiosk die verder wél op deze lijst staat.
 *
 * **Een 0 betekent geen actieve voorraadnorm**, niet norm nul. Rectangular = 0
 * bij 423 wil zeggen dat 423 geen rectangular bakjes voert; `applyStandardOverrides`
 * haalt het product daarmee uit de actieve normen in plaats van er een
 * streefwaarde van niets van te maken. De nullen blijven hier staan omdat ze de
 * bron zijn: zo is te zien dat iemand ernaar gekeken heeft en "niet voeren"
 * bedoelde, in plaats van dat de regel vergeten is.
 *
 * De volgorde van de sleutels is die van de bron en niet die van het
 * kiosknummer. Naast elkaar leggen met het papier is het enige wat een
 * overtypfout in tweeëntwintig regels van zeven getallen echt vindt.
 *
 * 422 staat niet op deze lijst en houdt dus wat het had. 426 staat er wel op,
 * met exact zijn bestaande waarden.
 */
const LATEST_DISPOSABLE_OVERRIDES: Record<string, Record<string, number>> = {
  //                              Rect  Sq  Patat  Servet  Trays  Vorkjes  Arena
  'kiosk-423': /*        423 */ disposableRow(0, 2, 3, 5, 3, 1, 0),
  'kiosk-424': /*        424 */ disposableRow(0, 0, 0, 0, 1, 0, 0),
  'kiosk-426': /*        426 */ disposableRow(2, 0, 0, 5, 3, 0, 1),
  'kiosk-427': /*        427 */ disposableRow(2, 2, 0, 5, 3, 0, 0),
  'kiosk-429': /*        429 */ disposableRow(2, 2, 0, 5, 3, 0, 0),
  'kiosk-401': /*        401 */ disposableRow(2, 0, 0, 5, 3, 0, 1),
  'kiosk-402': /*        402 */ disposableRow(0, 0, 0, 0, 1, 0, 0),
  'kiosk-403': /*        403 */ disposableRow(0, 2, 3, 5, 3, 1, 0),
  'kiosk-404': /*        404 */ disposableRow(2, 0, 0, 5, 3, 1, 1),
  'kiosk-406': /*   406 Oud */ disposableRow(2, 0, 0, 5, 3, 0, 1),
  'kiosk-406-nieuw': /* 406 N */ disposableRow(2, 2, 0, 5, 3, 0, 1),
  'kiosk-407': /*        407 */ disposableRow(0, 2, 3, 5, 3, 1, 1),
  'kiosk-409': /*        409 */ disposableRow(0, 0, 0, 0, 1, 0, 0),
  'kiosk-410': /*        410 */ disposableRow(3, 0, 0, 5, 3, 1, 1),
  'kiosk-412': /*        412 */ disposableRow(2, 2, 0, 5, 3, 0, 0),
  'kiosk-414': /*        414 */ disposableRow(2, 2, 0, 5, 3, 0, 0),
  'kiosk-416': /*        416 */ disposableRow(3, 0, 0, 5, 3, 0, 1),
  'kiosk-417': /*        417 */ disposableRow(2, 0, 0, 5, 3, 0, 1),
  'kiosk-419': /*        419 */ disposableRow(0, 2, 2, 5, 3, 1, 1),
  // Biertrays 3 wordt hieronder door de specifieke Ziggo-lijst op 1 gezet.
  'kiosk-ziggo-platform': /* Ziggo */ disposableRow(0, 0, 0, 0, 3, 0, 0),
  'kiosk-420-bar': /* 420 Bar */ disposableRow(0, 0, 0, 0, 4, 0, 0),
  'kiosk-420': /*        420 */ disposableRow(3, 3, 1, 5, 3, 0, 1),
}

/**
 * De nieuwste GFT-lijst.
 *
 * Acht locaties, één bak per stuk. De bron noemt alleen deze acht, dus krijgt
 * verder niemand een GFT-norm — ook niet een kiosk die er qua assortiment op
 * lijkt. Geteld in hele bakken; zie het product `gft-bak` in de catalogus.
 */
const LATEST_GFT_OVERRIDES: Record<string, Record<string, number>> = {
  'kiosk-401': { 'gft-bak': 1 },
  'kiosk-403': { 'gft-bak': 1 },
  'kiosk-407': { 'gft-bak': 1 },
  'kiosk-410': { 'gft-bak': 1 },
  'kiosk-416': { 'gft-bak': 1 },
  'kiosk-419': { 'gft-bak': 1 },
  'kiosk-420': { 'gft-bak': 1 },
  'kiosk-423': { 'gft-bak': 1 },
}

/**
 * De specifieke stocklijst van Ziggo Platform ("Voorraad 420Ziggo").
 *
 * Hoort bij de bestaande locatie `kiosk-ziggo-platform`; "420 Ziggo" is hoe de
 * bron hem noemt en geen nieuw telpunt.
 *
 * De meest specifieke en nieuwste bron die er voor deze locatie is, en daarmee
 * de sterkste: hij wordt als laatste toegepast en wint dus ook van de algemene
 * Disposable-lijst. Dat verschil is echt en bewust — Disposable zegt hier
 * Biertrays 3, deze lijst zegt 1. Eén doos, want het is een klein platform.
 *
 * Wat deze lijst níet noemt, verandert hij ook niet: Tork en de koffiehoek
 * blijven van papier komen. Weglating is geen deactivering.
 *
 * De tien dranken hieronder zijn echte lokale voorraad en geen
 * assortimentsindicatie van 1. Zie `LOCAL_DRINK_STOCK_KIOSK_KEYS` voor waarom
 * dit telpunt drank voert zonder grote koeling.
 */
const LATEST_ZIGGO_PLATFORM_OVERRIDES: Record<string, Record<string, number>> = {
  'kiosk-ziggo-platform': {
    // "1x heineken small / medium / large" — de drie bierbekerformaten, in
    // dozen.
    'bierbeker-03': 1,
    'bierbeker-04': 1,
    'bierbeker-05': 1,

    'chips-blauw': 2,
    'chips-rood': 2,
    'chips-oranje': 2,

    vuilniszakken: 3,

    // Wint van de Disposable-lijst, die hier 3 zegt.
    sixpacks: 1,

    // Echte lokale drankvoorraad, geteld en aangevuld als elke andere.
    'chaudfontaine-blauw': 1,
    'chaudfontaine-rood': 2,
    'fuze-tea': 2,
    'heineken-00': 1,
    radler: 1,
    'stelz-icetea': 2,
    'bacardi-lemon': 1,
    'jack-daniels': 1,
    redbull: 1,
    'bacardi-cola': 2,

    // Post-mix: reservepakken buiten het rek, in hele pakken.
    cola: 10,
    'cola-zero': 10,
    fanta: 6,
    sprite: 6,
  },
}

/**
 * Legt een handmatige lijst op de papieren basis.
 *
 * Alleen exact dezelfde combinatie kiosk + product wordt overschreven; de rest
 * van de basis blijft ongemoeid. Een override van zes producten wist de andere
 * vier dus niet.
 *
 * Nul is geen norm maar een streep: het product verdwijnt uit de actieve
 * normen. Dat scheelt een categorie fouten waarbij een kiosk een formaat blijft
 * tellen dat hij niet meer voert, met een streefwaarde van nul en dus een
 * eeuwig "compleet".
 */
export function applyStandardOverrides(
  base: Record<string, number>,
  overrides: Record<string, number> = {}
): Record<string, number> {
  const result = { ...base }

  for (const [productId, value] of Object.entries(overrides)) {
    if (value === 0) {
      delete result[productId]
    } else {
      result[productId] = value
    }
  }

  return result
}

/** De papieren dranknormen van één locatie, zonder de latere handmatige lijst. */
export function paperDrinksFor(kioskKey: string): Record<string, number> {
  return { ...(PAPER_DRINKS[kioskKey] ?? {}) }
}

/**
 * De nieuwste handmatige waarden van één locatie.
 *
 * Zeven aparte bronlagen, want het waren zeven aparte rondes langs de kiosken.
 * Ze blijven los zodat bij een fout zichtbaar is wélke lijst hem maakte, en
 * zodat later nog na te lezen valt: papier zei X, de eerdere stocklijst Y, de
 * nieuwste Z.
 *
 * **De volgorde hieronder is de bronprioriteit en is niet vrijblijvend.** De
 * eerste vier gaan over vier verschillende productgroepen en overlappen
 * nergens; GFT staat sowieso alleen. De laatste twee overlappen wél:
 *
 *   · Disposable en de Ziggo-lijst noemen allebei Biertrays bij Ziggo — 3
 *     tegenover 1. De specifiekere lijst staat achteraan en wint dus.
 *   · De Ziggo-lijst noemt ook bekers, chips en Post-mix, en wint daar van de
 *     eerdere algemene lijsten.
 *
 * Een test legt die 3-tegen-1 vast, zodat een latere herschikking van deze
 * volgorde niet stilletjes 3 teruggeeft.
 */
export function latestOverridesFor(kioskKey: string): Record<string, number> {
  return {
    ...LATEST_DRINK_OVERRIDES[kioskKey],
    ...MANUAL_CUP_OVERRIDES[kioskKey],
    ...MANUAL_CHIP_OVERRIDES[kioskKey],
    ...MANUAL_POSTMIX_OVERRIDES[kioskKey],
    ...LATEST_GFT_OVERRIDES[kioskKey],
    ...LATEST_DISPOSABLE_OVERRIDES[kioskKey],
    ...LATEST_ZIGGO_PLATFORM_OVERRIDES[kioskKey],
  }
}

/**
 * Waarden die op de nieuwste handmatige lijst een vraagteken hadden.
 *
 * Het getal geldt gewoon als norm; dit zegt alleen dat het nog niet bevestigd
 * is. Bewust geen databasekolom: dit gaat over ons vertrouwen in een getal, niet
 * over de voorraad, en het is over een paar weken achterhaald.
 *
 * Wat hier níet meer in staat: 401 Bacardi Cola. Dat getal stond eerder met
 * vraagtekens genoteerd en op de nieuwe lijst zonder — de twijfel is dus
 * opgelost, ook al bleef de 30 hetzelfde.
 */
export const unconfirmedStandards: ReadonlyArray<{
  kioskKey: string
  productId: string
  reason: string
}> = [
  { kioskKey: 'kiosk-401', productId: 'stelz-icetea', reason: 'genoteerd als "30 (? Buffer)"' },
  { kioskKey: 'kiosk-407', productId: 'stelz-icetea', reason: 'genoteerd als "29 (? Buffer)"' },
  { kioskKey: 'kiosk-416', productId: 'bacardi-cola', reason: 'genoteerd als "30(?)"' },
  { kioskKey: 'kiosk-420', productId: 'fuze-tea', reason: 'genoteerd als "25(?)"' },
  { kioskKey: 'kiosk-423', productId: 'heineken-00', reason: 'genoteerd als "15(?)"' },
  { kioskKey: 'kiosk-426', productId: 'heineken-00', reason: 'genoteerd als "15(?)"' },
]


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

/**
 * De lijsten zoals ze op papier staan.
 *
 * Alles hier komt van de papieren bestellijst per kiosk — ook de bekers, ook
 * waar een latere handmatige lijst er overheen gaat. `secondRingStandards`
 * hieronder legt die handmatige waarden erop; dit blijft staan zodat van elk
 * getal te zien is waar het vandaan komt.
 */
const PAPER_STANDARDS: KioskStandardConfig[] = [
  {
    kioskKey: 'kiosk-401',
    drinkStorageType: DrinkStorageType.LARGE_COOLER,
    standards: {
      'bierbeker-05': 5,
      'bierbeker-04': 4,
      ...paperDrinksFor('kiosk-401'),
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
      ...paperDrinksFor('kiosk-403'),
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
      ...paperDrinksFor('kiosk-407'),
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
      ...paperDrinksFor('kiosk-410'),
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
      ...paperDrinksFor('kiosk-416'),
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
      ...paperDrinksFor('kiosk-419'),
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
      ...paperDrinksFor('kiosk-420'),
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
    // Een tappunt zonder koeling. Er stond hier drank met norm 2, maar die
    // wordt op de bar niet uit voorraad geteld; alleen een grote koeling doet
    // dat. Wat er wél ligt — bekers, chips, Post-mix, trays, schoonmaak —
    // blijft gewoon staan.
    kioskKey: 'kiosk-420-bar',
    drinkStorageType: DrinkStorageType.SMALL_BAR,
    standards: {
      'bierbeker-05': 4,
      'bierbeker-04': 3,
      'bierbeker-03': 2,
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
      ...paperDrinksFor('kiosk-423'),
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
      ...paperDrinksFor('kiosk-426'),
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
    // Caprisun stond hier als gewone voorraad, maar valt onder Drank en wordt
    // dus alleen nog geteld waar het echt ligt. Op de nieuwste Ziggo-lijst komt
    // het niet voor en het krijgt dus geen norm terug.
    //
    // Dit is de papieren basis. `LATEST_ZIGGO_PLATFORM_OVERRIDES` legt daar de
    // specifieke stocklijst overheen: bekers, chips, vuilniszakken, Biertrays,
    // tien dranken en de Post-mix. Tork blijft van hier komen.
    kioskKey: 'kiosk-ziggo-platform',
    drinkStorageType: DrinkStorageType.SATELLITE,
    standards: {
      'bierbeker-05': 1,
      'bierbeker-04': 1,
      'chips-blauw': 2,
      'chips-rood': 2,
      'chips-oranje': 2,
      cola: 2,
      'cola-zero': 2,
      fanta: 2,
      sprite: 2,
      sixpacks: 3,
      'tork-rol': 6,
      vuilniszakken: 1,
    },
  },
]

/** De papieren normen van één locatie, zonder de latere handmatige lijsten. */
export function paperStandardsFor(kioskKey: string): Record<string, number> {
  return { ...PAPER_STANDARDS.find((config) => config.kioskKey === kioskKey)?.standards }
}

/**
 * De normen zoals ze werkelijk gelden.
 *
 * De papieren lijst met daarop alle nieuwste handmatige waarden: drank, bekers,
 * chips en Post-mix uit de eerdere stocklijsten, de zeven verpakkingsproducten
 * uit de Disposable-lijst, de GFT-bakken, en bovenop dat alles de specifieke
 * Ziggo Platform-lijst. Producten die op geen enkele lijst staan houden hun
 * papieren norm; een product dat op een lijst een expliciete 0 heeft, verdwijnt
 * hier uit de actieve normen.
 */
export const secondRingStandards: KioskStandardConfig[] = PAPER_STANDARDS.map((config) => ({
  ...config,
  keepsOwnDrinkStock: LOCAL_DRINK_STOCK_KIOSK_KEYS.has(config.kioskKey),
  standards: applyStandardOverrides(config.standards, latestOverridesFor(config.kioskKey)),
}))

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
