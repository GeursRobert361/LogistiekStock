import { queryOne } from '@/server/db/pool'
import { hasPermission } from '@/lib/permissions'
import { CountSessionStatus, IncidentStatus, UserRole } from '@/types'
import { ForbiddenError } from './errors'

/**
 * De tweede laag rechten: niet "mag deze rol dit soort bewerkingen doen", maar
 * "gaat het om iets van deze gebruiker".
 *
 * De rechtentabel geeft een teller COUNT, en daarmee toegang tot
 * `count.updateSession`. Welke sessie dat is bepaalt hij zelf met het id dat
 * hij meestuurt — dus zonder deze laag kan hij de telronde van een collega
 * aanpassen, of een al goedgekeurde telling nog wijzigen.
 *
 * De regels staan hier en niet in React: een scherm dat een knop verbergt houdt
 * niemand tegen die de aanroep zelf doet.
 */

export interface ActingUser {
  id: string
  roles: UserRole[]
}

export type EntityGuard = (user: ActingUser, args: unknown[]) => Promise<void>

// ─── Kleine opzoekingen ──────────────────────────────────────────────────────
// Bewust rechtstreekse queries en geen extra repository-methodes: dit is
// serverlogica die nergens anders bestaat, en elke interfacemethode zou ook in
// de demo- en testvariant moeten landen.

async function findSession(
  id: string
): Promise<{ userId: string; status: CountSessionStatus } | null> {
  const row = await queryOne<{ user_id: string; status: string }>(
    'select user_id, status from count_sessions where id = $1',
    [id]
  )
  return row ? { userId: row.user_id, status: row.status as CountSessionStatus } : null
}

async function findSessionOfKioskCount(kioskCountId: string): Promise<string | null> {
  const row = await queryOne<{ count_session_id: string }>(
    'select count_session_id from kiosk_counts where id = $1',
    [kioskCountId]
  )
  return row?.count_session_id ?? null
}

async function findRound(id: string): Promise<{ assignedUserId: string | null } | null> {
  const row = await queryOne<{ assigned_user_id: string | null }>(
    'select assigned_user_id from restock_rounds where id = $1',
    [id]
  )
  return row ? { assignedUserId: row.assigned_user_id } : null
}

async function findRoundOfStop(stopId: string): Promise<string | null> {
  const row = await queryOne<{ restock_round_id: string }>(
    'select restock_round_id from restock_round_stops where id = $1',
    [stopId]
  )
  return row?.restock_round_id ?? null
}

// ─── Telrondes ───────────────────────────────────────────────────────────────

/**
 * Een teller werkt aan zijn eigen, nog niet goedgekeurde ronde.
 *
 * Planners en admins mogen wel bij andermans rondes: die controleren en keuren
 * goed, en moeten een kiosk kunnen heropenen.
 */
async function assertMaySession(user: ActingUser, sessionId: string): Promise<void> {
  if (hasPermission(user.roles, 'REVIEW_COUNTS')) return

  const session = await findSession(sessionId)
  // Bestaat hij nog niet, dan is dit de eerste schrijfactie vanuit de outbox
  // van deze gebruiker; die mag.
  if (!session) return

  if (session.userId !== user.id) {
    throw new ForbiddenError('Dit is de telronde van iemand anders.')
  }
  if (session.status === CountSessionStatus.APPROVED) {
    throw new ForbiddenError('Deze telronde is al goedgekeurd en kan niet meer worden gewijzigd.')
  }
}

async function assertMaySessionOfKioskCount(user: ActingUser, kioskCountId: string) {
  if (hasPermission(user.roles, 'REVIEW_COUNTS')) return
  const sessionId = await findSessionOfKioskCount(kioskCountId)
  if (sessionId) await assertMaySession(user, sessionId)
}

// ─── Vulrondes ───────────────────────────────────────────────────────────────

/**
 * Een vuller werkt aan zijn eigen ronde, of neemt er een aan die nog vrij is.
 *
 * Zolang er niemand op staat mag iedereen met vulrechten hem oppakken — dat ís
 * het aannemen. Staat er wel iemand op, dan is het diens ronde.
 */
async function assertMayRound(user: ActingUser, roundId: string): Promise<void> {
  if (hasPermission(user.roles, 'PLAN_RESTOCK')) return

  const round = await findRound(roundId)
  if (!round) return

  if (round.assignedUserId !== null && round.assignedUserId !== user.id) {
    throw new ForbiddenError('Deze vulronde is van iemand anders.')
  }
}

async function assertMayRoundOfStop(user: ActingUser, stopId: string): Promise<void> {
  if (hasPermission(user.roles, 'PLAN_RESTOCK')) return
  const roundId = await findRoundOfStop(stopId)
  if (roundId) await assertMayRound(user, roundId)
}

// ─── Hulpjes om argumenten uit te lezen ──────────────────────────────────────

function stringArg(args: unknown[], index: number): string | null {
  const value = args[index]
  return typeof value === 'string' ? value : null
}

function fieldOf(args: unknown[], index: number, field: string): string | null {
  const value = args[index]
  if (typeof value !== 'object' || value === null) return null
  const found = (value as Record<string, unknown>)[field]
  return typeof found === 'string' ? found : null
}

function firstItemField(args: unknown[], index: number, field: string): string | null {
  const value = args[index]
  if (!Array.isArray(value) || value.length === 0) return null
  const first = value[0] as unknown
  if (typeof first !== 'object' || first === null) return null
  const found = (first as Record<string, unknown>)[field]
  return typeof found === 'string' ? found : null
}

/** Draait de controle alleen wanneer het id te bepalen viel. */
function guardById(
  resolve: (args: unknown[]) => string | null,
  check: (user: ActingUser, id: string) => Promise<void>
): EntityGuard {
  return async (user, args) => {
    const id = resolve(args)
    if (id) await check(user, id)
  }
}

// ─── De tabel ────────────────────────────────────────────────────────────────

export const ENTITY_GUARDS: Record<string, EntityGuard> = {
  // ─── Tellen ────────────────────────────────────────────────────────────────
  'count.createSession': async (user, args) => {
    const owner = fieldOf(args, 0, 'userId')
    if (!hasPermission(user.roles, 'REVIEW_COUNTS') && owner !== null && owner !== user.id) {
      throw new ForbiddenError('Een telronde start je op je eigen naam.')
    }
  },
  'count.updateSession': guardById((args) => stringArg(args, 0), assertMaySession),
  'count.updateSessionStatus': guardById((args) => stringArg(args, 0), assertMaySession),
  'count.upsertKioskCount': guardById(
    (args) => fieldOf(args, 0, 'countSessionId'),
    assertMaySession
  ),
  'count.upsertCountEntry': guardById(
    (args) => fieldOf(args, 0, 'kioskCountId'),
    assertMaySessionOfKioskCount
  ),
  'count.bulkUpsertCountEntries': guardById(
    (args) => firstItemField(args, 0, 'kioskCountId'),
    assertMaySessionOfKioskCount
  ),
  'count.deleteCountEntry': guardById(
    (args) => stringArg(args, 0),
    assertMaySessionOfKioskCount
  ),

  // ─── Vullen ────────────────────────────────────────────────────────────────
  'restock.createRound': async (user, args) => {
    const creator = fieldOf(args, 0, 'createdById')
    if (!hasPermission(user.roles, 'PLAN_RESTOCK') && creator !== null && creator !== user.id) {
      throw new ForbiddenError('Een vulronde maak je op je eigen naam.')
    }
  },
  'restock.reserveRoundAtomic': async (user, args) => {
    const value = args[0]
    const round =
      typeof value === 'object' && value !== null
        ? ((value as Record<string, unknown>).round as Record<string, unknown> | undefined)
        : undefined
    const creator = typeof round?.createdById === 'string' ? round.createdById : null
    if (!hasPermission(user.roles, 'PLAN_RESTOCK') && creator !== null && creator !== user.id) {
      throw new ForbiddenError('Een vulronde maak je op je eigen naam.')
    }
  },
  'restock.updateRound': guardById((args) => stringArg(args, 0), assertMayRound),
  'restock.upsertRoundItem': guardById(
    (args) => fieldOf(args, 0, 'restockRoundId'),
    assertMayRound
  ),
  'restock.createRoundStops': guardById(
    (args) => firstItemField(args, 0, 'restockRoundId'),
    assertMayRound
  ),
  'restock.deleteRoundStops': guardById((args) => stringArg(args, 0), assertMayRound),
  'restock.createStopItems': guardById(
    (args) => firstItemField(args, 0, 'restockRoundStopId'),
    assertMayRoundOfStop
  ),
  'restock.updateStop': guardById((args) => stringArg(args, 0), assertMayRoundOfStop),
  'restock.createDelivery': guardById(
    (args) => fieldOf(args, 0, 'restockRoundStopId'),
    assertMayRoundOfStop
  ),
  'restock.registerDeliveryAtomic': guardById(
    (args) => fieldOf(args, 0, 'roundId'),
    assertMayRound
  ),
  'restock.createReservation': guardById(
    (args) => fieldOf(args, 0, 'restockRoundId'),
    assertMayRound
  ),
  'restock.releaseReservation': guardById((args) => stringArg(args, 0), assertMayRound),
  'restock.releaseReservationsForRound': guardById(
    (args) => stringArg(args, 0),
    assertMayRound
  ),

  // ─── Storingen ─────────────────────────────────────────────────────────────
  /**
   * De melder mag zijn eigen melding bijstellen zolang die openstaat — een
   * typefout of een vergeten detail. Status en toewijzing zijn van de planner:
   * daar hangt af wie erop af gaat.
   */
  'incident.updateIncident': async (user, args) => {
    if (hasPermission(user.roles, 'REVIEW_COUNTS')) return

    const id = stringArg(args, 0)
    if (!id) return

    const row = await queryOne<{ reported_by_id: string; status: string }>(
      'select reported_by_id, status from incidents where id = $1',
      [id]
    )
    if (!row) return

    if (row.reported_by_id !== user.id) {
      throw new ForbiddenError('Deze storing is door iemand anders gemeld.')
    }
    if (row.status !== IncidentStatus.OPEN) {
      throw new ForbiddenError('Deze storing is al opgepakt en kan niet meer worden gewijzigd.')
    }

    const patch = args[1]
    const fields = typeof patch === 'object' && patch !== null ? Object.keys(patch) : []
    const allowed = new Set(['description', 'photoUrl', 'urgency'])
    if (fields.some((field) => !allowed.has(field))) {
      throw new ForbiddenError('Als melder kun je alleen de omschrijving bijstellen.')
    }
  },
}

export function getEntityGuard(resource: string, method: string): EntityGuard | null {
  return ENTITY_GUARDS[`${resource}.${method}`] ?? null
}
