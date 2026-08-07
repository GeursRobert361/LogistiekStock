import type {
  UserRole,
  EventStatus,
  EventType,
  CountSessionStatus,
  KioskCountStatus,
  RoundType,
  ProductSize,
  InputStep,
  RouteDirection,
  RestockRoundStatus,
  RestockRoundType,
  IncidentStatus,
  IncidentUrgency,
  IncidentCategory,
  FractionRule,
  SyncStatus,
  DeliveryReason,
  AuditAction,
} from './enums'

// ─── User / Auth ─────────────────────────────────────────────────────────────

export interface Profile {
  id: string
  email: string
  displayName: string
  avatarUrl?: string
  roles: UserRole[]
  isActive: boolean
  createdAt: string
  updatedAt: string
}

// ─── Ring ────────────────────────────────────────────────────────────────────

export interface Ring {
  id: string
  name: string
  description?: string
  isActive: boolean
  sortOrder: number
  /** Kiosk waar een telronde standaard begint — waar je de lift uitkomt. */
  countStartKioskId?: string
  /** Kiosk waar een vulronde standaard begint. */
  restockStartKioskId?: string
  createdAt: string
  updatedAt: string
}

// ─── Kiosk ───────────────────────────────────────────────────────────────────

export interface Kiosk {
  id: string
  ringId: string
  number: number
  name?: string
  /** Wat de vloer dit telpunt noemt, als dat niet gewoon het nummer is. */
  label?: string
  sortOrder: number
  isActive: boolean
  location?: string
  notes?: string
  createdAt: string
  updatedAt: string
}

/** Kiosk with ring loaded */
export interface KioskWithRing extends Kiosk {
  ring: Ring
}

// ─── Product ─────────────────────────────────────────────────────────────────

export interface ProductCategory {
  id: string
  name: string
  sortOrder: number
  isActive: boolean
}

export interface Product {
  id: string
  categoryId: string
  name: string
  shortName: string
  countUnit: string
  packagingUnit: string
  sortOrder: number
  isActive: boolean
  inputStep: InputStep
  allowPartialPackage: boolean
  roundType: RoundType
  productSize: ProductSize
  estimatedPalletLoad: number
  ownRoundThreshold: number
  priority: number
  storageLocation?: string
  refrigerated: boolean
  notes?: string
  /**
   * Verwijderd: het product verdwijnt uit alle lijsten, maar de rij blijft
   * bestaan zodat eerdere tellingen en leveringen leesbaar blijven.
   */
  deletedAt?: string
  createdAt: string
  updatedAt: string
}

export interface ProductWithCategory extends Product {
  category: ProductCategory
}

// ─── Kiosk Product Standard (voorraadnorm) ───────────────────────────────────

export interface KioskProductStandard {
  id: string
  kioskId: string
  productId: string
  /** target quantity in quarter units */
  targetQuantityQuarters: number
  /** custom 80% threshold, defaults to 80 */
  halfPackageThresholdPercentage: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface KioskProductStandardWithDetails extends KioskProductStandard {
  kiosk: Kiosk
  product: Product
}

// ─── Event ───────────────────────────────────────────────────────────────────

/**
 * Eén regel uit de evenementenagenda: wat er op de kalender staat, nog zonder
 * ringen, kiosken of telronde. Bij het aanmaken van een evenement wordt hieruit
 * gekozen, zodat naam en datum niet elke keer overgetypt hoeven te worden.
 */
export interface AgendaEntry {
  id: string
  name: string
  date: string
  eventType: EventType
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface Event {
  id: string
  name: string
  date: string
  eventType: EventType
  status: EventStatus
  /**
   * Het evenement dat hiervoor kwam.
   *
   * Wat er tijdens een evenement verbruikt is, blijkt pas uit de telling vóór
   * het volgende: wat er stond, plus wat erbij is gevuld, min wat er daarna nog
   * ligt. Zonder die ketting is verbruik niet te berekenen.
   */
  previousEventId?: string
  notes?: string
  activeRingIds: string[]
  activeKioskIds: string[]
  assignedUserIds: string[]
  createdById: string
  createdAt: string
  updatedAt: string
}

// ─── Count Session ────────────────────────────────────────────────────────────

export interface CountSession {
  id: string
  userId: string
  eventId: string
  ringId: string
  startKioskId: string
  direction: RouteDirection
  /** ordered kiosk IDs representing the route */
  kioskRoute: string[]
  startedAt: string
  completedAt?: string
  status: CountSessionStatus
  syncStatus: SyncStatus
  createdAt: string
  updatedAt: string
}

export interface KioskCount {
  id: string
  countSessionId: string
  kioskId: string
  startedAt?: string
  completedAt?: string
  counterId: string
  generalNotes?: string
  status: KioskCountStatus
  skipReason?: string
  createdAt: string
  updatedAt: string
}

export interface CountEntry {
  id: string
  kioskCountId: string
  productId: string
  /** from the norm at time of counting, in quarter units */
  targetQuantityQuarters: number
  /** in quarter units */
  countedQuantityQuarters: number
  /** computed effective quantity in quarter units */
  effectiveQuantityQuarters: number
  /** whole packages to restock */
  restockQuantityPackages: number
  appliedFractionRule: FractionRule
  notes?: string
  lastModifiedAt: string
  lastModifiedById: string
}

// ─── Restock ──────────────────────────────────────────────────────────────────

export interface RestockRequirement {
  id: string
  eventId: string
  kioskId: string
  productId: string
  /** packages needed */
  requiredPackages: number
  /** packages reserved (claimed by a round) */
  reservedPackages: number
  /** packages actually delivered */
  deliveredPackages: number
  createdAt: string
  updatedAt: string
}

export interface RestockRound {
  id: string
  eventId: string
  ringId: string
  name: string
  /** PRODUCT_ROUND = één product, MIXED_PALLET = meerdere producten op één pallet */
  roundType: RestockRoundType
  status: RestockRoundStatus
  createdById: string
  assignedUserId?: string
  claimedAt?: string
  startedAt?: string
  completedAt?: string
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface RestockRoundItem {
  id: string
  restockRoundId: string
  productId: string
  /** one product per PRODUCT_ROUND, multiple for MIXED_PALLET */
  proposedPackages: number
  loadedPackages: number
  deliveredPackages: number
  createdAt: string
  updatedAt: string
}

export interface RestockRoundStop {
  id: string
  restockRoundId: string
  kioskId: string
  sortOrder: number
  completedAt?: string
  notes?: string
  skipReason?: string
}

/**
 * Wat er bij één halte van één product geleverd moet worden.
 *
 * De verdeling van de geladen hoeveelheid over de kiosken ligt hiermee vast,
 * zodat het te leveren aantal per kiosk niet verschuift zodra er onderweg al
 * iets is afgeleverd.
 */
export interface RestockStopItem {
  id: string
  restockRoundStopId: string
  productId: string
  /** Behoefte waar deze levering op afboekt. */
  restockRequirementId?: string
  plannedPackages: number
  createdAt: string
}

export interface RestockDelivery {
  id: string
  restockRoundStopId: string
  productId: string
  plannedPackages: number
  deliveredPackages: number
  notDeliveredPackages: number
  reason?: DeliveryReason
  reasonNotes?: string
  deliveredAt?: string
  deliveredById: string
  createdAt: string
}

export interface StockReservation {
  id: string
  restockRequirementId: string
  restockRoundId: string
  reservedPackages: number
  createdAt: string
}

// ─── Incidents ────────────────────────────────────────────────────────────────

export interface Incident {
  id: string
  eventId: string
  kioskId: string
  category: IncidentCategory
  description: string
  urgency: IncidentUrgency
  photoUrl?: string
  reportedById: string
  reportedAt: string
  status: IncidentStatus
  assignedToId?: string
  resolution?: string
  resolvedAt?: string
  createdAt: string
  updatedAt: string
}

// ─── Audit ────────────────────────────────────────────────────────────────────

export interface AuditLog {
  id: string
  userId: string
  occurredAt: string
  entityType: string
  entityId: string
  action: AuditAction
  oldValue?: unknown
  newValue?: unknown
}

// ─── Sync / Offline ──────────────────────────────────────────────────────────

export interface SyncConflict {
  id: string
  entityType: string
  entityId: string
  localVersion: unknown
  serverVersion: unknown
  detectedAt: string
  resolvedAt?: string
  resolvedBy?: string
}

export interface OutboxEntry {
  id: string
  entityType: string
  entityId: string
  operation: 'create' | 'update' | 'delete'
  payload: unknown
  createdAt: string
  attempts: number
  lastAttemptAt?: string
  error?: string
  /**
   * Wanneer deze mutatie opnieuw geprobeerd mag worden. Loopt op bij elke
   * mislukking, zodat een lange storing niet elke seconde het netwerk belast.
   */
  nextAttemptAt?: string
  /**
   * Gezet wanneer opnieuw proberen zinloos is: de server heeft de mutatie
   * geweigerd (geen rechten, ongeldig verzoek). Alleen dán stopt de app met
   * proberen — bij netwerk- of serverfouten blijft hij het proberen.
   */
  isPermanent?: boolean
  /**
   * Loopt op bij elke nieuwe mutatie op dezelfde entiteit.
   *
   * Een mutatie die tijdens het verzenden wordt overschreven mag niet worden
   * opgeruimd als de oude verzending slaagt: dan zou de nieuwste waarde de
   * server nooit bereiken en toch uit de outbox verdwijnen.
   */
  revision?: number
}

// ─── Route Calculation ────────────────────────────────────────────────────────

export interface GenerateCircularKioskRouteInput {
  kiosks: Array<{
    id: string
    sortOrder: number
    isActive: boolean
    isOpenForEvent?: boolean
  }>
  startKioskId: string
  direction: RouteDirection
}

// ─── Restock Calculation ──────────────────────────────────────────────────────

export interface RestockCalculationInput {
  targetQuantity: number
  countedQuantity: number
  halfPackageThresholdPercentage?: number
}

export interface RestockCalculationResult {
  targetQuantity: number
  countedQuantity: number
  effectiveQuantity: number
  restockQuantity: number
  appliedFractionRule: FractionRule
}
