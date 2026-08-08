import { z } from 'zod'
import {
  CountSessionStatus,
  DeliveryReason,
  EventStatus,
  EventType,
  FractionRule,
  IncidentCategory,
  IncidentStatus,
  IncidentUrgency,
  KioskCountStatus,
  RestockRoundStatus,
  RestockRoundType,
  RouteDirection,
} from '@/types'

/**
 * Vorm van de argumenten per mutatie.
 *
 * De API controleerde alleen of `args` een array was; wat erin zat ging
 * ongezien naar de repository. Een verkeerd type belandde daardoor als
 * databasefout op het scherm — een 500 die eruitziet als een storing terwijl
 * het gewoon een ongeldig verzoek is.
 *
 * Alleen mutaties: leesacties nemen hooguit een id, en daar is een mislukte
 * lookup het antwoord al. Wat hier niet in staat wordt niet gevalideerd, dus
 * dit is geen tweede rechtenlaag — die staat in methodPermissions en
 * entityGuards.
 */

const uuid = z.string().uuid()
const optionalUuid = uuid.optional().nullable()
const isoDate = z.string().min(1)
const text = z.string()
const count = z.number().int().nonnegative()

/** Onbekende velden weigeren we niet: de client mag voorlopen op de server. */
const enumOf = <T extends Record<string, string>>(values: T) =>
  z.enum(Object.values(values) as [string, ...string[]])

// ─── Tellen ──────────────────────────────────────────────────────────────────

const countSession = z.object({
  id: uuid,
  userId: uuid,
  eventId: uuid,
  ringId: uuid,
  startKioskId: uuid,
  direction: enumOf(RouteDirection),
  kioskRoute: z.array(uuid),
  startedAt: isoDate,
  completedAt: isoDate.optional(),
  status: enumOf(CountSessionStatus),
  syncStatus: z.string(),
})

const kioskCount = z.object({
  id: uuid,
  countSessionId: uuid,
  kioskId: uuid,
  startedAt: isoDate.optional(),
  completedAt: isoDate.optional(),
  counterId: uuid,
  generalNotes: text.optional(),
  status: enumOf(KioskCountStatus),
  skipReason: text.optional(),
})

const countEntry = z.object({
  id: uuid,
  kioskCountId: uuid,
  productId: uuid,
  targetQuantityQuarters: count,
  countedQuantityQuarters: count,
  effectiveQuantityQuarters: count,
  restockQuantityPackages: count,
  appliedFractionRule: enumOf(FractionRule),
  notes: text.optional(),
  lastModifiedById: uuid,
})

// ─── Bijvullen ───────────────────────────────────────────────────────────────

const restockRound = z.object({
  id: uuid,
  eventId: uuid,
  ringId: uuid,
  name: text.min(1),
  roundType: enumOf(RestockRoundType),
  status: enumOf(RestockRoundStatus),
  createdById: uuid,
  assignedUserId: optionalUuid,
  claimedAt: isoDate.optional(),
  startedAt: isoDate.optional(),
  completedAt: isoDate.optional(),
  notes: text.optional(),
})

const delivery = z.object({
  id: uuid,
  restockRoundStopId: uuid,
  productId: uuid,
  plannedPackages: count,
  deliveredPackages: count,
  notDeliveredPackages: count,
  reason: enumOf(DeliveryReason).optional(),
  reasonNotes: text.optional(),
  deliveredAt: isoDate.optional(),
  deliveredById: uuid,
  createdAt: isoDate.optional(),
})

const requirement = z.object({
  eventId: uuid,
  kioskId: uuid,
  productId: uuid,
  requiredPackages: count,
  reservedPackages: count,
  deliveredPackages: count,
})

/**
 * Een partiële update: alleen de velden die meekomen worden gecontroleerd.
 * `.partial()` op een object waarvan de sleutels al optioneel mogen zijn.
 */
const requirementPatch = requirement.partial()

// ─── Evenement, normen en storingen ──────────────────────────────────────────

const event = z.object({
  name: text.min(1),
  date: isoDate,
  eventType: enumOf(EventType),
  status: enumOf(EventStatus),
  previousEventId: optionalUuid,
  notes: text.optional(),
  activeRingIds: z.array(uuid).optional(),
  activeKioskIds: z.array(uuid).optional(),
  assignedUserIds: z.array(uuid).optional(),
  createdById: uuid,
})

const standard = z.object({
  kioskId: uuid,
  productId: uuid,
  targetQuantityQuarters: count,
  halfPackageThresholdPercentage: z.number().int().min(0).max(100),
  isActive: z.boolean(),
})

const incident = z.object({
  id: uuid,
  eventId: uuid,
  kioskId: uuid,
  category: enumOf(IncidentCategory),
  description: text.min(1),
  urgency: enumOf(IncidentUrgency),
  photoUrl: text.optional(),
  reportedById: uuid,
  reportedAt: isoDate.optional(),
  status: enumOf(IncidentStatus),
  assignedToId: optionalUuid,
  resolution: text.optional(),
  resolvedAt: isoDate.optional(),
})

/**
 * Per methode de vorm van de argumentenlijst.
 *
 * De sleutel is dezelfde als in de rechtentabel, zodat beide naast elkaar te
 * lezen zijn.
 */
export const ARGUMENT_SCHEMAS: Record<string, z.ZodTypeAny> = {
  // Tellen
  'count.createSession': z.tuple([countSession]),
  'count.updateSession': z.tuple([uuid, countSession.partial()]),
  'count.updateSessionStatus': z.tuple([uuid, enumOf(CountSessionStatus)]),
  'count.upsertKioskCount': z.tuple([kioskCount]),
  'count.upsertCountEntry': z.tuple([countEntry]),
  'count.bulkUpsertCountEntries': z.tuple([z.array(countEntry)]),
  'count.deleteCountEntry': z.tuple([uuid, uuid]),

  // Bijvullen
  'restock.createRound': z.tuple([restockRound]),
  'restock.updateRound': z.tuple([uuid, restockRound.partial()]),
  'restock.reserveRoundAtomic': z.tuple([
    z.object({
      round: restockRound,
      kioskIds: z.array(uuid),
      productIds: z.array(uuid),
    }),
  ]),
  'restock.createDelivery': z.tuple([delivery]),
  'restock.registerDeliveryAtomic': z.tuple([
    z.object({ delivery, roundId: uuid, requirementId: uuid.optional() }),
  ]),
  'restock.upsertRequirement': z.tuple([requirement]),
  'restock.bulkUpsertRequirements': z.tuple([z.array(requirement)]),
  'restock.updateRequirement': z.tuple([uuid, requirementPatch]),
  'restock.createReservation': z.tuple([
    z.object({
      restockRequirementId: uuid,
      restockRoundId: uuid,
      reservedPackages: z.number().int().positive(),
    }),
  ]),
  'restock.releaseReservation': z.tuple([uuid, uuid]),
  'restock.releaseReservationsForRound': z.tuple([uuid]),
  'restock.deleteRoundStops': z.tuple([uuid]),

  // Evenement
  'event.createEvent': z.tuple([event]),
  'event.updateEvent': z.tuple([uuid, event.partial()]),
  'event.updateEventStatus': z.tuple([uuid, enumOf(EventStatus)]),
  'event.deleteEvent': z.tuple([uuid]),

  // Normen
  'product.upsertStandard': z.tuple([standard]),
  'product.bulkUpsertStandards': z.tuple([z.array(standard)]),

  // Storingen
  'incident.createIncident': z.tuple([incident]),
  'incident.updateIncident': z.tuple([uuid, incident.partial()]),
}

export interface ArgumentCheck {
  ok: boolean
  /** Kort en zonder interne veldnamen die niets zeggen op de vloer. */
  message?: string
}

export function checkArguments(resource: string, method: string, args: unknown[]): ArgumentCheck {
  const schema = ARGUMENT_SCHEMAS[`${resource}.${method}`]
  if (!schema) return { ok: true }

  const result = schema.safeParse(args)
  if (result.success) return { ok: true }

  const first = result.error.issues[0]
  const path = first?.path.filter((part) => typeof part === 'string').join('.')
  return {
    ok: false,
    message: path ? `Ongeldige waarde voor "${path}".` : 'Ongeldige invoer.',
  }
}
