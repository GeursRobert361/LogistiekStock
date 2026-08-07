import { repositories } from '@/repositories'
import { syncService } from './syncService'
import type {
  CountSession,
  KioskCount,
  CountEntry,
  RestockRequirement,
  RestockRound,
  RestockRoundItem,
  RestockRoundStop,
  RestockDelivery,
  Incident,
} from '@/types'

let registered = false

/**
 * Koppelt de outbox aan de repositories.
 *
 * Alle serverwrites zijn idempotent (upsert op de natuurlijke sleutel), zodat
 * een mutatie die na een timeout tóch was aangekomen bij een nieuwe poging
 * geen duplicaat oplevert.
 */
export function registerSyncHandlers(): void {
  if (registered) return
  registered = true

  syncService.registerHandler('countSession', async (payload) => {
    const session = payload as CountSession
    await repositories.count().createSession(session)
  })

  syncService.registerHandler('kioskCount', async (payload) => {
    await repositories.count().upsertKioskCount(payload as KioskCount)
  })

  syncService.registerHandler('countEntry', async (payload, operation) => {
    const entry = payload as CountEntry
    if (operation === 'delete') {
      await repositories.count().deleteCountEntry(entry.kioskCountId, entry.productId)
      return
    }
    await repositories.count().upsertCountEntry(entry)
  })

  syncService.registerHandler('restockRequirement', async (payload) => {
    await repositories.restock().upsertRequirement(payload as RestockRequirement)
  })

  syncService.registerHandler('restockRound', async (payload) => {
    await repositories.restock().createRound(payload as RestockRound)
  })

  syncService.registerHandler('restockRoundItem', async (payload) => {
    await repositories.restock().upsertRoundItem(payload as RestockRoundItem)
  })

  syncService.registerHandler('restockStop', async (payload) => {
    const stop = payload as RestockRoundStop
    await repositories.restock().updateStop(stop.id, stop)
  })

  syncService.registerHandler('restockDelivery', async (payload) => {
    await repositories.restock().createDelivery(payload as RestockDelivery)
  })

  syncService.registerHandler('incident', async (payload) => {
    await repositories.incident().createIncident(payload as Incident)
  })
}
