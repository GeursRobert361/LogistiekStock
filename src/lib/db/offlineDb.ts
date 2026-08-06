import Dexie, { type Table } from 'dexie'
import type { CountSession, KioskCount, CountEntry, OutboxEntry, SyncConflict } from '@/types'

/**
 * Dexie (IndexedDB) database voor offline opslag.
 * Slaat telrondes, kiosktellingen en entries lokaal op.
 * OutboxEntries worden gesynchroniseerd zodra internet terugkomt.
 */
class OfflineDatabase extends Dexie {
  countSessions!: Table<CountSession>
  kioskCounts!: Table<KioskCount>
  countEntries!: Table<CountEntry>
  outbox!: Table<OutboxEntry>
  conflicts!: Table<SyncConflict>

  constructor() {
    super('LogistiekStockDB')
    this.version(1).stores({
      countSessions: 'id, eventId, userId, status, syncStatus',
      kioskCounts: 'id, countSessionId, kioskId, status',
      countEntries: 'id, kioskCountId, productId',
      outbox: 'id, entityType, entityId, createdAt, attempts',
      conflicts: 'id, entityType, entityId, detectedAt',
    })
  }
}

// Singleton
let db: OfflineDatabase | null = null

export function getOfflineDb(): OfflineDatabase {
  if (!db) {
    db = new OfflineDatabase()
  }
  return db
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export async function saveCountSessionLocally(session: CountSession): Promise<void> {
  await getOfflineDb().countSessions.put(session)
}

export async function saveKioskCountLocally(count: KioskCount): Promise<void> {
  await getOfflineDb().kioskCounts.put(count)
}

export async function saveCountEntryLocally(entry: CountEntry): Promise<void> {
  await getOfflineDb().countEntries.put(entry)
}

export async function getLocalSession(id: string): Promise<CountSession | undefined> {
  return getOfflineDb().countSessions.get(id)
}

export async function getLocalKioskCounts(sessionId: string): Promise<KioskCount[]> {
  return getOfflineDb().kioskCounts.where('countSessionId').equals(sessionId).toArray()
}

export async function getLocalEntries(kioskCountId: string): Promise<CountEntry[]> {
  return getOfflineDb().countEntries.where('kioskCountId').equals(kioskCountId).toArray()
}

export async function addToOutbox(
  entry: Omit<OutboxEntry, 'attempts' | 'createdAt'>
): Promise<void> {
  await getOfflineDb().outbox.put({
    ...entry,
    attempts: 0,
    createdAt: new Date().toISOString(),
  })
}

export async function getPendingOutboxEntries(): Promise<OutboxEntry[]> {
  return getOfflineDb().outbox
    .filter((e) => e.attempts < 5)
    .toArray()
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
