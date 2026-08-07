import { describe, it, expect, beforeEach, vi } from 'vitest'
import { FakeCountRepository } from './fakeCountRepository'

const fakeCountRepo = new FakeCountRepository()

vi.mock('@/repositories', () => ({
  repositories: {
    count: () => fakeCountRepo,
    restock: () => {
      throw new Error('niet gebruikt in deze test')
    },
    event: () => {
      throw new Error('niet gebruikt in deze test')
    },
  },
}))

const {
  saveCount,
  clearCount,
  loadEntries,
  loadOrCreateKioskCount,
  completeKiosk,
  skipKiosk,
  getCompleteness,
  flushPendingCountWrites,
} = await import('../countingService')
const { getOfflineDb, getLocalEntries } = await import('@/lib/db/offlineDb')
const { syncService } = await import('../syncService')
const { registerSyncHandlers } = await import('../syncHandlers')
const { KioskCountStatus } = await import('@/types')

const KIOSK_COUNT_ID = 'kc-1'
const USER_ID = 'user-teller1'
const STANDARD = { targetQuantityQuarters: 60, halfPackageThresholdPercentage: 80 } // norm 15

async function clearDatabase() {
  const db = getOfflineDb()
  await Promise.all([
    db.countSessions.clear(),
    db.kioskCounts.clear(),
    db.countEntries.clear(),
    db.outbox.clear(),
    db.conflicts.clear(),
  ])
}

function save(productId: string, quarters: number) {
  return saveCount({
    kioskCountId: KIOSK_COUNT_ID,
    productId,
    standard: STANDARD,
    countedQuarters: quarters,
    userId: USER_ID,
  })
}

beforeEach(async () => {
  fakeCountRepo.reset()
  await clearDatabase()
  registerSyncHandlers()
})

describe('getCompleteness', () => {
  it('beschouwt een niet-aangeraakt product als niet geteld', () => {
    const result = getCompleteness(['p1', 'p2'], new Map([['p1', 20]]))

    expect(result.isComplete).toBe(false)
    expect(result.missingProductIds).toEqual(['p2'])
  })

  it('beschouwt een expliciete 0 als ingevuld', () => {
    const result = getCompleteness(['p1', 'p2'], new Map([['p1', 20], ['p2', 0]]))

    expect(result.isComplete).toBe(true)
    expect(result.missingProductIds).toEqual([])
    expect(result.countedProductIds).toEqual(['p1', 'p2'])
  })

  it('maakt onderscheid tussen ontbrekend en nul', () => {
    const missing = getCompleteness(['p1'], new Map())
    const zero = getCompleteness(['p1'], new Map([['p1', 0]]))

    expect(missing.isComplete).toBe(false)
    expect(zero.isComplete).toBe(true)
  })
})

describe('saveCount', () => {
  it('slaat een expliciete 0 op met het volledige bijvuladvies', async () => {
    await save('prod-water', 0)

    const entries = await getLocalEntries(KIOSK_COUNT_ID)
    expect(entries).toHaveLength(1)
    expect(entries[0]!.countedQuantityQuarters).toBe(0)
    expect(entries[0]!.restockQuantityPackages).toBe(15)
  })

  it('rekent 4,5 bij norm 15 door naar 11 bijvullen', async () => {
    await save('prod-water', 18) // 4,5 verpakking

    const entries = await getLocalEntries(KIOSK_COUNT_ID)
    expect(entries[0]!.effectiveQuantityQuarters).toBe(16) // effectief 4
    expect(entries[0]!.restockQuantityPackages).toBe(11)
  })

  it('houdt lokaal precies één telregel over na meerdere bewerkingen', async () => {
    await save('prod-water', 16) // 4
    await save('prod-water', 18) // 4,5
    await save('prod-water', 20) // 5

    const entries = await getLocalEntries(KIOSK_COUNT_ID)
    expect(entries).toHaveLength(1)
    expect(entries[0]!.countedQuantityQuarters).toBe(20)
  })

  it('houdt ook op de server precies één telregel over', async () => {
    await save('prod-water', 16)
    await save('prod-water', 18)
    await save('prod-water', 20)
    await syncService.flush()

    expect(fakeCountRepo.entries).toHaveLength(1)
    expect(fakeCountRepo.entries[0]!.countedQuantityQuarters).toBe(20)
  })

  it('bewaart de laatste wijziging wanneer direct wordt afgerond', async () => {
    const kioskCount = {
      id: KIOSK_COUNT_ID,
      countSessionId: 'sessie-1',
      kioskId: 'kiosk-123',
      counterId: USER_ID,
      status: KioskCountStatus.IN_PROGRESS,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    // Bewust niet awaiten: dit bootst na dat iemand invoert en meteen doorloopt.
    void save('prod-water', 18)
    const completed = await completeKiosk(kioskCount)

    const entries = await getLocalEntries(KIOSK_COUNT_ID)
    expect(entries).toHaveLength(1)
    expect(entries[0]!.countedQuantityQuarters).toBe(18)
    expect(completed.status).toBe(KioskCountStatus.COMPLETED)
    expect(completed.completedAt).toBeDefined()
  })

  it('werkt zonder verbinding en synchroniseert daarna alsnog', async () => {
    fakeCountRepo.offline = true
    await save('prod-water', 12)
    await syncService.flush()

    expect(fakeCountRepo.entries).toHaveLength(0)
    expect(await getLocalEntries(KIOSK_COUNT_ID)).toHaveLength(1)

    fakeCountRepo.offline = false
    await syncService.flush()

    expect(fakeCountRepo.entries).toHaveLength(1)
    expect(fakeCountRepo.entries[0]!.countedQuantityQuarters).toBe(12)
  })
})

describe('clearCount', () => {
  it('zet een product terug op "nog niet geteld"', async () => {
    await save('prod-water', 0)
    expect(await getLocalEntries(KIOSK_COUNT_ID)).toHaveLength(1)

    await clearCount(KIOSK_COUNT_ID, 'prod-water', USER_ID)

    expect(await getLocalEntries(KIOSK_COUNT_ID)).toHaveLength(0)
    const counts = await loadEntries(KIOSK_COUNT_ID)
    expect(counts.get('prod-water')).toBeUndefined()
  })
})

describe('loadEntries', () => {
  it('behoudt de telling bij een refresh zonder verbinding', async () => {
    await save('prod-water', 18)
    await save('prod-chips', 0)
    await flushPendingCountWrites()

    // Refresh terwijl de telefoon offline is: de server is onbereikbaar.
    fakeCountRepo.offline = true
    const counts = await loadEntries(KIOSK_COUNT_ID)

    expect(counts.size).toBe(2)
    expect(counts.get('prod-water')!.countedQuantityQuarters).toBe(18)
    expect(counts.get('prod-chips')!.countedQuantityQuarters).toBe(0)
  })

  it('voegt serverregels toe die lokaal ontbreken', async () => {
    await fakeCountRepo.upsertCountEntry({
      id: 'server-entry',
      kioskCountId: KIOSK_COUNT_ID,
      productId: 'prod-servetten',
      targetQuantityQuarters: 16,
      countedQuantityQuarters: 8,
      effectiveQuantityQuarters: 8,
      restockQuantityPackages: 2,
      appliedFractionRule: 'NONE' as never,
      lastModifiedById: USER_ID,
    })

    const counts = await loadEntries(KIOSK_COUNT_ID)

    expect(counts.get('prod-servetten')!.countedQuantityQuarters).toBe(8)
    expect(await getLocalEntries(KIOSK_COUNT_ID)).toHaveLength(1)
  })

  it('houdt de lokale waarde aan wanneer die nog niet gesynchroniseerd is', async () => {
    fakeCountRepo.offline = true
    await save('prod-water', 20) // lokaal geteld, staat nog in de outbox
    fakeCountRepo.offline = false

    // Iemand anders heeft intussen een andere waarde op de server gezet.
    await new Promise((resolve) => setTimeout(resolve, 5))
    await fakeCountRepo.upsertCountEntry({
      id: 'server-entry',
      kioskCountId: KIOSK_COUNT_ID,
      productId: 'prod-water',
      targetQuantityQuarters: 60,
      countedQuantityQuarters: 4,
      effectiveQuantityQuarters: 4,
      restockQuantityPackages: 14,
      appliedFractionRule: 'NONE' as never,
      lastModifiedById: 'user-teller2',
    })

    const counts = await loadEntries(KIOSK_COUNT_ID)

    expect(counts.get('prod-water')!.countedQuantityQuarters).toBe(20)
    const conflicts = await getOfflineDb().conflicts.toArray()
    expect(conflicts).toHaveLength(1)
  })
})

describe('loadOrCreateKioskCount', () => {
  it('geeft bij herhaald openen dezelfde kiosktelling terug', async () => {
    const first = await loadOrCreateKioskCount({
      sessionId: 'sessie-1',
      kioskId: 'kiosk-123',
      counterId: USER_ID,
    })
    const second = await loadOrCreateKioskCount({
      sessionId: 'sessie-1',
      kioskId: 'kiosk-123',
      counterId: USER_ID,
    })

    expect(second.id).toBe(first.id)
    expect(await getOfflineDb().kioskCounts.count()).toBe(1)
  })
})

describe('skipKiosk', () => {
  it('slaat een kiosk over met reden', async () => {
    const kioskCount = await loadOrCreateKioskCount({
      sessionId: 'sessie-1',
      kioskId: 'kiosk-124',
      counterId: USER_ID,
    })

    const skipped = await skipKiosk(kioskCount, 'Kiosk gesloten')

    expect(skipped.status).toBe(KioskCountStatus.SKIPPED)
    expect(skipped.skipReason).toBe('Kiosk gesloten')
  })

  it('weigert overslaan zonder reden', async () => {
    const kioskCount = await loadOrCreateKioskCount({
      sessionId: 'sessie-1',
      kioskId: 'kiosk-125',
      counterId: USER_ID,
    })

    await expect(skipKiosk(kioskCount, '   ')).rejects.toThrow('reden')
  })
})
