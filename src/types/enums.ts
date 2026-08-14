export enum UserRole {
  ADMIN = 'ADMIN',
  PLANNER = 'PLANNER',
  TELLER = 'TELLER',
  VULLER = 'VULLER',
}

export enum EventStatus {
  DRAFT = 'DRAFT',
  READY_FOR_COUNTING = 'READY_FOR_COUNTING',
  COUNTING = 'COUNTING',
  COUNT_REVIEW = 'COUNT_REVIEW',
  READY_FOR_RESTOCK = 'READY_FOR_RESTOCK',
  RESTOCKING = 'RESTOCKING',
  COMPLETED = 'COMPLETED',
  ARCHIVED = 'ARCHIVED',
}

export enum EventType {
  VOETBAL = 'VOETBAL',
  CONCERT = 'CONCERT',
  OVERIG = 'OVERIG',
}

export enum CountSessionStatus {
  NOT_STARTED = 'NOT_STARTED',
  IN_PROGRESS = 'IN_PROGRESS',
  PAUSED = 'PAUSED',
  SUBMITTED = 'SUBMITTED',
  APPROVED = 'APPROVED',
  REOPENED = 'REOPENED',
}

export enum KioskCountStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  SKIPPED = 'SKIPPED',
}

export enum RoundType {
  PRODUCT_ROUND = 'PRODUCT_ROUND',
  MIXED_PALLET = 'MIXED_PALLET',
  AUTO = 'AUTO',
}

export enum ProductSize {
  SMALL = 'SMALL',
  MEDIUM = 'MEDIUM',
  LARGE = 'LARGE',
}

export enum InputStep {
  ONE = 1,
  HALF = 0.5,
  QUARTER = 0.25,
}

export enum RouteDirection {
  ASCENDING = 'ascending',
  DESCENDING = 'descending',
}

export enum PalletStatus {
  DRAFT = 'DRAFT',
  PICKING = 'PICKING',
  READY = 'READY',
  CLAIMED = 'CLAIMED',
  IN_PROGRESS = 'IN_PROGRESS',
  PARTIALLY_COMPLETED = 'PARTIALLY_COMPLETED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

/** Soort vulronde. Los van `RoundType`, dat een productvoorkeur uitdrukt. */
export enum RestockRoundType {
  PRODUCT_ROUND = 'PRODUCT_ROUND',
  MIXED_PALLET = 'MIXED_PALLET',
}

export enum RestockRoundStatus {
  DRAFT = 'DRAFT',
  PICKING = 'PICKING',
  READY = 'READY',
  CLAIMED = 'CLAIMED',
  IN_PROGRESS = 'IN_PROGRESS',
  PARTIALLY_COMPLETED = 'PARTIALLY_COMPLETED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum IncidentStatus {
  OPEN = 'OPEN',
  ACKNOWLEDGED = 'ACKNOWLEDGED',
  IN_PROGRESS = 'IN_PROGRESS',
  RESOLVED = 'RESOLVED',
  CLOSED = 'CLOSED',
}

export enum IncidentUrgency {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  KIOSK_UNUSABLE = 'kiosk_onbruikbaar',
}

export enum IncidentCategory {
  BIERTAP = 'biertap',
  POSTMIX = 'post-mix',
  KOELCEL = 'koelcel',
  VERLICHTING = 'verlichting',
  KASSA = 'kassa',
  WATER = 'water',
  ELEKTRICITEIT = 'elektriciteit',
  ANDERS = 'anders',
}

export enum FractionRule {
  NONE = 'NONE',
  QUARTER_DOWN = 'QUARTER_DOWN',
  HALF_DOWN = 'HALF_DOWN',
  HALF_UP = 'HALF_UP',
  THREE_QUARTER_UP = 'THREE_QUARTER_UP',
}

/**
 * Hoe een aangebroken verpakking meetelt voor het bijvuladvies.
 *
 * Niet elk product breekt hetzelfde af. Bij het meeste geldt de algemene regel;
 * bij een enkel product weet de vloer beter wanneer een aangebroken doos
 * praktisch leeg is.
 */
export enum FractionStrategy {
  /** De algemene regel: .25 omlaag, .75 omhoog, .50 volgens de 80%-drempel. */
  STANDARD = 'STANDARD',
  /**
   * Aangebroken telt pas mee vanaf driekwart: .25 en .50 omlaag, .75 omhoog.
   *
   * Voor dozen waar de restanten in de praktijk niet toereikend zijn: een halve
   * doos biertrays is tijdens een evenement zo weg, dus wie daarop rekent staat
   * met lege handen.
   */
  BREAK_AT_THREE_QUARTER = 'BREAK_AT_THREE_QUARTER',
  /**
   * Aangebroken telt als vol: .25 omlaag, .50 en .75 omhoog.
   *
   * Het spiegelbeeld van hierboven, voor voorraad waar een aangebroken
   * verpakking gewoon meegaat en niet vervangen hoeft te worden. Opschuimmelk
   * met een norm van één doosje: pas onder de helft komt er een nieuw doosje
   * bij. Onder de algemene 80%-regel zou een half doosje bij norm 1 altijd
   * omlaag afronden — nul hele verpakkingen haalt die drempel nooit — en dan
   * krijgt elke kiosk elke ronde een doosje dat hij niet nodig heeft.
   */
  HALF_COUNTS_FULL = 'HALF_COUNTS_FULL',
}

export enum SyncStatus {
  LOCAL = 'LOCAL',
  SYNCING = 'SYNCING',
  SYNCED = 'SYNCED',
  ERROR = 'ERROR',
  CONFLICT = 'CONFLICT',
}

export enum DeliveryReason {
  ONVOLDOENDE_VOORRAAD = 'onvoldoende_magazijnvoorraad',
  NIET_OP_PALLET = 'niet_op_pallet',
  KIOSK_ONBEREIKBAAR = 'kiosk_niet_bereikbaar',
  VERKEERDE_TELLING = 'verkeerde_telling',
  AL_AANWEZIG = 'product_al_aanwezig',
  BESCHADIGD = 'beschadigd_product',
  ANDERE_REDEN = 'andere_reden',
}

export enum AuditAction {
  TELLING_GEWIJZIGD = 'telling_gewijzigd',
  NORM_GEWIJZIGD = 'norm_gewijzigd',
  KIOSK_AFGEROND = 'kiosk_afgerond',
  KIOSK_HEROPEND = 'kiosk_heropend',
  TELLING_GOEDGEKEURD = 'telling_goedgekeurd',
  PALLET_AANGEMAAKT = 'pallet_aangemaakt',
  GELADEN_AANGEPAST = 'geladen_aangepast',
  LEVERING_GEREGISTREERD = 'levering_geregistreerd',
  STORING_GEWIJZIGD = 'storing_gewijzigd',
  EVENEMENT_AFGESLOTEN = 'evenement_afgesloten',
}

/**
 * Hoe een telpunt zijn drank opslaat.
 *
 * Bepaalt of een dranktekort door het centrale magazijn moet worden
 * aangevuld. Een satelliet verkoopt drank maar heeft geen buffer: die haalt
 * tijdens het evenement bij uit een grote kiosk, dus een tekort daar is geen
 * magazijnwerk. Bij de andere types is het dat wel.
 */
export enum DrinkStorageType {
  /** Grote koeling; de dranknorm is echte buffervoorraad. */
  LARGE_COOLER = 'LARGE_COOLER',
  /** Geen buffer; gewone drank komt uit een grote kiosk in de buurt. */
  SATELLITE = 'SATELLITE',
  /** Eigen kleine voorraad, wél centraal aan te vullen. */
  SMALL_BAR = 'SMALL_BAR',
  /** Geen normale drankvoorraad. */
  NONE = 'NONE',
}

export const DRINK_STORAGE_LABEL: Record<DrinkStorageType, string> = {
  [DrinkStorageType.LARGE_COOLER]: 'Grote koeling',
  [DrinkStorageType.SATELLITE]: 'Satelliet',
  [DrinkStorageType.SMALL_BAR]: 'Kleine bar',
  [DrinkStorageType.NONE]: 'Geen drankvoorraad',
}
