import { repositories } from '@/repositories'
import { syncService } from './syncService'
import { KeyedQueue } from '@/lib/keyedQueue'
import { countEntryId, kioskCountId as deriveKioskCountId, newId } from '@/lib/ids'
import { calculateRestockQuantity } from '@/domain/counting/calculateRestock'
import { fromQuarterUnits } from '@/lib/quarterUnits'
import { KioskCountStatus, CountSessionStatus, SyncStatus } from '@/types'
import type { CountSession, KioskCount, CountEntry, KioskProductStandard } from '@/types'
import {
  getLocalSession,
  saveCountSessionLocally,
  getLocalKioskCount,
  getLocalKioskCounts,
  saveKioskCountLocally,
  getLocalEntries,
  saveCountEntryLocally,
  deleteLocalEntry,
  getPendingOutboxEntries,
  saveConflict,
} from '@/lib/db/offlineDb'

/**
 * Alle telacties op één plek.
 *
 * Uitgangspunt: lokaal is leidend tijdens het tellen. Iedere wijziging gaat
 * zonder vertraging naar IndexedDB; de server volgt via de outbox. Zo kan een
 * telling nooit verloren gaan doordat iemand direct doorloopt naar de volgende
 * kiosk of de app sluit.
 */

/** Serieert schrijfacties per telregel en maakt `flushPendingCountWrites` mogelijk. */
const writeQueue = new KeyedQueue()

/** Wacht tot alle lokale telwijzigingen echt zijn weggeschreven. */
export async function flushPendingCountWrites(): Promise<void> {
  await writeQueue.flush()
}

// ─── Laden ────────────────────────────────────────────────────────────────────

/**
 * Haalt de telronde op: eerst lokaal (direct beschikbaar, werkt offline),
 * daarna de server. Serverresultaten worden lokaal gecachet.
 */
export async function loadSession(sessionId: string): Promise<CountSession | null> {
  const local = await getLocalSession(sessionId)
  if (local) {
    // Op de achtergrond bijwerken; de gebruiker wacht hier niet op.
    void refreshSessionFromServer(sessionId, local)
    return local
  }

  try {
    const remote = await repositories.count().getSessionById(sessionId)
    if (remote) {
      await saveCountSessionLocally(remote)
      return remote
    }
  } catch (error) {
    console.warn('[counting] Telronde niet van de server te laden.', error)
  }
  return null
}

async function refreshSessionFromServer(sessionId: string, local: CountSession): Promise<void> {
  try {
    const remote = await repositories.count().getSessionById(sessionId)
    if (remote && remote.updatedAt > local.updatedAt) {
      await saveCountSessionLocally(remote)
    }
  } catch {
    // Offline is geen fout: de lokale versie blijft gewoon geldig.
  }
}

export async function saveSession(session: CountSession): Promise<CountSession> {
  const updated = { ...session, updatedAt: new Date().toISOString() }
  await writeQueue.run(`session:${session.id}`, async () => {
    await saveCountSessionLocally(updated)
  })
  await syncService.enqueue('countSession', updated.id, 'update', updated)
  return updated
}

export async function createSession(
  data: Omit<CountSession, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'syncStatus'>
): Promise<CountSession> {
  const now = new Date().toISOString()
  const session: CountSession = {
    ...data,
    id: newId(),
    status: CountSessionStatus.IN_PROGRESS,
    syncStatus: SyncStatus.LOCAL,
    createdAt: now,
    updatedAt: now,
  }
  await saveCountSessionLocally(session)
  await syncService.enqueue('countSession', session.id, 'create', session)
  return session
}

/**
 * Haalt de kiosktelling op, of maakt hem aan wanneer die nog niet bestaat.
 * Het id is afgeleid van (sessie, kiosk), zodat twee apparaten nooit twee
 * kiosktellingen voor dezelfde kiosk maken.
 */
export async function loadOrCreateKioskCount(params: {
  sessionId: string
  kioskId: string
  counterId: string
}): Promise<KioskCount> {
  const { sessionId, kioskId, counterId } = params

  const local = await getLocalKioskCount(sessionId, kioskId)
  if (local) return local

  try {
    const remoteCounts = await repositories.count().getKioskCountsForSession(sessionId)
    const remote = remoteCounts.find((kc) => kc.kioskId === kioskId)
    if (remote) {
      await saveKioskCountLocally(remote)
      return remote
    }
  } catch (error) {
    console.warn('[counting] Kiosktelling niet van de server te laden.', error)
  }

  const now = new Date().toISOString()
  const created: KioskCount = {
    id: deriveKioskCountId(sessionId, kioskId),
    countSessionId: sessionId,
    kioskId,
    startedAt: now,
    counterId,
    status: KioskCountStatus.IN_PROGRESS,
    createdAt: now,
    updatedAt: now,
  }
  await saveKioskCountLocally(created)
  await syncService.enqueue('kioskCount', created.id, 'create', created)
  return created
}

/** Alle kiosktellingen van een telronde: lokaal en server samengevoegd. */
export async function loadKioskCounts(sessionId: string): Promise<KioskCount[]> {
  const local = await getLocalKioskCounts(sessionId)
  const byKiosk = new Map(local.map((kc) => [kc.kioskId, kc]))

  try {
    const remote = await repositories.count().getKioskCountsForSession(sessionId)
    for (const remoteCount of remote) {
      const localCount = byKiosk.get(remoteCount.kioskId)
      if (!localCount || remoteCount.updatedAt > localCount.updatedAt) {
        byKiosk.set(remoteCount.kioskId, remoteCount)
        await saveKioskCountLocally(remoteCount)
      }
    }
  } catch {
    // Offline: de lokale kiosktellingen zijn wat we hebben.
  }

  return [...byKiosk.values()]
}

/**
 * Telregels van een kiosk, lokaal en server samengevoegd op `lastModifiedAt`.
 *
 * Een echt conflict ontstaat alleen wanneer de lokale versie nog niet
 * gesynchroniseerd is én de server intussen een andere waarde heeft. Dan
 * winnen de lokale cijfers (die zijn ter plekke geteld) en wordt het verschil
 * vastgelegd voor de planner.
 */
export async function loadEntries(kioskCountId: string): Promise<Map<string, CountEntry>> {
  const local = await getLocalEntries(kioskCountId)
  const merged = new Map<string, CountEntry>(local.map((entry) => [entry.productId, entry]))

  let remote: CountEntry[] = []
  try {
    remote = await repositories.count().getEntriesForKioskCount(kioskCountId)
  } catch {
    // Offline: lokale telling blijft staan. Dit is precies het geval waarin
    // een refresh de telling niet mag leegmaken.
    return merged
  }

  const pendingIds = new Set((await getPendingOutboxEntries()).map((e) => e.id))

  for (const remoteEntry of remote) {
    const localEntry = merged.get(remoteEntry.productId)

    if (!localEntry) {
      merged.set(remoteEntry.productId, remoteEntry)
      await saveCountEntryLocally(remoteEntry)
      continue
    }

    const valuesDiffer =
      localEntry.countedQuantityQuarters !== remoteEntry.countedQuantityQuarters
    if (!valuesDiffer) continue

    const localNotYetSynced = pendingIds.has(`countEntry:${localEntry.id}`)

    if (localNotYetSynced && remoteEntry.lastModifiedAt > localEntry.lastModifiedAt) {
      await saveConflict({
        id: `countEntry:${localEntry.id}`,
        entityType: 'countEntry',
        entityId: localEntry.id,
        localVersion: localEntry,
        serverVersion: remoteEntry,
        detectedAt: new Date().toISOString(),
      })
      continue // lokale waarde blijft zichtbaar
    }

    if (remoteEntry.lastModifiedAt > localEntry.lastModifiedAt) {
      merged.set(remoteEntry.productId, remoteEntry)
      await saveCountEntryLocally(remoteEntry)
    }
  }

  return merged
}

// ─── Schrijven ────────────────────────────────────────────────────────────────

export interface SaveCountParams {
  kioskCountId: string
  productId: string
  standard: Pick<KioskProductStandard, 'targetQuantityQuarters' | 'halfPackageThresholdPercentage'>
  countedQuarters: number
  userId: string
}

/** Bouwt een telregel inclusief bijvuladvies. Pure functie — makkelijk te testen. */
export function buildCountEntry(params: SaveCountParams): CountEntry {
  const { kioskCountId, productId, standard, countedQuarters, userId } = params

  const result = calculateRestockQuantity({
    targetQuantity: fromQuarterUnits(standard.targetQuantityQuarters),
    countedQuantity: fromQuarterUnits(countedQuarters),
    halfPackageThresholdPercentage: standard.halfPackageThresholdPercentage,
  })

  return {
    id: countEntryId(kioskCountId, productId),
    kioskCountId,
    productId,
    targetQuantityQuarters: standard.targetQuantityQuarters,
    countedQuantityQuarters: countedQuarters,
    effectiveQuantityQuarters: Math.round(result.effectiveQuantity * 4),
    restockQuantityPackages: result.restockQuantity,
    appliedFractionRule: result.appliedFractionRule,
    lastModifiedAt: new Date().toISOString(),
    lastModifiedById: userId,
  }
}

/**
 * Slaat een telling op. Lokaal zonder vertraging, server via de outbox.
 * De promise is klaar zodra de lokale schrijfactie rond is.
 */
export async function saveCount(params: SaveCountParams): Promise<CountEntry> {
  const entry = buildCountEntry(params)
  const key = `entry:${entry.id}`

  await writeQueue.run(key, async () => {
    await saveCountEntryLocally(entry)
  })

  await syncService.enqueue('countEntry', entry.id, 'update', entry)
  return entry
}

/** Zet een product terug naar "nog niet geteld". */
export async function clearCount(
  kioskCountId: string,
  productId: string,
  userId: string
): Promise<void> {
  const id = countEntryId(kioskCountId, productId)
  await writeQueue.run(`entry:${id}`, async () => {
    await deleteLocalEntry(kioskCountId, productId)
  })
  await syncService.enqueue('countEntry', id, 'delete', {
    id,
    kioskCountId,
    productId,
    lastModifiedById: userId,
  })
}

async function persistKioskCount(kioskCount: KioskCount): Promise<KioskCount> {
  const updated = { ...kioskCount, updatedAt: new Date().toISOString() }
  await writeQueue.run(`kioskCount:${updated.id}`, async () => {
    await saveKioskCountLocally(updated)
  })
  await syncService.enqueue('kioskCount', updated.id, 'update', updated)
  return updated
}

export async function saveKioskNotes(
  kioskCount: KioskCount,
  generalNotes: string
): Promise<KioskCount> {
  return persistKioskCount({ ...kioskCount, generalNotes: generalNotes.trim() || undefined })
}

/**
 * Rondt een kiosk af. Wacht eerst tot alle telwijzigingen zijn weggeschreven,
 * zodat de laatst ingevoerde waarde gegarandeerd meetelt.
 */
export async function completeKiosk(kioskCount: KioskCount): Promise<KioskCount> {
  await flushPendingCountWrites()
  return persistKioskCount({
    ...kioskCount,
    status: KioskCountStatus.COMPLETED,
    completedAt: new Date().toISOString(),
  })
}

export async function skipKiosk(
  kioskCount: KioskCount,
  skipReason: string
): Promise<KioskCount> {
  const reason = skipReason.trim()
  if (!reason) {
    throw new Error('Een kiosk overslaan kan alleen met een reden.')
  }
  await flushPendingCountWrites()
  return persistKioskCount({
    ...kioskCount,
    status: KioskCountStatus.SKIPPED,
    skipReason: reason,
    completedAt: new Date().toISOString(),
  })
}

/** Zet een afgeronde of overgeslagen kiosk terug op "bezig". */
export async function reopenKiosk(kioskCount: KioskCount): Promise<KioskCount> {
  return persistKioskCount({
    ...kioskCount,
    status: KioskCountStatus.IN_PROGRESS,
    completedAt: undefined,
    skipReason: undefined,
  })
}

// ─── Volledigheid ─────────────────────────────────────────────────────────────

export interface CompletenessResult {
  /** Producten waarvoor nog geen telling is ingevuld. */
  missingProductIds: string[]
  countedProductIds: string[]
  requiredCount: number
  isComplete: boolean
}

/**
 * Bepaalt of alle verplichte producten van een kiosk geteld zijn.
 *
 * Een expliciete 0 telt als ingevuld; een ontbrekende waarde niet. Daarom
 * wordt op aanwezigheid van de sleutel gecontroleerd en niet op de waarde.
 */
export function getCompleteness(
  requiredProductIds: string[],
  counts: ReadonlyMap<string, number>
): CompletenessResult {
  const missingProductIds = requiredProductIds.filter((id) => counts.get(id) === undefined)
  const countedProductIds = requiredProductIds.filter((id) => counts.get(id) !== undefined)
  return {
    missingProductIds,
    countedProductIds,
    requiredCount: requiredProductIds.length,
    isComplete: missingProductIds.length === 0,
  }
}
