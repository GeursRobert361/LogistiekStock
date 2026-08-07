import { describe, it, expect, beforeEach, vi } from 'vitest'
import { SyncService } from '../syncService'
import { getOfflineDb, MAX_OUTBOX_ATTEMPTS } from '@/lib/db/offlineDb'
import { SyncStatus } from '@/types'

async function clearOutbox() {
  await getOfflineDb().outbox.clear()
}

beforeEach(async () => {
  await clearOutbox()
})

describe('SyncService', () => {
  it('verwerkt een mutatie en ruimt de outbox op', async () => {
    const sync = new SyncService()
    const handler = vi.fn(async () => undefined)
    sync.registerHandler('countEntry', handler)

    await sync.enqueue('countEntry', 'entry-1', 'update', { value: 1 })
    await sync.flush()

    expect(handler).toHaveBeenCalledWith({ value: 1 }, 'update')
    expect(await getOfflineDb().outbox.count()).toBe(0)
    expect(sync.getSnapshot().status).toBe(SyncStatus.SYNCED)
    expect(sync.getSnapshot().pendingCount).toBe(0)
  })

  it('houdt een mutatie vast wanneer de server een fout geeft', async () => {
    const sync = new SyncService()
    let shouldFail = true
    sync.registerHandler('countEntry', async () => {
      if (shouldFail) throw new Error('503 Service Unavailable')
    })

    await sync.enqueue('countEntry', 'entry-1', 'update', { value: 1 })
    await sync.flush()

    expect(await getOfflineDb().outbox.count()).toBe(1)
    expect(sync.getSnapshot().isServerReachable).toBe(false)
    expect(sync.getSnapshot().lastError).toContain('503')

    shouldFail = false
    await sync.flush()

    expect(await getOfflineDb().outbox.count()).toBe(0)
    expect(sync.getSnapshot().isServerReachable).toBe(true)
    expect(sync.getSnapshot().lastError).toBeNull()
  })

  it('vervangt een openstaande mutatie in plaats van er een tweede bij te zetten', async () => {
    const sync = new SyncService()
    const seen: unknown[] = []
    sync.registerHandler('countEntry', async (payload) => {
      seen.push(payload)
    })

    await sync.enqueue('countEntry', 'entry-1', 'update', { value: 1 })
    await sync.enqueue('countEntry', 'entry-1', 'update', { value: 2 })
    await sync.enqueue('countEntry', 'entry-1', 'update', { value: 3 })

    expect(await getOfflineDb().outbox.count()).toBe(1)

    await sync.flush()
    expect(seen).toEqual([{ value: 3 }])
  })

  it('telt pogingen en markeert de mutatie uiteindelijk als mislukt', async () => {
    const sync = new SyncService()
    sync.registerHandler('countEntry', async () => {
      throw new Error('kapot')
    })

    await sync.enqueue('countEntry', 'entry-1', 'update', {})
    for (let i = 0; i < MAX_OUTBOX_ATTEMPTS; i++) {
      await sync.flush()
    }

    const entry = await getOfflineDb().outbox.get('countEntry:entry-1')
    expect(entry!.attempts).toBe(MAX_OUTBOX_ATTEMPTS)
    expect(sync.getSnapshot().failedCount).toBe(1)
    expect(sync.getSnapshot().status).toBe(SyncStatus.ERROR)
  })

  it('laat een mutatie zonder handler niet stil verdwijnen', async () => {
    const sync = new SyncService()
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    await sync.enqueue('incident', 'incident-1', 'create', {})
    await sync.flush()

    expect(await getOfflineDb().outbox.count()).toBe(1)
    expect(consoleError).toHaveBeenCalled()
    consoleError.mockRestore()
  })

  it('meldt abonnees de actuele stand', async () => {
    const sync = new SyncService()
    sync.registerHandler('countEntry', async () => undefined)
    const seen: number[] = []
    const unsubscribe = sync.subscribe((snapshot) => seen.push(snapshot.pendingCount))

    await sync.enqueue('countEntry', 'entry-1', 'update', {})
    await sync.flush()
    unsubscribe()

    expect(seen).toContain(1)
    expect(seen.at(-1)).toBe(0)
  })
})
