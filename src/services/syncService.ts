import { SyncStatus } from '@/types'
import {
  addToOutbox,
  getDueOutboxEntries,
  getPendingOutboxEntries,
  getRejectedOutboxEntries,
  getNextRetryAt,
  markOutboxEntrySuccess,
  markOutboxEntryFailed,
  resetOutboxSchedule,
  countUnresolvedConflicts,
} from '@/lib/db/offlineDb'

export type OutboxEntityType =
  | 'countSession'
  | 'kioskCount'
  | 'countEntry'
  | 'restockRequirement'
  | 'restockRound'
  | 'restockRoundItem'
  | 'restockDelivery'
  | 'restockStop'
  | 'incident'

export type OutboxOperation = 'create' | 'update' | 'delete'

export type OutboxHandler = (payload: unknown, operation: OutboxOperation) => Promise<void>

export interface SyncSnapshot {
  status: SyncStatus
  /** Wijzigingen die nog naar de server moeten. */
  pendingCount: number
  /** Wijzigingen die de server heeft geweigerd; die vragen om aandacht. */
  rejectedCount: number
  /** Onopgeloste conflicten tussen de lokale en de servertelling. */
  conflictCount: number
  /** Of de server bij de laatste poging bereikbaar bleek. */
  isServerReachable: boolean
  /** Wanneer de eerstvolgende poging gepland staat. */
  nextRetryAt: string | null
  lastSyncedAt: string | null
  lastError: string | null
}

const SYNC_DEBOUNCE_MS = 400
/** Hoe vaak we kijken óf er iets aan de beurt is; de wachttijd zit per mutatie. */
const TICK_INTERVAL_MS = 3_000

/**
 * Verwerkt lokale mutaties richting de server.
 *
 * Twee regels waar alles op rust:
 *
 *   1. De app geeft nooit uit zichzelf op. Tijdens het tellen is er geen
 *      moment om een knop te zoeken, dus blijft hij proberen tot het lukt —
 *      met een oplopende wachttijd, zodat een lange storing niet elke seconde
 *      het netwerk en de accu belast.
 *   2. Alleen een weigering van de server stopt het proberen. Geen rechten of
 *      een ongeldig verzoek lost zichzelf niet op; dat hoort gemeld te worden
 *      in plaats van eindeloos herhaald.
 *
 * Lokale schrijfacties gaan hier niet doorheen: die staan al in IndexedDB.
 * Er kan dus niets verloren gaan zolang deze service nog bezig is.
 */
export class SyncService {
  private readonly handlers = new Map<OutboxEntityType, OutboxHandler>()
  private readonly listeners = new Set<(snapshot: SyncSnapshot) => void>()

  private snapshot: SyncSnapshot = {
    status: SyncStatus.SYNCED,
    pendingCount: 0,
    rejectedCount: 0,
    conflictCount: 0,
    isServerReachable: true,
    nextRetryAt: null,
    lastSyncedAt: null,
    lastError: null,
  }

  private debounceTimer: ReturnType<typeof setTimeout> | null = null
  private tickTimer: ReturnType<typeof setInterval> | null = null
  private running: Promise<void> | null = null
  private browserHooksInstalled = false

  registerHandler(entityType: OutboxEntityType, handler: OutboxHandler): void {
    this.handlers.set(entityType, handler)
  }

  getSnapshot(): SyncSnapshot {
    return this.snapshot
  }

  subscribe(listener: (snapshot: SyncSnapshot) => void): () => void {
    this.installBrowserHooks()
    this.listeners.add(listener)
    listener(this.snapshot)
    void this.refreshCounts()
    return () => {
      this.listeners.delete(listener)
    }
  }

  async enqueue(
    entityType: OutboxEntityType,
    entityId: string,
    operation: OutboxOperation,
    payload: unknown
  ): Promise<void> {
    this.installBrowserHooks()
    await addToOutbox({
      // Eén openstaande mutatie per entiteit: een nieuwere waarde vervangt de
      // vorige in plaats van er een tweede regel bij te zetten.
      id: `${entityType}:${entityId}`,
      entityType,
      entityId,
      operation,
      payload,
    })
    await this.refreshCounts()
    this.scheduleFlush()
  }

  /** Verwerkt wat aan de beurt is. Gooit nooit — fouten belanden in de status. */
  async flush(): Promise<void> {
    if (this.running) return this.running
    this.running = this.processOutbox().finally(() => {
      this.running = null
    })
    return this.running
  }

  /**
   * Alles nu proberen, ook wat nog moest wachten of geweigerd was.
   * Aangeroepen wanneer de verbinding terugkomt of iemand er zelf om vraagt.
   */
  async retryNow(): Promise<void> {
    await resetOutboxSchedule()
    await this.flush()
  }

  private scheduleFlush(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer)
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null
      void this.flush()
    }, SYNC_DEBOUNCE_MS)
  }

  /**
   * Bepaalt of opnieuw proberen zin heeft.
   *
   * Een 4xx betekent dat de server de mutatie inhoudelijk afwijst — die wordt
   * bij een volgende poging weer afgewezen. Alles daarbuiten (geen netwerk,
   * time-out, 5xx) is tijdelijk en verdient wél een nieuwe poging. Bij twijfel
   * blijven we proberen: een mutatie kwijtraken is erger dan een poging te
   * veel.
   */
  private isPermanentFailure(error: unknown): boolean {
    const status = (error as { status?: unknown })?.status
    if (typeof status !== 'number') return false

    // 401 niet: na opnieuw inloggen kan dezelfde mutatie alsnog slagen.
    // 408 en 429 zijn expliciet "probeer later opnieuw".
    if (status === 401 || status === 408 || status === 429) return false
    return status >= 400 && status < 500
  }

  private async processOutbox(): Promise<void> {
    const due = await getDueOutboxEntries()
    if (due.length === 0) {
      await this.refreshCounts()
      return
    }

    let serverReachable = true
    let lastError: string | null = null

    for (const entry of due) {
      const handler = this.handlers.get(entry.entityType as OutboxEntityType)
      if (!handler) {
        console.error(`[sync] Geen handler voor "${entry.entityType}" — mutatie blijft staan.`)
        await markOutboxEntryFailed(entry.id, `Onbekend type: ${entry.entityType}`, {
          isPermanent: true,
        })
        continue
      }

      try {
        await handler(entry.payload, entry.operation)
        await markOutboxEntrySuccess(entry.id)
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error)
        const isPermanent = this.isPermanentFailure(error)
        await markOutboxEntryFailed(entry.id, lastError, { isPermanent })

        if (isPermanent) {
          console.error(`[sync] Mutatie ${entry.id} geweigerd: ${lastError}`)
          continue
        }

        // Server onbereikbaar: de rest heeft nu ook geen zin.
        console.warn(`[sync] Mutatie ${entry.id} mislukt, wordt opnieuw geprobeerd: ${lastError}`)
        serverReachable = false
        break
      }
    }

    await this.refreshCounts()

    this.update(
      serverReachable
        ? { isServerReachable: true, lastError: null, lastSyncedAt: new Date().toISOString() }
        : { isServerReachable: false, lastError }
    )
  }

  private async refreshCounts(): Promise<void> {
    const [pending, rejected, conflicts, nextRetryAt] = await Promise.all([
      getPendingOutboxEntries(),
      getRejectedOutboxEntries(),
      countUnresolvedConflicts(),
      getNextRetryAt(),
    ])

    this.update({
      pendingCount: pending.length,
      rejectedCount: rejected.length,
      conflictCount: conflicts,
      nextRetryAt: nextRetryAt?.toISOString() ?? null,
      status: this.deriveStatus(pending.length, rejected.length),
    })

    // Zolang er iets openstaat blijft de klok lopen. Alleen als alles weg is
    // stopt hij — anders zou een mutatie kunnen blijven hangen.
    if (pending.length > 0) {
      this.startTicking()
    } else {
      this.stopTicking()
    }
  }

  private deriveStatus(pendingCount: number, rejectedCount: number): SyncStatus {
    if (rejectedCount > 0) return SyncStatus.ERROR
    if (pendingCount === 0) return SyncStatus.SYNCED
    return this.snapshot.isServerReachable ? SyncStatus.SYNCING : SyncStatus.LOCAL
  }

  private startTicking(): void {
    if (this.tickTimer !== null) return
    if (typeof setInterval === 'undefined') return
    this.tickTimer = setInterval(() => {
      void this.flush()
    }, TICK_INTERVAL_MS)
  }

  private stopTicking(): void {
    if (this.tickTimer === null) return
    clearInterval(this.tickTimer)
    this.tickTimer = null
  }

  private installBrowserHooks(): void {
    if (this.browserHooksInstalled || typeof window === 'undefined') return
    this.browserHooksInstalled = true

    // Verbinding terug: meteen proberen, niet wachten op de klok.
    window.addEventListener('online', () => {
      void this.retryNow()
    })
    window.addEventListener('offline', () => {
      this.update({ isServerReachable: false })
    })
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void this.flush()
    })
  }

  private update(patch: Partial<SyncSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch }
    for (const listener of this.listeners) listener(this.snapshot)
  }
}

export const syncService = new SyncService()
