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
