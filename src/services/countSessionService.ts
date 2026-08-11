import { repositories } from '@/repositories'
import { CountSessionStatus, KioskCountStatus } from '@/types'
import type { CountSession, KioskCount, CountEntry, RestockRequirement } from '@/types'
import {
  loadKioskCounts,
  loadSession,
  saveSession,
  reopenKiosk,
  flushPendingCountWrites,
} from './countingService'
import { syncService } from './syncService'
import {
  assertSessionTransition,
  eventStatusForSession,
} from '@/domain/counting/sessionStatus'
import {
  assertMayDiscardSession,
  assertMayResetKiosk,
  type DiscardSummary,
} from '@/domain/counting/reset'
import {
  reconcileRestockRequirements,
  isRequirementInUse,
} from '@/domain/restocking/reconcileRequirements'
import type { RequirementDraft } from '@/domain/restocking/buildRequirements'
import { getLocalEntries, forgetSessionLocally, forgetKioskCountLocally } from '@/lib/db/offlineDb'
import { getPendingOutboxEntries } from '@/lib/db/offlineDb'

/** Status van één kiosk binnen een telronde. */
export type RouteKioskStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED'

export const ROUTE_STATUS_LABEL: Record<RouteKioskStatus, string> = {
  NOT_STARTED: 'Niet geteld',
  IN_PROGRESS: 'Bezig',
  COMPLETED: 'Afgerond',
  SKIPPED: 'Overgeslagen',
}

export interface RouteKioskState {
  kioskId: string
  status: RouteKioskStatus
  kioskCount: KioskCount | null
}

export interface SessionOverview {
  session: CountSession
  /** Eén regel per kiosk uit `session.kioskRoute` — ook de nog niet bezochte. */
  kiosks: RouteKioskState[]
  completedCount: number
  skippedCount: number
  inProgressCount: number
  notStartedCount: number
  totalCount: number
  /** Alle kiosken zijn afgerond of bewust overgeslagen. */
  isFullyHandled: boolean
}

function toRouteStatus(kioskCount: KioskCount | null): RouteKioskStatus {
  if (!kioskCount) return 'NOT_STARTED'
  switch (kioskCount.status) {
    case KioskCountStatus.COMPLETED:
      return 'COMPLETED'
    case KioskCountStatus.SKIPPED:
      return 'SKIPPED'
    case KioskCountStatus.IN_PROGRESS:
      return 'IN_PROGRESS'
    default:
      return 'NOT_STARTED'
  }
}

/**
 * Overzicht van een telronde.
 *
 * De route is leidend voor het totaal: bij een route van 28 kiosken en één
 * getelde kiosk is de stand 1 van 28 — niet 1 van 1.
 */
export async function getSessionOverview(session: CountSession): Promise<SessionOverview> {
  const kioskCounts = await loadKioskCounts(session.id)
  const byKiosk = new Map(kioskCounts.map((kc) => [kc.kioskId, kc]))

  const kiosks: RouteKioskState[] = session.kioskRoute.map((kioskId) => {
    const kioskCount = byKiosk.get(kioskId) ?? null
    return { kioskId, status: toRouteStatus(kioskCount), kioskCount }
  })

  const countBy = (status: RouteKioskStatus) => kiosks.filter((k) => k.status === status).length
  const completedCount = countBy('COMPLETED')
  const skippedCount = countBy('SKIPPED')

  return {
    session,
    kiosks,
    completedCount,
    skippedCount,
    inProgressCount: countBy('IN_PROGRESS'),
    notStartedCount: countBy('NOT_STARTED'),
    totalCount: kiosks.length,
    isFullyHandled: kiosks.length > 0 && completedCount + skippedCount === kiosks.length,
  }
}

/**
 * Zet een telronde in een nieuwe stand.
 *
 * De overgang wordt eerst getoetst: van "goedgekeurd" terug naar "bezig"
 * springen zonder heropenen hoort niet te kunnen. `syncEvent` trekt de
 * evenementstatus mee — nodig zodra een ronde wordt ingediend, goedgekeurd of
 * heropend, want daar hangt de rest van de vloer op.
 */
export async function transitionSession(
  session: CountSession,
  next: CountSessionStatus,
  options: { syncEvent?: boolean; completedAt?: string | null } = {}
): Promise<CountSession> {
  assertSessionTransition(session.status, next)

  const updated = await saveSession({
    ...session,
    status: next,
    // `null` wist de afrondtijd — een heropende ronde is niet meer afgerond.
    ...(options.completedAt !== undefined
      ? { completedAt: options.completedAt ?? undefined }
      : {}),
  })

  if (options.syncEvent) {
    try {
      await repositories
        .event()
        .updateEventStatus(session.eventId, eventStatusForSession(next))
    } catch (error) {
      console.error('[telling] Evenementstatus bijwerken mislukt.', error)
    }
  }

  return updated
}

/**
 * Zet de telronde op SUBMITTED zodra elke kiosk uit de route is afgerond of
 * bewust overgeslagen. Geeft terug of dat gebeurd is.
 */
export async function finishSessionIfComplete(session: CountSession): Promise<boolean> {
  if (session.status === CountSessionStatus.SUBMITTED || session.status === CountSessionStatus.APPROVED) {
    return true
  }

  const overview = await getSessionOverview(session)
  if (!overview.isFullyHandled) return false

  await transitionSession(session, CountSessionStatus.SUBMITTED, {
    syncEvent: true,
    completedAt: new Date().toISOString(),
  })
  return true
}

export async function pauseSession(session: CountSession): Promise<CountSession> {
  await flushPendingCountWrites()
  return transitionSession(session, CountSessionStatus.PAUSED)
}

export async function resumeSession(session: CountSession): Promise<CountSession> {
  return transitionSession(session, CountSessionStatus.IN_PROGRESS)
}

/** Telrondes die een teller kan hervatten. */
export function isResumable(session: CountSession): boolean {
  return (
    session.status === CountSessionStatus.IN_PROGRESS ||
    session.status === CountSessionStatus.PAUSED ||
    session.status === CountSessionStatus.REOPENED
  )
}

/** Eerste kiosk in de route die nog aandacht nodig heeft. */
export function getNextOpenKioskId(overview: SessionOverview): string | null {
  const next = overview.kiosks.find((k) => k.status === 'NOT_STARTED' || k.status === 'IN_PROGRESS')
  return next?.kioskId ?? null
}

// ─── Goedkeuren ───────────────────────────────────────────────────────────────

export interface ApprovalBlocker {
  code: 'OPEN_KIOSKS' | 'UNSYNCED_CHANGES'
  message: string
}

export interface PreparedApproval {
  /** De telronde zoals hij ná synchroniseren op de server staat. */
  session: CountSession
  /** Overzicht op precies die verse gegevens. */
  overview: SessionOverview
  blockers: ApprovalBlocker[]
}

/**
 * Maakt één verse dataset klaar waar zowel de controle als de generatie op
 * draait.
 *
 * Dit is de kern van de volgorde: eerst alles wegschrijven, dán pas kijken. Wie
 * eerst kijkt en daarna wegschrijft, controleert op een ander plaatje dan hij
 * verwerkt — en dan kan een kiosk die tijdens het synchroniseren binnenkomt de
 * blokkade passeren en tóch buiten de bijvullijst vallen.
 */
export async function prepareSessionForApproval(
  session: CountSession
): Promise<PreparedApproval> {
  await flushPendingCountWrites()

  const isOnline = typeof navigator === 'undefined' || navigator.onLine
  let pendingCount = 0
  if (isOnline) {
    await syncService.flush()
    pendingCount = (await getPendingOutboxEntries()).length
  }

  // Pas ná het wegschrijven de telronde en het overzicht opnieuw opbouwen.
  const fresh = (await loadSession(session.id)) ?? session
  const overview = await getSessionOverview(fresh)

  const blockers: ApprovalBlocker[] = []
  if (pendingCount > 0) {
    blockers.push({
      code: 'UNSYNCED_CHANGES',
      message: `${pendingCount} wijziging${pendingCount === 1 ? '' : 'en'} ${
        pendingCount === 1 ? 'is' : 'zijn'
      } nog niet gesynchroniseerd.`,
    })
  }

  const open = overview.notStartedCount + overview.inProgressCount
  if (open > 0) {
    blockers.push({
      code: 'OPEN_KIOSKS',
      message: `${open} ${open === 1 ? 'kiosk is' : 'kiosken zijn'} nog niet afgerond of overgeslagen.`,
    })
  }

  return { session: fresh, overview, blockers }
}

/**
 * Controleert of een telronde goedgekeurd mag worden.
 *
 * Het meegegeven overzicht kan verouderd zijn — de reviewpagina heeft het bij
 * het openen opgehaald. Er wordt daarom altijd eerst gesynchroniseerd en
 * opnieuw geladen.
 */
export async function getApprovalBlockers(
  overview: SessionOverview
): Promise<ApprovalBlocker[]> {
  return (await prepareSessionForApproval(overview.session)).blockers
}

export interface ApprovalResult {
  /** Behoeften die na goedkeuren openstaan voor de kiosken van deze ronde. */
  requirementCount: number
  totalPackages: number
  /** Behoeften die vervielen doordat het tekort na correctie nul werd. */
  clearedCount: number
}

/** Een behoefte die al gereserveerd of geleverd is mag niet stil wijzigen. */
export class RequirementInUseError extends Error {
  readonly code = 'REQUIREMENT_ALREADY_IN_USE'
  readonly kioskIds: string[]

  constructor(requirements: RestockRequirement[]) {
    const kioskIds = [...new Set(requirements.map((r) => r.kioskId))]
    super(
      'Deze telling kan niet zonder controle opnieuw worden goedgekeurd, omdat er al ' +
        'voorraad is ingepland of geleverd voor ' +
        `${kioskIds.length === 1 ? 'een kiosk' : `${kioskIds.length} kiosken`} in deze ronde. ` +
        'Annuleer eerst de betreffende vulrondes.'
    )
    this.name = 'RequirementInUseError'
    this.kioskIds = kioskIds
  }
}

/**
 * Keurt een telronde goed en trekt de bijvulbehoeften gelijk.
 *
 * Twee keer goedkeuren levert dezelfde behoeften op, zonder duplicaten en
 * zonder verlies van al geleverde aantallen. Wordt een tekort na correctie nul,
 * dan vervalt de behoefte ook echt — tenzij er al voorraad voor vastligt; dan
 * stopt de goedkeuring en moet er eerst een vulronde geannuleerd worden.
 */
export async function approveSession(session: CountSession): Promise<ApprovalResult> {
  const prepared = await prepareSessionForApproval(session)
  if (prepared.blockers.length > 0) {
    throw new Error(prepared.blockers.map((b) => b.message).join(' '))
  }

  const fresh = prepared.session
  const kioskCounts = prepared.overview.kiosks
    .map((k) => k.kioskCount)
    .filter((kc): kc is KioskCount => kc !== null)

  const entriesByKioskCount = new Map<string, CountEntry[]>()
  for (const kioskCount of kioskCounts) {
    entriesByKioskCount.set(kioskCount.id, await loadEntriesForApproval(kioskCount.id))
  }

  const restock = repositories.restock()
  const reconciliation = reconcileRestockRequirements({
    eventId: fresh.eventId,
    kioskCounts,
    entriesByKioskCount,
    existing: await restock.getRequirements(fresh.eventId),
    scopeKioskIds: fresh.kioskRoute,
  })

  if (reconciliation.blocked.length > 0) {
    throw new RequirementInUseError(reconciliation.blocked)
  }

  const writes = [...reconciliation.toUpsert, ...reconciliation.toClear]
  if (writes.length > 0) {
    await restock.bulkUpsertRequirements(writes)
  }

  // De gedocumenteerde weg loopt via "ingediend"; ook wie direct vanaf de
  // vloer goedkeurt zet die stap, zodat de historie één patroon houdt.
  let current = fresh
  if (
    current.status !== CountSessionStatus.SUBMITTED &&
    current.status !== CountSessionStatus.APPROVED
  ) {
    current = await transitionSession(current, CountSessionStatus.SUBMITTED, {
      completedAt: current.completedAt ?? new Date().toISOString(),
    })
  }
  await transitionSession(current, CountSessionStatus.APPROVED, { syncEvent: true })

  return {
    requirementCount: reconciliation.active.length,
    totalPackages: reconciliation.active.reduce(
      (sum: number, draft: RequirementDraft) => sum + draft.requiredPackages,
      0
    ),
    clearedCount: reconciliation.toClear.length,
  }
}

export interface ReopenResult {
  session: CountSession
  kioskCount: KioskCount
  /** Behoeften die op nul zijn gezet omdat de telling wordt herzien. */
  clearedRequirements: number
  /**
   * Behoeften die blijven staan omdat er al voorraad voor vastligt. Die moeten
   * eerst via een geannuleerde vulronde worden vrijgegeven.
   */
  requirementsInUse: number
}

/**
 * Heropent één kiosk binnen een telronde.
 *
 * Bij een al goedgekeurde ronde is dat meer dan één vinkje terugzetten: de
 * ronde is niet langer definitief, het evenement staat niet langer klaar om te
 * vullen, en de bijvulbehoeften van die kiosk zijn gebaseerd op cijfers die nu
 * worden herzien. Die worden daarom op nul gezet — bij een nieuwe goedkeuring
 * komen ze terug met het gecorrigeerde aantal.
 *
 * Wat al gereserveerd of geleverd is blijft staan: die leverhistorie mag niet
 * verdwijnen. De planner krijgt het aantal terug en kan de vulronde annuleren.
 */
export async function reopenApprovedKiosk(params: {
  session: CountSession
  kioskCount: KioskCount
}): Promise<ReopenResult> {
  const { session, kioskCount } = params
  const reopened = await reopenKiosk(kioskCount)

  const isFinalised =
    session.status === CountSessionStatus.APPROVED ||
    session.status === CountSessionStatus.SUBMITTED

  if (!isFinalised) {
    return {
      session,
      kioskCount: reopened,
      clearedRequirements: 0,
      requirementsInUse: 0,
    }
  }

  const restock = repositories.restock()
  const forKiosk = (await restock.getRequirements(session.eventId)).filter(
    (requirement) =>
      requirement.kioskId === kioskCount.kioskId && requirement.requiredPackages > 0
  )
  const stale = forKiosk.filter((requirement) => !isRequirementInUse(requirement))

  if (stale.length > 0) {
    await restock.bulkUpsertRequirements(
      stale.map((requirement) => ({
        eventId: requirement.eventId,
        kioskId: requirement.kioskId,
        productId: requirement.productId,
        requiredPackages: 0,
        reservedPackages: 0,
        deliveredPackages: 0,
      }))
    )
  }

  const updated = await transitionSession(session, CountSessionStatus.REOPENED, {
    syncEvent: true,
    completedAt: null,
  })

  return {
    session: updated,
    kioskCount: reopened,
    clearedRequirements: stale.length,
    requirementsInUse: forKiosk.length - stale.length,
  }
}

/** Telregels voor goedkeuring: server is leidend, lokaal als terugval. */
async function loadEntriesForApproval(kioskCountId: string): Promise<CountEntry[]> {
  try {
    const remote = await repositories.count().getEntriesForKioskCount(kioskCountId)
    if (remote.length > 0) return remote
  } catch (error) {
    console.warn('[telling] Telregels niet van de server te laden; lokale versie gebruikt.', error)
  }
  return getLocalEntries(kioskCountId)
}

// ─── Weggooien ───────────────────────────────────────────────────────────────

/**
 * Telt op wat er in een ronde zit, zodat de waarschuwing een getal kan noemen
 * in plaats van "weet je het zeker?".
 */
export async function summariseSessionForDiscard(
  session: CountSession
): Promise<DiscardSummary> {
  const kioskCounts = await loadKioskCounts(session.id)
  const entries = await repositories.count().getEntriesForSession(session.id)

  return {
    kioskCount: kioskCounts.filter((kc) => kc.status !== KioskCountStatus.PENDING).length,
    entryCount: entries.length,
  }
}

/**
 * Bijvulbehoeften die aan deze kiosken hangen op nul zetten.
 *
 * Ze hangen aan het evenement en niet aan de telronde, dus ze blijven staan
 * wanneer de ronde verdwijnt — een tekort dat nergens meer op slaat. Wat al
 * gereserveerd of geleverd is blijft onaangeroerd en levert een fout op: die
 * voorraad ligt fysiek vast, en stil weggooien zou een vulronde laten wijzen
 * naar iets dat niet meer bestaat.
 */
async function clearRequirementsForKiosks(
  eventId: string,
  kioskIds: string[]
): Promise<number> {
  if (kioskIds.length === 0) return 0

  const restock = repositories.restock()
  const betrokken = (await restock.getRequirements(eventId)).filter(
    (requirement) =>
      kioskIds.includes(requirement.kioskId) && requirement.requiredPackages > 0
  )

  const inUse = betrokken.filter(isRequirementInUse)
  if (inUse.length > 0) throw new RequirementInUseError(inUse)

  if (betrokken.length > 0) {
    await restock.bulkUpsertRequirements(
      betrokken.map((requirement) => ({
        eventId: requirement.eventId,
        kioskId: requirement.kioskId,
        productId: requirement.productId,
        requiredPackages: 0,
        reservedPackages: 0,
        deliveredPackages: 0,
      }))
    )
  }

  return betrokken.length
}

/** Gooit een telronde weg met alles eraan. Niet terug te draaien. */
export async function discardSession(session: CountSession): Promise<void> {
  assertMayDiscardSession(session)

  const kioskCounts = await loadKioskCounts(session.id)
  await clearRequirementsForKiosks(
    session.eventId,
    kioskCounts.map((kc) => kc.kioskId)
  )

  await repositories.count().deleteSession(session.id)
  await forgetSessionLocally(session.id)
}

/**
 * Haalt het telwerk van één kiosk uit een lopende ronde, zodat hij opnieuw
 * geteld kan worden.
 */
export async function resetKioskCount(params: {
  session: CountSession
  kioskCount: KioskCount
}): Promise<void> {
  const { session, kioskCount } = params
  assertMayResetKiosk(session)

  await clearRequirementsForKiosks(session.eventId, [kioskCount.kioskId])
  await repositories.count().deleteKioskCount(kioskCount.id)
  await forgetKioskCountLocally(kioskCount.id)
}
