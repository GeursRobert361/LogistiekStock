import { SyncStatus } from '@/types'
import type { OutboxEntry } from '@/types'
import {
  addToOutbox,
  getPendingOutboxEntries,
  getFailedOutboxEntries,
  markOutboxEntrySuccess,
  markOutboxEntryFailed,
} from '@/lib/db/offlineDb'

/**
 * Soorten mutaties die in de outbox kunnen staan. De sleutel bepaalt welke
 * repository-aanroep bij het synchroniseren wordt gedaan.
 */
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
  /** Aantal mutaties dat nog naar de server moet. */
  pendingCount: number
  /** Mutaties die na herhaalde pogingen blijven falen. */
  failedCount: number
  /** Of de server bij de laatste poging bereikbaar bleek. */
  isServerReachable: boolean
  lastSyncedAt: string | null
  lastError: string | null
}

const SYNC_DEBOUNCE_MS = 400
const RETRY_INTERVAL_MS = 15_000

/**
 * Verwerkt lokale mutaties richting de server.
 *
 * Lokale schrijfacties gaan niet via deze service — die gebeuren direct in
 * IndexedDB. Deze service zorgt er alleen voor dat ze uiteindelijk óók op de
 * server terechtkomen, ook na een onderbreking.
 */
export class SyncService {
  private readonly handlers = new Map<OutboxEntityType, OutboxHandler>()
  private readonly listeners = new Set<(snapshot: SyncSnapshot) => void>()

  private snapshot: SyncSnapshot = {
    status: SyncStatus.SYNCED,
    pendingCount: 0,
    failedCount: 0,
    isServerReachable: true,
    lastSyncedAt: null,
    lastError: null,
  }

  private debounceTimer: ReturnType<typeof setTimeout> | null = null
  private retryTimer: ReturnType<typeof setInterval> | null = null
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

  /**
   * Zet een mutatie klaar voor de server. De aanroeper heeft de wijziging al
   * lokaal opgeslagen, dus deze methode faalt nooit richting de gebruiker.
   */
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

  /** Verwerkt de outbox nu meteen. Gooit nooit — fouten belanden in de status. */
  async flush(): Promise<void> {
    if (this.running) return this.running
    this.running = this.processOutbox().finally(() => {
      this.running = null
    })
    return this.running
  }

  private scheduleFlush(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer)
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null
      void this.flush()
    }, SYNC_DEBOUNCE_MS)
  }

  private async processOutbox(): Promise<void> {
    const entries = await getPendingOutboxEntries()
    if (entries.length === 0) {
      await this.refreshCounts()
      return
    }

    this.update({ status: SyncStatus.SYNCING })

    let serverReachable = true
    let lastError: string | null = null

    for (const entry of entries) {
      const handler = this.handlers.get(entry.entityType as OutboxEntityType)
      if (!handler) {
        // Onbekend type: nooit stil laten liggen.
        console.error(`[sync] Geen handler voor "${entry.entityType}" — mutatie overgeslagen.`)
        await markOutboxEntryFailed(entry.id, `Onbekend entiteitstype: ${entry.entityType}`)
        continue
      }

      try {
        await handler(entry.payload, entry.operation)
        await markOutboxEntrySuccess(entry.id)
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error)
        await markOutboxEntryFailed(entry.id, lastError)
        console.warn(`[sync] Mutatie ${entry.id} mislukt: ${lastError}`)
        // De server is kennelijk niet bereikbaar of weigert de schrijfactie.
        // Stop met de rest zodat we niet onnodig doorstampen.
        serverReachable = false
        break
      }
    }

    await this.refreshCounts()

    if (serverReachable) {
      this.update({
        isServerReachable: true,
        lastError: null,
        lastSyncedAt: new Date().toISOString(),
      })
    } else {
      this.update({ isServerReachable: false, lastError })
      this.startRetryTimer()
    }
  }

  private async refreshCounts(): Promise<void> {
    const [pending, failed] = await Promise.all([
      getPendingOutboxEntries(),
      getFailedOutboxEntries(),
    ])
    this.update({
      pendingCount: pending.length,
      failedCount: failed.length,
      status: this.deriveStatus(pending, failed.length),
    })
    if (pending.length === 0 && this.retryTimer) {
      clearInterval(this.retryTimer)
      this.retryTimer = null
    }
  }

  private deriveStatus(pending: OutboxEntry[], failedCount: number): SyncStatus {
    if (failedCount > 0) return SyncStatus.ERROR
    if (pending.length === 0) return SyncStatus.SYNCED
    return this.snapshot.isServerReachable ? SyncStatus.SYNCING : SyncStatus.LOCAL
  }

  private startRetryTimer(): void {
    if (this.retryTimer !== null) return
    if (typeof setInterval === 'undefined') return
    this.retryTimer = setInterval(() => {
      void this.flush()
    }, RETRY_INTERVAL_MS)
  }

  private installBrowserHooks(): void {
    if (this.browserHooksInstalled || typeof window === 'undefined') return
    this.browserHooksInstalled = true

    window.addEventListener('online', () => {
      void this.flush()
    })
    window.addEventListener('offline', () => {
      this.update({ isServerReachable: false })
    })
    // Terugkeren naar de app is een goed moment om achterstand in te halen.
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
