import { describe, it, expect, beforeEach, vi } from 'vitest'
import { FakeCountRepository } from './fakeCountRepository'
import { FakeRestockRepository } from './fakeRestockRepository'

const fakeCountRepo = new FakeCountRepository()
const fakeRestockRepo = new FakeRestockRepository()
const updateEventStatus = vi.fn(async () => undefined)

vi.mock('@/repositories', () => ({
  repositories: {
    count: () => fakeCountRepo,
    restock: () => fakeRestockRepo,
    event: () => ({ updateEventStatus }),
  },
}))

const {
  getSessionOverview,
  finishSessionIfComplete,
  getApprovalBlockers,
  approveSession,
  getNextOpenKioskId,
  pauseSession,
  isResumable,
} = await import('../countSessionService')
const { saveCount, loadOrCreateKioskCount, completeKiosk, skipKiosk, flushPendingCountWrites } =
  await import('../countingService')
const { getOfflineDb, saveCountSessionLocally } = await import('@/lib/db/offlineDb')
const { syncService } = await import('../syncService')
const { registerSyncHandlers } = await import('../syncHandlers')
const { CountSessionStatus, RouteDirection, SyncStatus } = await import('@/types')
const types = await import('@/types')

const EVENT_ID = 'event-1'
const SESSION_ID = 'sessie-1'
const USER_ID = 'teller-1'
const STANDARD = { targetQuantityQuarters: 60, halfPackageThresholdPercentage: 80 }

/** Route van 28 kiosken, zoals een volledige ring. */
const ROUTE = Array.from({ length: 28 }, (_, i) => `kiosk-${101 + i}`)

function makeSession(overrides: Partial<import('@/types').CountSession> = {}) {
  const now = new Date().toISOString()
  return {
    id: SESSION_ID,
    userId: USER_ID,
    eventId: EVENT_ID,
    ringId: 'ring-1',
    startKioskId: ROUTE[0]!,
    direction: RouteDirection.ASCENDING,
    kioskRoute: ROUTE,
    startedAt: now,
    status: CountSessionStatus.IN_PROGRESS,
    syncStatus: SyncStatus.LOCAL,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

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

/** Telt één kiosk volledig af, inclusief telregel. */
async function countKiosk(kioskId: string, restockNeeded = true) {
  const kioskCount = await loadOrCreateKioskCount({
    sessionId: SESSION_ID,
    kioskId,
    counterId: USER_ID,
  })
  await saveCount({
    kioskCountId: kioskCount.id,
    productId: 'prod-water',
    standard: STANDARD,
    countedQuarters: restockNeeded ? 16 : 60, // 4 → 11 bij, of 15 → vol
    userId: USER_ID,
  })
  return completeKiosk(kioskCount)
}

beforeEach(async () => {
  fakeCountRepo.reset()
  fakeRestockRepo.reset()
  updateEventStatus.mockClear()
  await clearDatabase()
  registerSyncHandlers()
})

describe('getSessionOverview', () => {
  it('gebruikt de route als totaal, niet het aantal bestaande kiosktellingen', async () => {
    const session = makeSession()
    await saveCountSessionLocally(session)
    await countKiosk(ROUTE[0]!)

    const overview = await getSessionOverview(session)

    expect(overview.totalCount).toBe(28)
    expect(overview.completedCount).toBe(1)
    expect(overview.notStartedCount).toBe(27)
    expect(overview.isFullyHandled).toBe(false)
  })

  it('geeft iedere routekiosk een status', async () => {
    const session = makeSession()
    await saveCountSessionLocally(session)
    await countKiosk(ROUTE[0]!)
    const second = await loadOrCreateKioskCount({
      sessionId: SESSION_ID,
      kioskId: ROUTE[1]!,
      counterId: USER_ID,
    })
    await skipKiosk(second, 'Kiosk gesloten')

    const overview = await getSessionOverview(session)

    expect(overview.kiosks).toHaveLength(28)
    expect(overview.kiosks[0]!.status).toBe('COMPLETED')
    expect(overview.kiosks[1]!.status).toBe('SKIPPED')
    expect(overview.kiosks[2]!.status).toBe('NOT_STARTED')
  })

  it('wijst de eerstvolgende openstaande kiosk aan', async () => {
    const session = makeSession()
    await saveCountSessionLocally(session)
    await countKiosk(ROUTE[0]!)

    const overview = await getSessionOverview(session)
    expect(getNextOpenKioskId(overview)).toBe(ROUTE[1])
  })
})

describe('finishSessionIfComplete', () => {
  it('rondt niet af zolang er kiosken openstaan', async () => {
    const session = makeSession()
    await saveCountSessionLocally(session)
    await countKiosk(ROUTE[0]!)

    expect(await finishSessionIfComplete(session)).toBe(false)
  })

  it('zet de telronde op SUBMITTED zodra alles is afgehandeld', async () => {
    const shortRoute = ROUTE.slice(0, 2)
    const session = makeSession({ kioskRoute: shortRoute })
    await saveCountSessionLocally(session)

    await countKiosk(shortRoute[0]!)
    const second = await loadOrCreateKioskCount({
      sessionId: SESSION_ID,
      kioskId: shortRoute[1]!,
      counterId: USER_ID,
    })
    await skipKiosk(second, 'Kiosk niet bereikbaar')

    expect(await finishSessionIfComplete(session)).toBe(true)

    const stored = await getOfflineDb().countSessions.get(SESSION_ID)
    expect(stored!.status).toBe(CountSessionStatus.SUBMITTED)
    expect(stored!.completedAt).toBeDefined()
  })
})

describe('pauseSession', () => {
  it('pauzeert en blijft hervatbaar', async () => {
    const session = makeSession()
    await saveCountSessionLocally(session)

    const paused = await pauseSession(session)

    expect(paused.status).toBe(CountSessionStatus.PAUSED)
    expect(isResumable(paused)).toBe(true)
  })
})

describe('goedkeuren', () => {
  const shortRoute = ROUTE.slice(0, 2)

  async function countBothKiosks() {
    const session = makeSession({ kioskRoute: shortRoute })
    await saveCountSessionLocally(session)
    await countKiosk(shortRoute[0]!)
    await countKiosk(shortRoute[1]!)
    await flushPendingCountWrites()
    await syncService.flush()
    return session
  }

  it('blokkeert goedkeuren zolang er kiosken openstaan', async () => {
    const session = makeSession({ kioskRoute: shortRoute })
    await saveCountSessionLocally(session)
    await countKiosk(shortRoute[0]!)
    await syncService.flush()

    const overview = await getSessionOverview(session)
    const blockers = await getApprovalBlockers(overview)

    expect(blockers.map((b) => b.code)).toContain('OPEN_KIOSKS')
    await expect(approveSession(session)).rejects.toThrow()
  })

  it('blokkeert goedkeuren wanneer wijzigingen de server niet bereiken', async () => {
    const session = makeSession({ kioskRoute: shortRoute })
    await saveCountSessionLocally(session)

    // Tellen met een onbereikbare server: alles staat lokaal, niets op de server.
    fakeCountRepo.offline = true
    await countKiosk(shortRoute[0]!)
    await countKiosk(shortRoute[1]!)
    await flushPendingCountWrites()

    const overview = await getSessionOverview(session)
    const blockers = await getApprovalBlockers(overview)

    expect(blockers.map((b) => b.code)).toContain('UNSYNCED_CHANGES')
    await expect(approveSession(session)).rejects.toThrow()
  })

  it('keurt wel goed zodra de wijzigingen alsnog zijn weggeschreven', async () => {
    const session = makeSession({ kioskRoute: shortRoute })
    await saveCountSessionLocally(session)

    fakeCountRepo.offline = true
    await countKiosk(shortRoute[0]!)
    await countKiosk(shortRoute[1]!)
    await flushPendingCountWrites()

    // Verbinding terug: goedkeuren synchroniseert eerst en gaat dan door.
    fakeCountRepo.offline = false
    const result = await approveSession(session)

    expect(result.requirementCount).toBe(2)
  })

  it('genereert bijvulbehoeften bij goedkeuren', async () => {
    const session = await countBothKiosks()

    const result = await approveSession(session)

    expect(result.requirementCount).toBe(2)
    expect(result.totalPackages).toBe(22) // 2 × 11
    expect(fakeRestockRepo.requirements).toHaveLength(2)
    expect(updateEventStatus).toHaveBeenCalledWith(EVENT_ID, types.EventStatus.READY_FOR_RESTOCK)
  })

  it('genereert bij twee keer goedkeuren geen dubbele behoeften', async () => {
    const session = await countBothKiosks()

    await approveSession(session)
    const stored = await getOfflineDb().countSessions.get(SESSION_ID)
    await syncService.flush()
    await approveSession(stored!)

    expect(fakeRestockRepo.requirements).toHaveLength(2)
  })

  it('maakt geen behoefte voor een kiosk zonder tekort', async () => {
    const session = makeSession({ kioskRoute: shortRoute })
    await saveCountSessionLocally(session)
    await countKiosk(shortRoute[0]!, true)
    await countKiosk(shortRoute[1]!, false) // volledig gevuld
    await flushPendingCountWrites()
    await syncService.flush()

    const result = await approveSession(session)

    expect(result.requirementCount).toBe(1)
  })

  it('zet de telronde op APPROVED', async () => {
    const session = await countBothKiosks()
    await approveSession(session)

    const stored = await getOfflineDb().countSessions.get(SESSION_ID)
    expect(stored!.status).toBe(CountSessionStatus.APPROVED)
  })
})
