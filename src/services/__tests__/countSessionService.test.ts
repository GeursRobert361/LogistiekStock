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
  prepareSessionForApproval,
  approveSession,
  reopenApprovedKiosk,
  RequirementInUseError,
  getNextOpenKioskId,
  pauseSession,
  isResumable,
} = await import('../countSessionService')
const {
  saveCount,
  loadOrCreateKioskCount,
  loadKioskCounts,
  completeKiosk,
  skipKiosk,
  flushPendingCountWrites,
} = await import('../countingService')
const { getOfflineDb, saveCountSessionLocally } = await import('@/lib/db/offlineDb')
const { syncService } = await import('../syncService')
const { registerSyncHandlers } = await import('../syncHandlers')
const { kioskCountId, countEntryId } = await import('@/lib/ids')
const { CountSessionStatus, KioskCountStatus, FractionRule, RouteDirection, SyncStatus } =
  await import('@/types')
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

/**
 * Een telling die rechtstreeks op de server verschijnt: een tweede teller heeft
 * die kiosk op zijn eigen toestel afgerond. Lokaal is er niets van bekend.
 */
async function arriveFromOtherDevice(kioskId: string) {
  const id = kioskCountId(SESSION_ID, kioskId)
  const now = new Date().toISOString()
  await fakeCountRepo.upsertKioskCount({
    id,
    countSessionId: SESSION_ID,
    kioskId,
    counterId: 'teller-2',
    status: KioskCountStatus.COMPLETED,
    startedAt: now,
    completedAt: now,
  })
  await fakeCountRepo.upsertCountEntry({
    id: countEntryId(id, 'prod-water'),
    kioskCountId: id,
    productId: 'prod-water',
    targetQuantityQuarters: 60,
    countedQuantityQuarters: 16,
    effectiveQuantityQuarters: 16,
    restockQuantityPackages: 11,
    appliedFractionRule: FractionRule.NONE,
    lastModifiedById: 'teller-2',
  })
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

  it('blokkeert niet op een kiosk die nog in de outbox stond', async () => {
    // De reviewpagina haalt zijn overzicht op terwijl de laatste kiosk nog
    // onderweg is naar de server. Zou de controle op dat verouderde overzicht
    // afgaan, dan meldt de app "1 kiosk staat nog open" terwijl die kiosk
    // allang geteld is — en kun je niet goedkeuren tot je ververst.
    const session = makeSession({ kioskRoute: shortRoute })
    await saveCountSessionLocally(session)

    await countKiosk(shortRoute[0]!)
    await syncService.flush()
    const staleOverview = await getSessionOverview(session)
    expect(staleOverview.notStartedCount + staleOverview.inProgressCount).toBe(1)

    // Tweede kiosk erbij, nog niet gesynchroniseerd.
    await countKiosk(shortRoute[1]!)

    const blockers = await getApprovalBlockers(staleOverview)
    expect(blockers).toEqual([])
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

  it('neemt een kiosk mee die pas tijdens het synchroniseren binnenkomt', async () => {
    // De race die een kiosk uit de bijvullijst liet vallen: de planner kijkt
    // naar een overzicht van vóór het synchroniseren, de controle draait op een
    // nieuwer overzicht, en de generatie greep daarna terug op het oude.
    const session = makeSession({ kioskRoute: shortRoute })
    await saveCountSessionLocally(session)
    await countKiosk(shortRoute[0]!)
    await flushPendingCountWrites()
    await syncService.flush()

    const staleOverview = await getSessionOverview(session)
    expect(staleOverview.notStartedCount).toBe(1)

    // De laatste kiosk landt op de server precies tijdens het wegschrijven
    // vlak vóór het goedkeuren.
    const originalFlush = syncService.flush.bind(syncService)
    const flushSpy = vi.spyOn(syncService, 'flush').mockImplementation(async () => {
      await originalFlush()
      await arriveFromOtherDevice(shortRoute[1]!)
    })

    try {
      const result = await approveSession(staleOverview.session)
      expect(result.requirementCount).toBe(2)
      expect(fakeRestockRepo.requirements.map((r) => r.kioskId).sort()).toEqual(
        [...shortRoute].sort()
      )
    } finally {
      flushSpy.mockRestore()
    }
  })

  it('bouwt het overzicht voor goedkeuren opnieuw op ná het synchroniseren', async () => {
    const session = makeSession({ kioskRoute: shortRoute })
    await saveCountSessionLocally(session)
    await countKiosk(shortRoute[0]!)
    await flushPendingCountWrites()
    await syncService.flush()

    const originalFlush = syncService.flush.bind(syncService)
    const flushSpy = vi.spyOn(syncService, 'flush').mockImplementation(async () => {
      await originalFlush()
      await arriveFromOtherDevice(shortRoute[1]!)
    })

    try {
      const prepared = await prepareSessionForApproval(session)
      expect(prepared.overview.completedCount).toBe(2)
      expect(prepared.blockers).toEqual([])
    } finally {
      flushSpy.mockRestore()
    }
  })
})

describe('heropenen van een goedgekeurde kiosk', () => {
  const shortRoute = ROUTE.slice(0, 2)

  /** Twee kiosken geteld en goedgekeurd; geeft de opgeslagen telronde terug. */
  async function approvedSession() {
    const session = makeSession({ kioskRoute: shortRoute })
    await saveCountSessionLocally(session)
    await countKiosk(shortRoute[0]!)
    await countKiosk(shortRoute[1]!)
    await flushPendingCountWrites()
    await syncService.flush()
    await approveSession(session)
    return (await getOfflineDb().countSessions.get(SESSION_ID))!
  }

  async function kioskCountFor(kioskId: string) {
    return (await loadKioskCounts(SESSION_ID)).find((kc) => kc.kioskId === kioskId)!
  }

  /** Telt de kiosk opnieuw en rondt hem af. */
  async function recount(kioskId: string, countedQuarters: number) {
    const kioskCount = await kioskCountFor(kioskId)
    await saveCount({
      kioskCountId: kioskCount.id,
      productId: 'prod-water',
      standard: STANDARD,
      countedQuarters,
      userId: USER_ID,
    })
    await completeKiosk(kioskCount)
    await flushPendingCountWrites()
    await syncService.flush()
  }

  it('zet de telronde op REOPENED en het evenement terug op tellen', async () => {
    const session = await approvedSession()
    expect(session.status).toBe(CountSessionStatus.APPROVED)

    const result = await reopenApprovedKiosk({
      session,
      kioskCount: await kioskCountFor(shortRoute[0]!),
    })

    expect(result.session.status).toBe(CountSessionStatus.REOPENED)
    expect(result.kioskCount.status).toBe(KioskCountStatus.IN_PROGRESS)
    expect(result.kioskCount.completedAt).toBeUndefined()
    expect(updateEventStatus).toHaveBeenLastCalledWith(EVENT_ID, types.EventStatus.COUNTING)

    const stored = await getOfflineDb().countSessions.get(SESSION_ID)
    expect(stored!.status).toBe(CountSessionStatus.REOPENED)
    expect(stored!.completedAt).toBeUndefined()
  })

  it('zet de bijvulbehoeften van die kiosk op nul', async () => {
    const session = await approvedSession()

    const result = await reopenApprovedKiosk({
      session,
      kioskCount: await kioskCountFor(shortRoute[0]!),
    })

    expect(result.clearedRequirements).toBe(1)
    const forKiosk = fakeRestockRepo.requirements.find((r) => r.kioskId === shortRoute[0])!
    expect(forKiosk.requiredPackages).toBe(0)

    // De andere kiosk blijft gewoon staan.
    const other = fakeRestockRepo.requirements.find((r) => r.kioskId === shortRoute[1])!
    expect(other.requiredPackages).toBe(11)
  })

  it('laat een oude behoefte vervallen als het tekort na correctie nul is', async () => {
    const session = await approvedSession()
    const { session: reopened } = await reopenApprovedKiosk({
      session,
      kioskCount: await kioskCountFor(shortRoute[0]!),
    })

    await recount(shortRoute[0]!, 60) // kiosk blijkt vol
    const result = await approveSession(reopened)

    expect(result.requirementCount).toBe(1)
    expect(
      fakeRestockRepo.requirements.find((r) => r.kioskId === shortRoute[0])!.requiredPackages
    ).toBe(0)
  })

  it('werkt een gecorrigeerd tekort bij in plaats van er een tweede regel bij te zetten', async () => {
    const session = await approvedSession()
    const { session: reopened } = await reopenApprovedKiosk({
      session,
      kioskCount: await kioskCountFor(shortRoute[0]!),
    })

    await recount(shortRoute[0]!, 40) // 10 van 15 → 5 bij
    await approveSession(reopened)

    const forKiosk = fakeRestockRepo.requirements.filter((r) => r.kioskId === shortRoute[0])
    expect(forKiosk).toHaveLength(1)
    expect(forKiosk[0]!.requiredPackages).toBe(5)
  })

  it('laat een gereserveerde behoefte staan bij heropenen', async () => {
    const session = await approvedSession()
    const requirement = fakeRestockRepo.requirements.find((r) => r.kioskId === shortRoute[0])!
    await fakeRestockRepo.updateRequirement(requirement.id, { reservedPackages: 11 })

    const result = await reopenApprovedKiosk({
      session,
      kioskCount: await kioskCountFor(shortRoute[0]!),
    })

    expect(result.requirementsInUse).toBe(1)
    expect(result.clearedRequirements).toBe(0)
    expect(
      fakeRestockRepo.requirements.find((r) => r.kioskId === shortRoute[0])!.requiredPackages
    ).toBe(11)
  })

  it('weigert opnieuw goedkeuren als er al voorraad voor de kiosk vastligt', async () => {
    const session = await approvedSession()
    const requirement = fakeRestockRepo.requirements.find((r) => r.kioskId === shortRoute[0])!
    await fakeRestockRepo.updateRequirement(requirement.id, { deliveredPackages: 4 })

    const { session: reopened } = await reopenApprovedKiosk({
      session,
      kioskCount: await kioskCountFor(shortRoute[0]!),
    })
    await recount(shortRoute[0]!, 60)

    await expect(approveSession(reopened)).rejects.toThrow(RequirementInUseError)
    await expect(approveSession(reopened)).rejects.toMatchObject({
      code: 'REQUIREMENT_ALREADY_IN_USE',
      kioskIds: [shortRoute[0]],
    })

    // De leverhistorie blijft ongemoeid en de ronde is niet goedgekeurd.
    expect(
      fakeRestockRepo.requirements.find((r) => r.kioskId === shortRoute[0])!.deliveredPackages
    ).toBe(4)
    expect((await getOfflineDb().countSessions.get(SESSION_ID))!.status).toBe(
      CountSessionStatus.REOPENED
    )
  })

  it('raakt de telronde niet aan bij een kiosk in een lopende ronde', async () => {
    const session = makeSession({ kioskRoute: shortRoute })
    await saveCountSessionLocally(session)
    await countKiosk(shortRoute[0]!)

    const result = await reopenApprovedKiosk({
      session,
      kioskCount: await kioskCountFor(shortRoute[0]!),
    })

    expect(result.session.status).toBe(CountSessionStatus.IN_PROGRESS)
    expect(result.kioskCount.status).toBe(KioskCountStatus.IN_PROGRESS)
    expect(result.clearedRequirements).toBe(0)
  })
})
