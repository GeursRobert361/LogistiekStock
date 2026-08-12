/**
 * Vertaling tussen Postgres-rijen (snake_case) en domeintypes (camelCase).
 * Alles op één plek, zodat de repositories vrij blijven van veldnamen.
 */
import type {
  AgendaEntry,
  Ring,
  Kiosk,
  ProductCategory,
  Product,
  KioskProductStandard,
  Event,
  CountSession,
  KioskCount,
  CountEntry,
  RestockRequirement,
  RestockRound,
  RestockRoundItem,
  RestockRoundStop,
  RestockStopItem,
  RestockDelivery,
  StockReservation,
  Incident,
  Profile,
} from '@/types'
import {
  EventStatus,
  EventType,
  CountSessionStatus,
  KioskCountStatus,
  RouteDirection,
  SyncStatus,
  FractionRule,
  RoundType,
  ProductSize,
  InputStep,
  RestockRoundStatus,
  RestockRoundType,
  IncidentStatus,
  IncidentUrgency,
  IncidentCategory,
  DeliveryReason,
  UserRole,
  DrinkStorageType,
} from '@/types'

type Row = Record<string, unknown>

/**
 * Tekstwaarde uit een rij.
 *
 * node-postgres geeft tijdstempels als Date terug. `String(date)` levert dan
 * "Sat Sep 05 2026 00:00:00 GMT+0000" op — leesbaar, maar waardeloos om op te
 * sorteren of te vergelijken. De domeintypes gaan uit van ISO-tekst, dus dat
 * maken we er hier van.
 */
const str = (value: unknown): string => {
  if (value instanceof Date) return value.toISOString()
  return typeof value === 'string' ? value : String(value ?? '')
}

/**
 * Een `date`-kolom als yyyy-mm-dd.
 *
 * Zonder tijd erbij: een wedstrijddatum is een dag, geen moment. Bewust de
 * lokale onderdelen en niet toISOString(), want die schuift een datum die om
 * middernacht staat een dag terug zodra de server niet op UTC staat.
 */
const dateStr = (value: unknown): string => {
  if (value instanceof Date) {
    const month = String(value.getMonth() + 1).padStart(2, '0')
    const day = String(value.getDate()).padStart(2, '0')
    return `${value.getFullYear()}-${month}-${day}`
  }
  return typeof value === 'string' ? value.slice(0, 10) : ''
}
/**
 * Hetzelfde als `str`, maar leeg blijft leeg.
 *
 * Ook hier via `str` en niet via `String()`: de meeste optionele kolommen zijn
 * tijdstempels, en `String(date)` maakt daar "Fri Aug 07 2026 16:34:31 GMT+0000
 * (Coordinated Universal Time)" van. De client bewaart dat, schrijft het later
 * terug, en dan weigert Postgres het — waarna de telling niet meer weg te
 * schrijven is.
 */
const optStr = (value: unknown): string | undefined =>
  value === null || value === undefined ? undefined : str(value)
const num = (value: unknown): number => (typeof value === 'number' ? value : Number(value ?? 0))
const bool = (value: unknown): boolean => value === true

/**
 * Waarde voor een timestamptz-kolom.
 *
 * Wat er binnenkomt hoort ISO te zijn, maar dat was het een tijd lang niet: de
 * server gaf optionele tijdstempels terug als "Fri Aug 07 2026 16:34:31
 * GMT+0000 (Coordinated Universal Time)", en die tekst staat nu in de
 * offline-opslag van iedereen die in die periode heeft geteld. Bij het
 * terugschrijven weigert Postgres hem, en dan blijft die telling voorgoed in de
 * wachtrij staan.
 *
 * Alles wat als datum te lezen is gaat er daarom als ISO in. Onleesbare tekst
 * laten we staan: dan hoort de database te klagen in plaats van dat wij er stil
 * iets van maken.
 */
const toTimestamp = (value: unknown): unknown => {
  if (value instanceof Date) return value.toISOString()
  if (typeof value !== 'string' || value === '') return value

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString()
}

/**
 * Waarde voor een jsonb-kolom.
 *
 * Een JavaScript-array wordt door de databasedriver omgezet naar een Postgres
 * array (`{a,b}`), niet naar JSON (`["a","b"]`). Voor een jsonb-kolom levert
 * dat "invalid input syntax for type json" op. Zelf serialiseren dus.
 */
const toJsonb = (value: unknown): string => JSON.stringify(value)

/** Leest een jsonb-kolom uit; de driver geeft die al geparsed terug. */
function jsonArray(value: unknown): string[] {
  if (Array.isArray(value)) return value as string[]
  if (typeof value === 'string') {
    try {
      const parsed: unknown = JSON.parse(value)
      return Array.isArray(parsed) ? (parsed as string[]) : []
    } catch {
      return []
    }
  }
  return []
}

function parseInputStep(value: unknown): InputStep {
  const parsed = Number(value)
  if (parsed === 0.25) return InputStep.QUARTER
  if (parsed === 0.5) return InputStep.HALF
  return InputStep.ONE
}

// ─── Profile ────────────────────────────────────────────────────────────────

export function mapProfile(row: Row, roles: UserRole[]): Profile {
  return {
    id: str(row.id),
    email: str(row.email),
    displayName: str(row.display_name),
    avatarUrl: optStr(row.avatar_url),
    roles,
    isActive: bool(row.is_active),
    createdAt: str(row.created_at),
    updatedAt: str(row.updated_at),
  }
}

// ─── Ring / Kiosk ───────────────────────────────────────────────────────────

export function mapRing(row: Row): Ring {
  return {
    id: str(row.id),
    name: str(row.name),
    description: optStr(row.description),
    isActive: bool(row.is_active),
    sortOrder: num(row.sort_order),
    countStartKioskId: optStr(row.count_start_kiosk_id),
    restockStartKioskId: optStr(row.restock_start_kiosk_id),
    createdAt: str(row.created_at),
    updatedAt: str(row.updated_at),
  }
}

export function ringToRow(data: Partial<Ring>): Row {
  const row: Row = {}
  if (data.name !== undefined) row.name = data.name
  if (data.description !== undefined) row.description = data.description
  if (data.isActive !== undefined) row.is_active = data.isActive
  if (data.sortOrder !== undefined) row.sort_order = data.sortOrder
  // Leegmaken moet kunnen: dan valt de app terug op de standaardkeuze.
  if (data.countStartKioskId !== undefined) {
    row.count_start_kiosk_id = data.countStartKioskId || null
  }
  if (data.restockStartKioskId !== undefined) {
    row.restock_start_kiosk_id = data.restockStartKioskId || null
  }
  return row
}

export function mapKiosk(row: Row): Kiosk {
  return {
    id: str(row.id),
    ringId: str(row.ring_id),
    number: num(row.number),
    label: optStr(row.label),
    name: optStr(row.name),
    sortOrder: num(row.sort_order),
    isActive: bool(row.is_active),
    location: optStr(row.location),
    notes: optStr(row.notes),
    drinkStorageType: str(row.drink_storage_type) as DrinkStorageType,
    drinkSourceKioskId: optStr(row.drink_source_kiosk_id) ?? null,
    createdAt: str(row.created_at),
    updatedAt: str(row.updated_at),
  }
}

export function kioskToRow(data: Partial<Kiosk>): Row {
  const row: Row = {}
  if (data.ringId !== undefined) row.ring_id = data.ringId
  if (data.number !== undefined) row.number = data.number
  // Een leeggemaakt opschrift moet ook echt leeg worden opgeslagen, anders
  // blijft het oude bord staan.
  if (data.label !== undefined) row.label = data.label.trim() || null
  if (data.name !== undefined) row.name = data.name
  if (data.sortOrder !== undefined) row.sort_order = data.sortOrder
  if (data.isActive !== undefined) row.is_active = data.isActive
  if (data.location !== undefined) row.location = data.location
  if (data.notes !== undefined) row.notes = data.notes
  if (data.drinkStorageType !== undefined) row.drink_storage_type = data.drinkStorageType
  // Leeg betekent hier echt leeg: een satelliet zonder vastgestelde bronkiosk
  // hoort NULL te zijn en niet een lege tekst.
  if (data.drinkSourceKioskId !== undefined) {
    row.drink_source_kiosk_id = data.drinkSourceKioskId || null
  }
  return row
}

// ─── Product ────────────────────────────────────────────────────────────────

export function mapCategory(row: Row): ProductCategory {
  return {
    id: str(row.id),
    name: str(row.name),
    sortOrder: num(row.sort_order),
    isActive: bool(row.is_active),
  }
}

export function categoryToRow(data: Partial<ProductCategory>): Row {
  const row: Row = {}
  if (data.name !== undefined) row.name = data.name
  if (data.sortOrder !== undefined) row.sort_order = data.sortOrder
  if (data.isActive !== undefined) row.is_active = data.isActive
  return row
}

export function mapProduct(row: Row): Product {
  return {
    id: str(row.id),
    categoryId: str(row.category_id),
    name: str(row.name),
    shortName: str(row.short_name),
    countUnit: str(row.count_unit),
    packagingUnit: str(row.packaging_unit),
    sortOrder: num(row.sort_order),
    isActive: bool(row.is_active),
    inputStep: parseInputStep(row.input_step),
    allowPartialPackage: bool(row.allow_partial_package),
    roundType: str(row.round_type) as RoundType,
    productSize: str(row.product_size) as ProductSize,
    estimatedPalletLoad: num(row.estimated_pallet_load),
    ownRoundThreshold: num(row.own_round_threshold),
    priority: num(row.priority),
    storageLocation: optStr(row.storage_location),
    refrigerated: bool(row.refrigerated),
    suppliedFromLargeCoolerForSatellite: bool(row.supplied_from_large_cooler_for_satellite),
    notes: optStr(row.notes),
    deletedAt: optStr(row.deleted_at),
    createdAt: str(row.created_at),
    updatedAt: str(row.updated_at),
  }
}

export function productToRow(data: Partial<Product>): Row {
  const row: Row = {}
  if (data.categoryId !== undefined) row.category_id = data.categoryId
  if (data.name !== undefined) row.name = data.name
  if (data.shortName !== undefined) row.short_name = data.shortName
  if (data.countUnit !== undefined) row.count_unit = data.countUnit
  if (data.packagingUnit !== undefined) row.packaging_unit = data.packagingUnit
  if (data.sortOrder !== undefined) row.sort_order = data.sortOrder
  if (data.isActive !== undefined) row.is_active = data.isActive
  // input_step is text in de database ('1' | '0.5' | '0.25')
  if (data.inputStep !== undefined) row.input_step = String(data.inputStep)
  if (data.allowPartialPackage !== undefined) row.allow_partial_package = data.allowPartialPackage
  if (data.roundType !== undefined) row.round_type = data.roundType
  if (data.productSize !== undefined) row.product_size = data.productSize
  if (data.estimatedPalletLoad !== undefined) row.estimated_pallet_load = data.estimatedPalletLoad
  if (data.ownRoundThreshold !== undefined) row.own_round_threshold = data.ownRoundThreshold
  if (data.priority !== undefined) row.priority = data.priority
  if (data.storageLocation !== undefined) row.storage_location = data.storageLocation
  if (data.refrigerated !== undefined) row.refrigerated = data.refrigerated
  if (data.suppliedFromLargeCoolerForSatellite !== undefined) {
    row.supplied_from_large_cooler_for_satellite = data.suppliedFromLargeCoolerForSatellite
  }
  if (data.notes !== undefined) row.notes = data.notes
  return row
}

export function mapStandard(row: Row): KioskProductStandard {
  return {
    id: str(row.id),
    kioskId: str(row.kiosk_id),
    productId: str(row.product_id),
    targetQuantityQuarters: num(row.target_quantity_quarters),
    halfPackageThresholdPercentage: num(row.half_package_threshold_pct),
    isActive: bool(row.is_active),
    createdAt: str(row.created_at),
    updatedAt: str(row.updated_at),
  }
}

export function standardToRow(
  data: Omit<KioskProductStandard, 'id' | 'createdAt' | 'updatedAt'>
): Row {
  return {
    kiosk_id: data.kioskId,
    product_id: data.productId,
    target_quantity_quarters: data.targetQuantityQuarters,
    half_package_threshold_pct: data.halfPackageThresholdPercentage,
    is_active: data.isActive,
  }
}

// ─── Event ──────────────────────────────────────────────────────────────────

export function mapEvent(
  row: Row,
  relations: { ringIds: string[]; kioskIds: string[]; userIds: string[] }
): Event {
  return {
    id: str(row.id),
    name: str(row.name),
    date: dateStr(row.date),
    eventType: str(row.event_type) as EventType,
    status: str(row.status) as EventStatus,
    previousEventId: optStr(row.previous_event_id),
    notes: optStr(row.notes),
    activeRingIds: relations.ringIds,
    activeKioskIds: relations.kioskIds,
    assignedUserIds: relations.userIds,
    createdById: str(row.created_by_id),
    createdAt: str(row.created_at),
    updatedAt: str(row.updated_at),
  }
}

export function eventToRow(data: Partial<Event>): Row {
  const row: Row = {}
  if (data.name !== undefined) row.name = data.name
  if (data.date !== undefined) row.date = data.date
  if (data.eventType !== undefined) row.event_type = data.eventType
  if (data.status !== undefined) row.status = data.status
  if (data.previousEventId !== undefined) row.previous_event_id = data.previousEventId || null
  if (data.notes !== undefined) row.notes = data.notes
  if (data.createdById !== undefined) row.created_by_id = data.createdById
  return row
}

export function mapAgendaEntry(row: Row): AgendaEntry {
  return {
    id: str(row.id),
    name: str(row.name),
    date: dateStr(row.date),
    eventType: str(row.event_type) as EventType,
    notes: optStr(row.notes),
    createdAt: str(row.created_at),
    updatedAt: str(row.updated_at),
  }
}

export function agendaEntryToRow(data: Partial<AgendaEntry>): Row {
  const row: Row = {}
  if (data.name !== undefined) row.name = data.name
  if (data.date !== undefined) row.date = data.date
  if (data.eventType !== undefined) row.event_type = data.eventType
  if (data.notes !== undefined) row.notes = data.notes
  return row
}

// ─── Tellen ─────────────────────────────────────────────────────────────────

export function mapCountSession(row: Row): CountSession {
  return {
    id: str(row.id),
    userId: str(row.user_id),
    eventId: str(row.event_id),
    ringId: str(row.ring_id),
    startKioskId: str(row.start_kiosk_id),
    direction: str(row.direction) as RouteDirection,
    kioskRoute: jsonArray(row.kiosk_route),
    startedAt: str(row.started_at),
    completedAt: optStr(row.completed_at),
    status: str(row.status) as CountSessionStatus,
    syncStatus: str(row.sync_status) as SyncStatus,
    createdAt: str(row.created_at),
    updatedAt: str(row.updated_at),
  }
}

export function countSessionToRow(data: Partial<CountSession>): Row {
  const row: Row = {}
  if (data.id !== undefined) row.id = data.id
  if (data.userId !== undefined) row.user_id = data.userId
  if (data.eventId !== undefined) row.event_id = data.eventId
  if (data.ringId !== undefined) row.ring_id = data.ringId
  if (data.startKioskId !== undefined) row.start_kiosk_id = data.startKioskId
  if (data.direction !== undefined) row.direction = data.direction
  // kiosk_route is jsonb: zelf serialiseren, anders maakt de driver er een
  // Postgres-array van en weigert de database het.
  if (data.kioskRoute !== undefined) row.kiosk_route = toJsonb(data.kioskRoute)
  if (data.startedAt !== undefined) row.started_at = toTimestamp(data.startedAt)
  if (data.completedAt !== undefined) row.completed_at = toTimestamp(data.completedAt)
  if (data.status !== undefined) row.status = data.status
  if (data.syncStatus !== undefined) row.sync_status = data.syncStatus
  return row
}

export function mapKioskCount(row: Row): KioskCount {
  return {
    id: str(row.id),
    countSessionId: str(row.count_session_id),
    kioskId: str(row.kiosk_id),
    startedAt: optStr(row.started_at),
    completedAt: optStr(row.completed_at),
    counterId: str(row.counter_id),
    generalNotes: optStr(row.general_notes),
    status: str(row.status) as KioskCountStatus,
    skipReason: optStr(row.skip_reason),
    createdAt: str(row.created_at),
    updatedAt: str(row.updated_at),
  }
}

export function kioskCountToRow(data: Partial<KioskCount>): Row {
  const row: Row = {}
  if (data.id !== undefined) row.id = data.id
  if (data.countSessionId !== undefined) row.count_session_id = data.countSessionId
  if (data.kioskId !== undefined) row.kiosk_id = data.kioskId
  if (data.startedAt !== undefined) row.started_at = toTimestamp(data.startedAt)
  if (data.completedAt !== undefined) row.completed_at = toTimestamp(data.completedAt)
  if (data.counterId !== undefined) row.counter_id = data.counterId
  if (data.generalNotes !== undefined) row.general_notes = data.generalNotes
  if (data.status !== undefined) row.status = data.status
  if (data.skipReason !== undefined) row.skip_reason = data.skipReason
  return row
}

export function mapCountEntry(row: Row): CountEntry {
  return {
    id: str(row.id),
    kioskCountId: str(row.kiosk_count_id),
    productId: str(row.product_id),
    targetQuantityQuarters: num(row.target_quantity_quarters),
    countedQuantityQuarters: num(row.counted_quantity_quarters),
    effectiveQuantityQuarters: num(row.effective_quantity_quarters),
    restockQuantityPackages: num(row.restock_quantity_packages),
    appliedFractionRule: str(row.applied_fraction_rule) as FractionRule,
    notes: optStr(row.notes),
    lastModifiedAt: str(row.last_modified_at),
    lastModifiedById: str(row.last_modified_by_id),
  }
}

export function countEntryToRow(data: Omit<CountEntry, 'lastModifiedAt'>): Row {
  return {
    id: data.id,
    kiosk_count_id: data.kioskCountId,
    product_id: data.productId,
    target_quantity_quarters: data.targetQuantityQuarters,
    counted_quantity_quarters: data.countedQuantityQuarters,
    effective_quantity_quarters: data.effectiveQuantityQuarters,
    restock_quantity_packages: data.restockQuantityPackages,
    applied_fraction_rule: data.appliedFractionRule,
    notes: data.notes ?? null,
    last_modified_at: new Date().toISOString(),
    last_modified_by_id: data.lastModifiedById,
  }
}

// ─── Bijvullen ──────────────────────────────────────────────────────────────

export function mapRequirement(row: Row): RestockRequirement {
  return {
    id: str(row.id),
    eventId: str(row.event_id),
    kioskId: str(row.kiosk_id),
    productId: str(row.product_id),
    requiredPackages: num(row.required_packages),
    reservedPackages: num(row.reserved_packages),
    deliveredPackages: num(row.delivered_packages),
    createdAt: str(row.created_at),
    updatedAt: str(row.updated_at),
  }
}

export function requirementToRow(data: Partial<RestockRequirement>): Row {
  const row: Row = {}
  if (data.id !== undefined) row.id = data.id
  if (data.eventId !== undefined) row.event_id = data.eventId
  if (data.kioskId !== undefined) row.kiosk_id = data.kioskId
  if (data.productId !== undefined) row.product_id = data.productId
  if (data.requiredPackages !== undefined) row.required_packages = data.requiredPackages
  if (data.reservedPackages !== undefined) row.reserved_packages = data.reservedPackages
  if (data.deliveredPackages !== undefined) row.delivered_packages = data.deliveredPackages
  return row
}

export function mapRound(row: Row): RestockRound {
  return {
    id: str(row.id),
    eventId: str(row.event_id),
    ringId: str(row.ring_id),
    name: str(row.name),
    roundType: str(row.round_type) as RestockRoundType,
    status: str(row.status) as RestockRoundStatus,
    createdById: str(row.created_by_id),
    assignedUserId: optStr(row.assigned_user_id),
    claimedAt: optStr(row.claimed_at),
    startedAt: optStr(row.started_at),
    completedAt: optStr(row.completed_at),
    notes: optStr(row.notes),
    createdAt: str(row.created_at),
    updatedAt: str(row.updated_at),
  }
}

export function roundToRow(data: Partial<RestockRound>): Row {
  const row: Row = {}
  if (data.id !== undefined) row.id = data.id
  if (data.eventId !== undefined) row.event_id = data.eventId
  if (data.ringId !== undefined) row.ring_id = data.ringId
  if (data.name !== undefined) row.name = data.name
  if (data.roundType !== undefined) row.round_type = data.roundType
  if (data.status !== undefined) row.status = data.status
  if (data.createdById !== undefined) row.created_by_id = data.createdById
  if (data.assignedUserId !== undefined) row.assigned_user_id = data.assignedUserId
  if (data.claimedAt !== undefined) row.claimed_at = toTimestamp(data.claimedAt)
  if (data.startedAt !== undefined) row.started_at = toTimestamp(data.startedAt)
  if (data.completedAt !== undefined) row.completed_at = toTimestamp(data.completedAt)
  if (data.notes !== undefined) row.notes = data.notes
  return row
}

export function mapRoundItem(row: Row): RestockRoundItem {
  return {
    id: str(row.id),
    restockRoundId: str(row.restock_round_id),
    productId: str(row.product_id),
    proposedPackages: num(row.proposed_packages),
    loadedPackages: num(row.loaded_packages),
    deliveredPackages: num(row.delivered_packages),
    createdAt: str(row.created_at),
    updatedAt: str(row.updated_at),
  }
}

export function roundItemToRow(
  data: Omit<RestockRoundItem, 'id' | 'createdAt' | 'updatedAt'>
): Row {
  return {
    restock_round_id: data.restockRoundId,
    product_id: data.productId,
    proposed_packages: data.proposedPackages,
    loaded_packages: data.loadedPackages,
    delivered_packages: data.deliveredPackages,
  }
}

export function mapRoundStop(row: Row): RestockRoundStop {
  return {
    id: str(row.id),
    restockRoundId: str(row.restock_round_id),
    kioskId: str(row.kiosk_id),
    sortOrder: num(row.sort_order),
    completedAt: optStr(row.completed_at),
    notes: optStr(row.notes),
    skipReason: optStr(row.skip_reason),
  }
}

export function roundStopToRow(data: Partial<RestockRoundStop>): Row {
  const row: Row = {}
  if (data.restockRoundId !== undefined) row.restock_round_id = data.restockRoundId
  if (data.kioskId !== undefined) row.kiosk_id = data.kioskId
  if (data.sortOrder !== undefined) row.sort_order = data.sortOrder
  if (data.completedAt !== undefined) row.completed_at = toTimestamp(data.completedAt)
  if (data.notes !== undefined) row.notes = data.notes
  if (data.skipReason !== undefined) row.skip_reason = data.skipReason
  return row
}

export function mapStopItem(row: Row): RestockStopItem {
  return {
    id: str(row.id),
    restockRoundStopId: str(row.restock_round_stop_id),
    productId: str(row.product_id),
    restockRequirementId: optStr(row.restock_requirement_id),
    plannedPackages: num(row.planned_packages),
    createdAt: str(row.created_at),
  }
}

export function stopItemToRow(data: Omit<RestockStopItem, 'id' | 'createdAt'>): Row {
  return {
    restock_round_stop_id: data.restockRoundStopId,
    product_id: data.productId,
    restock_requirement_id: data.restockRequirementId ?? null,
    planned_packages: data.plannedPackages,
  }
}

export function mapDelivery(row: Row): RestockDelivery {
  return {
    id: str(row.id),
    restockRoundStopId: str(row.restock_round_stop_id),
    productId: str(row.product_id),
    plannedPackages: num(row.planned_packages),
    deliveredPackages: num(row.delivered_packages),
    notDeliveredPackages: num(row.not_delivered_packages),
    reason: row.reason ? (str(row.reason) as DeliveryReason) : undefined,
    reasonNotes: optStr(row.reason_notes),
    deliveredAt: optStr(row.delivered_at),
    deliveredById: str(row.delivered_by_id),
    createdAt: str(row.created_at),
  }
}

export function deliveryToRow(data: RestockDelivery): Row {
  return {
    // Het id komt mee zodat een herhaalde verzending dezelfde rij raakt.
    id: data.id,
    restock_round_stop_id: data.restockRoundStopId,
    product_id: data.productId,
    planned_packages: data.plannedPackages,
    delivered_packages: data.deliveredPackages,
    not_delivered_packages: data.notDeliveredPackages,
    reason: data.reason ?? null,
    reason_notes: data.reasonNotes ?? null,
    delivered_at: toTimestamp(data.deliveredAt) ?? new Date().toISOString(),
    delivered_by_id: data.deliveredById,
  }
}

export function mapReservation(row: Row): StockReservation {
  return {
    id: str(row.id),
    restockRequirementId: str(row.restock_requirement_id),
    restockRoundId: str(row.restock_round_id),
    reservedPackages: num(row.reserved_packages),
    createdAt: str(row.created_at),
  }
}

export function reservationToRow(data: Omit<StockReservation, 'id' | 'createdAt'>): Row {
  return {
    restock_requirement_id: data.restockRequirementId,
    restock_round_id: data.restockRoundId,
    reserved_packages: data.reservedPackages,
  }
}

// ─── Storingen ──────────────────────────────────────────────────────────────

export function mapIncident(row: Row): Incident {
  return {
    id: str(row.id),
    eventId: str(row.event_id),
    kioskId: str(row.kiosk_id),
    category: str(row.category) as IncidentCategory,
    description: str(row.description),
    urgency: str(row.urgency) as IncidentUrgency,
    photoUrl: optStr(row.photo_url),
    reportedById: str(row.reported_by_id),
    reportedAt: str(row.reported_at),
    status: str(row.status) as IncidentStatus,
    assignedToId: optStr(row.assigned_to_id),
    resolution: optStr(row.resolution),
    resolvedAt: optStr(row.resolved_at),
    createdAt: str(row.created_at),
    updatedAt: str(row.updated_at),
  }
}

export function incidentToRow(data: Partial<Incident>): Row {
  const row: Row = {}
  if (data.eventId !== undefined) row.event_id = data.eventId
  if (data.kioskId !== undefined) row.kiosk_id = data.kioskId
  if (data.category !== undefined) row.category = data.category
  if (data.description !== undefined) row.description = data.description
  if (data.urgency !== undefined) row.urgency = data.urgency
  if (data.photoUrl !== undefined) row.photo_url = data.photoUrl
  if (data.reportedById !== undefined) row.reported_by_id = data.reportedById
  if (data.reportedAt !== undefined) row.reported_at = toTimestamp(data.reportedAt)
  if (data.status !== undefined) row.status = data.status
  if (data.assignedToId !== undefined) row.assigned_to_id = data.assignedToId
  if (data.resolution !== undefined) row.resolution = data.resolution
  if (data.resolvedAt !== undefined) row.resolved_at = toTimestamp(data.resolvedAt)
  return row
}
