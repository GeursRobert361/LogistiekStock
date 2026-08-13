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

  // De naam blijft `LogistiekStockDB`, ook nu de app StockFlow heet. Dit is de
  // sleutel waaronder IndexedDB op het toestel van de teller staat: hernoemen
  // opent een lege database en laat een niet-gesynchroniseerde telling met zijn
  // outbox onbereikbaar achter. Een naam die niemand ziet is dat niet waard.
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

/**
 * Vergeet een kiosktelling die van de server is verdwenen.
 *
 * Zonder dit blijft het apparaat de oude telling tonen en blijft er werk in de
 * wachtrij staan voor iets dat niet meer bestaat. Voor andere apparaten doet de
 * server dit werk: die weigert een regel voor een verdwenen kiosktelling.
 */
export async function forgetKioskCountLocally(kioskCountId: string): Promise<void> {
  const db = getOfflineDb()

  // Telregels staan in de outbox onder hun eigen id, niet onder dat van de
  // kiosktelling. Ze moeten dus eerst opgezocht worden -- na het verwijderen
  // is niet meer te achterhalen welke regels het waren, en dan blijft er werk
  // in de wachtrij staan voor iets dat niet meer bestaat.
  const entries = await db.countEntries.where('kioskCountId').equals(kioskCountId).toArray()
  const ids = [kioskCountId, ...entries.map((entry) => entry.id)]

  await db.outbox.where('entityId').anyOf(ids).delete()
  await db.countEntries.where('kioskCountId').equals(kioskCountId).delete()
  await db.kioskCounts.delete(kioskCountId)
}

/** Vergeet een hele telronde, inclusief wat er nog voor in de wachtrij stond. */
export async function forgetSessionLocally(sessionId: string): Promise<void> {
  const db = getOfflineDb()

  for (const kioskCount of await db.kioskCounts.where('countSessionId').equals(sessionId).toArray()) {
    await forgetKioskCountLocally(kioskCount.id)
  }

  await db.countSessions.delete(sessionId)
  await db.outbox.where('entityId').equals(sessionId).delete()
}

// ─── Outbox ───────────────────────────────────────────────────────────────────

/**
 * Wachttijd voor de volgende poging, oplopend per mislukking.
 *
 * De app geeft nooit uit zichzelf op: tijdens het tellen is er geen moment om
 * een knop te zoeken. Wel wordt de tussenpoos groter, zodat een lange storing
 * niet elke seconde het netwerk en de accu belast. Na de laatste stap blijft
 * hij op twee minuten staan.
 */
const RETRY_BACKOFF_MS = [2_000, 5_000, 15_000, 30_000, 60_000, 120_000]

export function getRetryDelayMs(attempts: number): number {
  return RETRY_BACKOFF_MS[Math.min(attempts, RETRY_BACKOFF_MS.length - 1)]!
}

export async function addToOutbox(
  entry: Omit<OutboxEntry, 'attempts' | 'createdAt'>
): Promise<void> {
  const existing = await getOfflineDb().outbox.get(entry.id)
  await getOfflineDb().outbox.put({
    ...entry,
    // Een nieuwe mutatie op dezelfde entiteit vervangt de oude en begint
    // opnieuw met tellen — de laatste waarde is immers de waarheid. Ook een
    // eerdere weigering vervalt: de nieuwe inhoud kan best geldig zijn.
    attempts: 0,
    error: undefined,
    nextAttemptAt: undefined,
    isPermanent: undefined,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    revision: (existing?.revision ?? 0) + 1,
  })
}

/** Mutaties die nu geprobeerd mogen worden. */
export async function getDueOutboxEntries(): Promise<OutboxEntry[]> {
  const now = Date.now()
  const all = await getOfflineDb().outbox.toArray()
  return all
    .filter((e) => !e.isPermanent)
    .filter((e) => !e.nextAttemptAt || new Date(e.nextAttemptAt).getTime() <= now)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

/** Alles wat nog naar de server moet, of het nu aan de beurt is of niet. */
export async function getPendingOutboxEntries(): Promise<OutboxEntry[]> {
  const all = await getOfflineDb().outbox.toArray()
  return all.filter((e) => !e.isPermanent).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

/** Mutaties die de server heeft geweigerd; die lossen zichzelf niet op. */
export async function getRejectedOutboxEntries(): Promise<OutboxEntry[]> {
  const all = await getOfflineDb().outbox.toArray()
  return all.filter((e) => e.isPermanent === true)
}

/** Vroegste moment waarop er weer iets te proberen valt, of null. */
export async function getNextRetryAt(): Promise<Date | null> {
  const pending = await getPendingOutboxEntries()
  const moments = pending
    .map((e) => (e.nextAttemptAt ? new Date(e.nextAttemptAt).getTime() : Date.now()))
    .sort((a, b) => a - b)
  return moments.length > 0 ? new Date(moments[0]!) : null
}

export async function countOutboxEntries(): Promise<number> {
  return getOfflineDb().outbox.count()
}

/**
 * Ruimt een geslaagde mutatie op — maar alleen als hij intussen niet is
 * ingehaald.
 *
 * Tijdens het verzenden kan de gebruiker dezelfde telregel opnieuw wijzigen.
 * Die nieuwe waarde neemt dezelfde plek in de outbox in. Blind verwijderen op
 * id gooit dan de nieuwste wijziging weg terwijl de oude net verstuurd is: de
 * outbox is leeg, de app zegt "alles opgeslagen", en de server heeft de
 * verkeerde waarde.
 */
export async function markOutboxEntrySuccess(id: string, revision = 0): Promise<void> {
  const db = getOfflineDb()
  await db.transaction('rw', db.outbox, async () => {
    const current = await db.outbox.get(id)
    if (!current) return
    if ((current.revision ?? 0) !== revision) return
    await db.outbox.delete(id)
  })
}

export async function markOutboxEntryFailed(
  id: string,
  error: string,
  options: { isPermanent?: boolean; revision?: number } = {}
): Promise<void> {
  const entry = await getOfflineDb().outbox.get(id)
  if (!entry) return

  // Een nieuwere mutatie mag niet de wachttijd van een oudere mislukking
  // erven; die moet gewoon zo snel mogelijk alsnog de deur uit.
  if (options.revision !== undefined && (entry.revision ?? 0) !== options.revision) return

  const attempts = entry.attempts + 1
  await getOfflineDb().outbox.put({
    ...entry,
    attempts,
    error,
    isPermanent: options.isPermanent === true,
    lastAttemptAt: new Date().toISOString(),
    nextAttemptAt: new Date(Date.now() + getRetryDelayMs(attempts)).toISOString(),
  })
}

/**
 * Zet alle mutaties meteen op de rol: wachttijd weg, weigeringen weer open.
 *
 * Gebruikt wanneer de verbinding terugkomt of iemand er zelf om vraagt. Op zo'n
 * moment is wachten op de backoff precies verkeerd — de omstandigheden zijn
 * net veranderd.
 */
export async function resetOutboxSchedule(): Promise<number> {
  const all = await getOfflineDb().outbox.toArray()
  for (const entry of all) {
    await getOfflineDb().outbox.put({
      ...entry,
      isPermanent: undefined,
      attempts: 0,
      nextAttemptAt: undefined,
    })
  }
  return all.length
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
