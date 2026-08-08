import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { SyncService } from '../syncService'
import { getOfflineDb, getRetryDelayMs, getDueOutboxEntries } from '@/lib/db/offlineDb'
import { SyncStatus } from '@/types'

/** Fout zoals de API-client hem gooit, met een statuscode. */
class HttpError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message)
  }
}

async function clearOutbox() {
  await getOfflineDb().outbox.clear()
}

/** Zet de wachttijd van alle mutaties op nu, zodat ze meteen aan de beurt zijn. */
async function makeEverythingDue() {
  const db = getOfflineDb()
  for (const entry of await db.outbox.toArray()) {
    await db.outbox.put({ ...entry, nextAttemptAt: undefined })
  }
}

/**
 * Alle services van deze test, zodat ze na afloop hun timers opruimen.
 *
 * Elke `enqueue` plant 400 ms later een flush in. Vuurt die pas tijdens een
 * volgende test, dan verwerkt hij met de handlers van de vórige test de outbox
 * die op dat moment van iemand anders is — en dan meet de test iets anders dan
 * hij denkt.
 */
const services: SyncService[] = []

function newSyncService(): SyncService {
  const service = new SyncService()
  services.push(service)
  return service
}

beforeEach(async () => {
  await clearOutbox()
})

afterEach(() => {
  for (const service of services.splice(0)) service.dispose()
})

describe('SyncService', () => {
  it('verwerkt een mutatie en ruimt de outbox op', async () => {
    const sync = newSyncService()
    const handler = vi.fn(async () => undefined)
    sync.registerHandler('countEntry', handler)

    await sync.enqueue('countEntry', 'entry-1', 'update', { value: 1 })
    await sync.flush()

    expect(handler).toHaveBeenCalledWith({ value: 1 }, 'update')
    expect(await getOfflineDb().outbox.count()).toBe(0)
    expect(sync.getSnapshot().status).toBe(SyncStatus.SYNCED)
    expect(sync.getSnapshot().pendingCount).toBe(0)
  })

  it('vervangt een openstaande mutatie in plaats van er een tweede bij te zetten', async () => {
    const sync = newSyncService()
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
})

describe('blijven proberen bij een onbereikbare server', () => {
  it('geeft nooit op, hoe vaak het ook mislukt', async () => {
    const sync = newSyncService()
    let shouldFail = true
    sync.registerHandler('countEntry', async () => {
      if (shouldFail) throw new Error('Netwerkfout: server niet bereikbaar')
    })

    await sync.enqueue('countEntry', 'entry-1', 'update', { value: 1 })

    // Twintig mislukte pogingen: veel meer dan de acht waar hij vroeger
    // definitief mee stopte.
    for (let i = 0; i < 20; i++) {
      await makeEverythingDue()
      await sync.flush()
    }

    expect(sync.getSnapshot().pendingCount).toBe(1)
    expect(sync.getSnapshot().rejectedCount).toBe(0)
    expect(sync.getSnapshot().isServerReachable).toBe(false)

    // En zodra de server terug is, komt hij alsnog aan.
    shouldFail = false
    await makeEverythingDue()
    await sync.flush()

    expect(await getOfflineDb().outbox.count()).toBe(0)
    expect(sync.getSnapshot().status).toBe(SyncStatus.SYNCED)
  })

  it('wacht steeds langer tussen pogingen', async () => {
    expect(getRetryDelayMs(1)).toBeLessThan(getRetryDelayMs(3))
    expect(getRetryDelayMs(3)).toBeLessThan(getRetryDelayMs(5))
    // En loopt niet oneindig op.
    expect(getRetryDelayMs(50)).toBe(getRetryDelayMs(6))
  })

  it('probeert niet opnieuw voordat de wachttijd om is', async () => {
    const sync = newSyncService()
    let calls = 0
    sync.registerHandler('countEntry', async () => {
      calls++
      throw new Error('Netwerkfout')
    })

    await sync.enqueue('countEntry', 'entry-1', 'update', {})
    await sync.flush()
    expect(calls).toBe(1)

    // Meteen nog eens: de mutatie is nog niet aan de beurt.
    await sync.flush()
    expect(calls).toBe(1)
    expect(await getDueOutboxEntries()).toHaveLength(0)
  })

  it('meldt de wijzigingen als bewaard, niet als verloren', async () => {
    const sync = newSyncService()
    sync.registerHandler('countEntry', async () => {
      throw new Error('Netwerkfout')
    })

    await sync.enqueue('countEntry', 'entry-1', 'update', {})
    await sync.flush()

    const snapshot = sync.getSnapshot()
    // Openstaand, maar niet geweigerd: er is niets aan de hand behalve wachten.
    expect(snapshot.pendingCount).toBe(1)
    expect(snapshot.rejectedCount).toBe(0)
    expect(snapshot.status).not.toBe(SyncStatus.ERROR)
    expect(snapshot.nextRetryAt).not.toBeNull()
  })
})

describe('weigering door de server', () => {
  it('stopt met proberen bij een fout die zichzelf niet oplost', async () => {
    const sync = newSyncService()
    let calls = 0
    sync.registerHandler('countEntry', async () => {
      calls++
      throw new HttpError('Geen toegang tot deze actie.', 403)
    })

    await sync.enqueue('countEntry', 'entry-1', 'update', {})
    await sync.flush()
    await makeEverythingDue()
    await sync.flush()

    expect(calls).toBe(1)
    expect(sync.getSnapshot().rejectedCount).toBe(1)
    expect(sync.getSnapshot().status).toBe(SyncStatus.ERROR)
  })

  it('blijft wel proberen bij een verlopen sessie', async () => {
    const sync = newSyncService()
    let calls = 0
    sync.registerHandler('countEntry', async () => {
      calls++
      throw new HttpError('Niet ingelogd.', 401)
    })

    await sync.enqueue('countEntry', 'entry-1', 'update', {})
    await sync.flush()
    await makeEverythingDue()
    await sync.flush()

    // Na opnieuw inloggen kan dezelfde mutatie alsnog slagen.
    expect(calls).toBe(2)
    expect(sync.getSnapshot().rejectedCount).toBe(0)
  })

  it('blijft proberen bij een serverfout', async () => {
    const sync = newSyncService()
    let calls = 0
    sync.registerHandler('countEntry', async () => {
      calls++
      throw new HttpError('Bad gateway', 502)
    })

    await sync.enqueue('countEntry', 'entry-1', 'update', {})
    await sync.flush()
    await makeEverythingDue()
    await sync.flush()

    expect(calls).toBe(2)
    expect(sync.getSnapshot().rejectedCount).toBe(0)
  })

  it('zet een geweigerde mutatie terug in de wachtrij met retryNow', async () => {
    const sync = newSyncService()
    let shouldReject = true
    sync.registerHandler('countEntry', async () => {
      if (shouldReject) throw new HttpError('Geen toegang.', 403)
    })

    await sync.enqueue('countEntry', 'entry-1', 'update', {})
    await sync.flush()
    expect(sync.getSnapshot().rejectedCount).toBe(1)

    shouldReject = false
    await sync.retryNow()

    expect(await getOfflineDb().outbox.count()).toBe(0)
    expect(sync.getSnapshot().rejectedCount).toBe(0)
  })

  it('geeft een nieuwe waarde een schone kans na een weigering', async () => {
    const sync = newSyncService()
    let shouldReject = true
    sync.registerHandler('countEntry', async () => {
      if (shouldReject) throw new HttpError('Ongeldig verzoek.', 400)
    })

    await sync.enqueue('countEntry', 'entry-1', 'update', { value: 1 })
    await sync.flush()
    expect(sync.getSnapshot().rejectedCount).toBe(1)

    // De teller past de waarde aan; die mag niet blijven hangen op de
    // weigering van de vorige inhoud.
    shouldReject = false
    await sync.enqueue('countEntry', 'entry-1', 'update', { value: 2 })
    await sync.flush()

    expect(await getOfflineDb().outbox.count()).toBe(0)
  })

  it('laat een mutatie zonder handler niet stil verdwijnen', async () => {
    const sync = newSyncService()
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    await sync.enqueue('incident', 'incident-1', 'create', {})
    await sync.flush()

    expect(await getOfflineDb().outbox.count()).toBe(1)
    expect(consoleError).toHaveBeenCalled()
    consoleError.mockRestore()
  })

  it('meldt abonnees de actuele stand', async () => {
    const sync = newSyncService()
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
