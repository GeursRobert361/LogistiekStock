import Dexie, { type Table } from 'dexie'
import type { CountSession, KioskCount, CountEntry, OutboxEntry, SyncConflict } from '@/types'
import { countEntryId } from '@/lib/ids'

/**
 * Dexie (IndexedDB) database voor offline opslag.
 *
 * Dit is de bron van waarheid voor de teller: iedere wijziging landt hier
 * direct, ook zonder verbinding. De outbox bevat de mutaties die nog naar de
 * server moeten.
 */
class OfflineDatabase extends Dexie {
  countSessions!: Table<CountSession>
  kioskCounts!: Table<KioskCount>
  countEntries!: Table<CountEntry>
  outbox!: Table<OutboxEntry>
  conflicts!: Table<SyncConflict>

  constructor(name = 'LogistiekStockDB') {
    super(name)

    this.version(1).stores({
      countSessions: 'id, eventId, userId, status, syncStatus',
      kioskCounts: 'id, countSessionId, kioskId, status',
      countEntries: 'id, kioskCountId, productId',
      outbox: 'id, entityType, entityId, createdAt, attempts',
      conflicts: 'id, entityType, entityId, detectedAt',
    })

    // v2: samengestelde indexen op de natuurlijke sleutels. Oudere versies
    // konden per wijziging een nieuwe UUID aanmaken; die duplicaten worden
    // hier opgeruimd.
    this.version(2)
      .stores({
        countSessions: 'id, eventId, userId, status, syncStatus',
        kioskCounts: 'id, countSessionId, kioskId, status, [countSessionId+kioskId]',
        countEntries: 'id, kioskCountId, productId, [kioskCountId+productId]',
        outbox: 'id, entityType, entityId, createdAt, attempts',
        conflicts: 'id, entityType, entityId, detectedAt',
      })
      .upgrade(async (tx) => {
        const entries = await tx.table<CountEntry>('countEntries').toArray()
        const newestByKey = new Map<string, CountEntry>()

        for (const entry of entries) {
          const key = `${entry.kioskCountId}:${entry.productId}`
          const existing = newestByKey.get(key)
          if (!existing || entry.lastModifiedAt > existing.lastModifiedAt) {
            newestByKey.set(key, entry)
          }
        }

        await tx.table('countEntries').clear()
        await tx.table<CountEntry>('countEntries').bulkPut(
          [...newestByKey.values()].map((entry) => ({
            ...entry,
            id: countEntryId(entry.kioskCountId, entry.productId),
          }))
        )
      })
  }
}

let db: OfflineDatabase | null = null

export function getOfflineDb(): OfflineDatabase {
  if (!db) {
    db = new OfflineDatabase()
  }
  return db
}

// ─── Telrondes ────────────────────────────────────────────────────────────────

export async function saveCountSessionLocally(session: CountSession): Promise<void> {
  await getOfflineDb().countSessions.put(session)
}

export async function getLocalSession(id: string): Promise<CountSession | undefined> {
  return getOfflineDb().countSessions.get(id)
}

export async function getLocalSessionsForEvent(eventId: string): Promise<CountSession[]> {
  return getOfflineDb().countSessions.where('eventId').equals(eventId).toArray()
}

// ─── Kiosktellingen ───────────────────────────────────────────────────────────

export async function saveKioskCountLocally(count: KioskCount): Promise<void> {
  await getOfflineDb().kioskCounts.put(count)
}

export async function getLocalKioskCounts(sessionId: string): Promise<KioskCount[]> {
  return getOfflineDb().kioskCounts.where('countSessionId').equals(sessionId).toArray()
}

export async function getLocalKioskCount(
  sessionId: string,
  kioskId: string
): Promise<KioskCount | undefined> {
  return getOfflineDb()
    .kioskCounts.where('[countSessionId+kioskId]')
    .equals([sessionId, kioskId])
    .first()
}

// ─── Telregels ────────────────────────────────────────────────────────────────

export async function saveCountEntryLocally(entry: CountEntry): Promise<void> {
  await getOfflineDb().countEntries.put(entry)
}

export async function getLocalEntries(kioskCountId: string): Promise<CountEntry[]> {
  return getOfflineDb().countEntries.where('kioskCountId').equals(kioskCountId).toArray()
}

export async function getLocalEntry(
  kioskCountId: string,
  productId: string
): Promise<CountEntry | undefined> {
  return getOfflineDb()
    .countEntries.where('[kioskCountId+productId]')
    .equals([kioskCountId, productId])
    .first()
}

export async function deleteLocalEntry(kioskCountId: string, productId: string): Promise<void> {
  await getOfflineDb().countEntries.delete(countEntryId(kioskCountId, productId))
}

// ─── Outbox ───────────────────────────────────────────────────────────────────

export const MAX_OUTBOX_ATTEMPTS = 8

export async function addToOutbox(
  entry: Omit<OutboxEntry, 'attempts' | 'createdAt'>
): Promise<void> {
  const existing = await getOfflineDb().outbox.get(entry.id)
  await getOfflineDb().outbox.put({
    ...entry,
    // Een nieuwe mutatie op dezelfde entiteit vervangt de oude en begint
    // opnieuw met tellen — de laatste waarde is immers de waarheid.
    attempts: 0,
    error: undefined,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
  })
}

export async function getPendingOutboxEntries(): Promise<OutboxEntry[]> {
  const all = await getOfflineDb().outbox.toArray()
  return all
    .filter((e) => e.attempts < MAX_OUTBOX_ATTEMPTS)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

export async function getFailedOutboxEntries(): Promise<OutboxEntry[]> {
  const all = await getOfflineDb().outbox.toArray()
  return all.filter((e) => e.attempts >= MAX_OUTBOX_ATTEMPTS)
}

export async function countOutboxEntries(): Promise<number> {
  return getOfflineDb().outbox.count()
}

export async function markOutboxEntrySuccess(id: string): Promise<void> {
  await getOfflineDb().outbox.delete(id)
}

export async function markOutboxEntryFailed(id: string, error: string): Promise<void> {
  const entry = await getOfflineDb().outbox.get(id)
  if (!entry) return
  await getOfflineDb().outbox.put({
    ...entry,
    attempts: entry.attempts + 1,
    error,
    lastAttemptAt: new Date().toISOString(),
  })
}

// ─── Conflicten ───────────────────────────────────────────────────────────────

export async function saveConflict(conflict: SyncConflict): Promise<void> {
  await getOfflineDb().conflicts.put(conflict)
}

export async function getUnresolvedConflicts(): Promise<SyncConflict[]> {
  const all = await getOfflineDb().conflicts.toArray()
  return all.filter((c) => !c.resolvedAt)
}

export async function countUnresolvedConflicts(): Promise<number> {
  return (await getUnresolvedConflicts()).length
}

export async function markConflictResolved(id: string, resolvedBy: string): Promise<void> {
  const conflict = await getOfflineDb().conflicts.get(id)
  if (!conflict) return
  await getOfflineDb().conflicts.put({
    ...conflict,
    resolvedAt: new Date().toISOString(),
    resolvedBy,
  })
}
