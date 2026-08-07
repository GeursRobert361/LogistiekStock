import { repositories } from '@/repositories'
import { CountSessionStatus, KioskCountStatus, EventStatus } from '@/types'
import type { CountSession, KioskCount, CountEntry } from '@/types'
import { loadKioskCounts, saveSession, flushPendingCountWrites } from './countingService'
import { buildRestockRequirements } from '@/domain/restocking/buildRequirements'
import { getLocalEntries } from '@/lib/db/offlineDb'
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
 * Zet de telronde op SUBMITTED zodra elke kiosk uit de route is afgerond of
 * bewust overgeslagen. Geeft terug of dat gebeurd is.
 */
export async function finishSessionIfComplete(session: CountSession): Promise<boolean> {
  if (session.status === CountSessionStatus.SUBMITTED || session.status === CountSessionStatus.APPROVED) {
    return true
  }

  const overview = await getSessionOverview(session)
  if (!overview.isFullyHandled) return false

  await saveSession({
    ...session,
    status: CountSessionStatus.SUBMITTED,
    completedAt: new Date().toISOString(),
  })
  return true
}

export async function pauseSession(session: CountSession): Promise<CountSession> {
  await flushPendingCountWrites()
  return saveSession({ ...session, status: CountSessionStatus.PAUSED })
}

export async function resumeSession(session: CountSession): Promise<CountSession> {
  return saveSession({ ...session, status: CountSessionStatus.IN_PROGRESS })
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

/**
 * Controleert of een telronde goedgekeurd mag worden.
 * Online mogen er geen lokale wijzigingen meer klaarstaan — anders zou de
 * bijvullijst op onvolledige cijfers worden gebaseerd.
 */
export async function getApprovalBlockers(
  overview: SessionOverview
): Promise<ApprovalBlocker[]> {
  const blockers: ApprovalBlocker[] = []

  const open = overview.notStartedCount + overview.inProgressCount
  if (open > 0) {
    blockers.push({
      code: 'OPEN_KIOSKS',
      message: `${open} ${open === 1 ? 'kiosk is' : 'kiosken zijn'} nog niet afgerond of overgeslagen.`,
    })
  }

  const isOnline = typeof navigator === 'undefined' || navigator.onLine
  if (isOnline) {
    const pending = await getPendingOutboxEntries()
    if (pending.length > 0) {
      blockers.push({
        code: 'UNSYNCED_CHANGES',
        message: `${pending.length} wijziging${pending.length === 1 ? '' : 'en'} ${
          pending.length === 1 ? 'is' : 'zijn'
        } nog niet gesynchroniseerd.`,
      })
    }
  }

  return blockers
}

export interface ApprovalResult {
  requirementCount: number
  totalPackages: number
}

/**
 * Keurt een telronde goed en genereert de bijvulbehoeften.
 *
 * De generatie is idempotent: dezelfde telling twee keer goedkeuren levert
 * dezelfde behoeften op, zonder duplicaten en zonder verlies van al geleverde
 * aantallen.
 */
export async function approveSession(session: CountSession): Promise<ApprovalResult> {
  const overview = await getSessionOverview(session)
  const blockers = await getApprovalBlockers(overview)
  if (blockers.length > 0) {
    throw new Error(blockers.map((b) => b.message).join(' '))
  }

  const completed = overview.kiosks
    .map((k) => k.kioskCount)
    .filter((kc): kc is KioskCount => kc !== null)

  const entriesByKioskCount = new Map<string, CountEntry[]>()
  for (const kioskCount of completed) {
    entriesByKioskCount.set(kioskCount.id, await loadEntriesForApproval(kioskCount.id))
  }

  const existing = await repositories.restock().getRequirements(session.eventId)
  const drafts = buildRestockRequirements({
    eventId: session.eventId,
    kioskCounts: completed,
    entriesByKioskCount,
    existing,
  })

  await repositories.restock().bulkUpsertRequirements(drafts)

  await saveSession({ ...session, status: CountSessionStatus.APPROVED })

  // Het evenement schuift mee op naar de vulfase.
  try {
    await repositories.event().updateEventStatus(session.eventId, EventStatus.READY_FOR_RESTOCK)
  } catch (error) {
    console.error('[telling] Evenementstatus bijwerken mislukt.', error)
  }

  return {
    requirementCount: drafts.length,
    totalPackages: drafts.reduce((sum, d) => sum + d.requiredPackages, 0),
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
