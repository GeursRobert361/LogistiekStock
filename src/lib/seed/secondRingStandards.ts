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
 * Bronprioriteit voor een voorraadnorm:
 *
 *   1. De nieuwste handmatige lijst, maar uitsluitend voor de combinaties
 *      kiosk + product die daarin met name genoemd worden. Er zijn er vier:
 *      de bijgewerkte drankstocklijst, de bekerlijst, de chipslijst en de
 *      Post-mixlijst.
 *   2. De kolom "Standaard" van de papieren bestellijst van diezelfde kiosk.
 *   3. Geen actieve norm.
 *
 * Alles wat op geen enkele handmatige lijst staat — koffie, verpakkingen,
 * sauzen, schoonmaak, en de koolzuurcilinders — komt dus onveranderd van
 * papier.
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
 * Twintig locaties, elk met de drie smaken. Wat er niet op staat — 403, 422 en
 * Ziggo Platform — houdt zijn papieren norm; zie `chipsSourceWarning` voor
 * waarom 403 ontbreekt.
 *
 * Anders dan bij de bekers staat hier nergens een 0: de lijst noemt overal een
 * echt aantal, dus er wordt hier niets uitgezet.
 */
const MANUAL_CHIP_OVERRIDES: Record<string, Record<string, number>> = {
  'kiosk-401': { 'chips-blauw': 6, 'chips-rood': 6, 'chips-oranje': 6 },
  'kiosk-402': { 'chips-blauw': 2, 'chips-rood': 2, 'chips-oranje': 2 },
  // 403 ontbreekt bewust — zie chipsSourceWarning.
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

export interface SourceWarning {
  /** Waar in de bron het misgaat, in gewone taal. */
  source: string
  message: string
  /** Wat er nodig is om dit op te lossen. */
  resolution: string
}

/**
 * Onopgeloste dubbelzinnigheid in de chipslijst.
 *
 * De bron noemt na kiosk 402 (2/2/2) een tweede blok dat óók "402" heet, met
 * 8/8/6, en gaat daarna verder met 404. Kiosk 403 komt op de hele lijst niet
 * voor. Dat ziet er sterk uit als een verschrijving voor 403 — maar "ziet eruit
 * als" is geen bron.
 *
 * Waarom dit niet stilzwijgend wordt aangenomen: 8/8/6 op 403 zetten kost bij
 * een vergissing elk evenement drie dozen chips die niemand heeft besteld, en
 * het is achteraf niet meer te zien dat het geraden was. 403 houdt daarom zijn
 * papieren 6/5/5 tot iemand de lijst naleest.
 */
export const chipsSourceWarning: SourceWarning = {
  source: 'handmatige chipslijst',
  message:
    'De lijst noemt twee keer kiosk 402: eerst 2/2/2, verderop 8/8/6. ' +
    'Kiosk 403 ontbreekt volledig.',
  resolution:
    'Laat nakijken of het tweede blok 403 hoort te zijn. Tot die tijd houdt 403 ' +
    'zijn papieren norm (6/5/5) en blijft 402 op 2/2/2 staan.',
}

/** De bronwaarschuwingen die nog openstaan. */
export const sourceWarnings: ReadonlyArray<SourceWarning> = [chipsSourceWarning]

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
 * De satelliet-drankuitzondering geldt hier niet: Post-mix wordt bij een
 * satelliet volstrekt normaal vanuit het magazijn aangevuld. Zie
 * `shouldGenerateCentralRestock`.
 *
 * "420 Hok" van de bron is de voorraadruimte van kiosk 420 en geen eigen
 * telpunt — er bestaat in de stamdata ook geen aparte locatie met die naam.
 * Het gaat dus naar `kiosk-420`; "420 Bar" (4201) is wél een eigen telpunt en
 * staat apart op de lijst.
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
 * De nieuwste handmatige waarden van één locatie: drank, bekers, chips en
 * Post-mix.
 *
 * De vier lijsten gaan over vier verschillende productgroepen en overlappen
 * dus nergens; de volgorde van samenvoegen maakt hier niets uit. Ze staan apart
 * omdat het vier aparte rondes langs de kiosken waren, en omdat bij een fout in
 * één lijst zichtbaar moet blijven welke dat was.
 */
export function latestOverridesFor(kioskKey: string): Record<string, number> {
  return {
    ...LATEST_DRINK_OVERRIDES[kioskKey],
    ...MANUAL_CUP_OVERRIDES[kioskKey],
    ...MANUAL_CHIP_OVERRIDES[kioskKey],
    ...MANUAL_POSTMIX_OVERRIDES[kioskKey],
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

/** De papieren normen van één locatie, zonder de latere handmatige lijsten. */
export function paperStandardsFor(kioskKey: string): Record<string, number> {
  return { ...PAPER_STANDARDS.find((config) => config.kioskKey === kioskKey)?.standards }
}

/**
 * De normen zoals ze werkelijk gelden.
 *
 * De papieren lijst met daarop de nieuwste handmatige waarden: drank uit de
 * bijgewerkte stocklijst, bekers uit de bekerlijst, chips uit de chipslijst en
 * de reservepakken uit de Post-mixlijst. Producten die op geen van die vier
 * lijsten staan houden hun papieren norm; een product dat op een lijst een 0
 * heeft, verdwijnt hier uit de actieve normen.
 */
export const secondRingStandards: KioskStandardConfig[] = PAPER_STANDARDS.map((config) => ({
  ...config,
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
