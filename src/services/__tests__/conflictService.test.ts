import { describe, it, expect, beforeEach, vi } from 'vitest'
import { FakeCountRepository } from './fakeCountRepository'

const fakeCountRepo = new FakeCountRepository()

vi.mock('@/repositories', () => ({
  repositories: { count: () => fakeCountRepo },
}))

const { getCountEntryConflicts, resolveConflict } = await import('../conflictService')
const { loadEntries, saveCount, flushPendingCountWrites } = await import('../countingService')
const { getOfflineDb, getLocalEntries } = await import('@/lib/db/offlineDb')
const { syncService } = await import('../syncService')
const { registerSyncHandlers } = await import('../syncHandlers')

const KIOSK_COUNT_ID = 'kc-1'
const PRODUCT_ID = 'prod-water'
const TELLER = 'teller-1'
const PLANNER = 'planner-1'
const STANDARD = { targetQuantityQuarters: 60, halfPackageThresholdPercentage: 80 }

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

/**
 * Bootst het echte conflict na: lokaal geteld zonder verbinding, en intussen
 * zette iemand anders een andere waarde op de server.
 */
async function createConflict(localQuarters: number, serverQuarters: number) {
  fakeCountRepo.offline = true
  await saveCount({
    kioskCountId: KIOSK_COUNT_ID,
    productId: PRODUCT_ID,
    standard: STANDARD,
    countedQuarters: localQuarters,
    userId: TELLER,
  })
  await flushPendingCountWrites()
  fakeCountRepo.offline = false

  await new Promise((resolve) => setTimeout(resolve, 5))
  await fakeCountRepo.upsertCountEntry({
    id: 'server-entry',
    kioskCountId: KIOSK_COUNT_ID,
    productId: PRODUCT_ID,
    targetQuantityQuarters: 60,
    countedQuantityQuarters: serverQuarters,
    effectiveQuantityQuarters: serverQuarters,
    restockQuantityPackages: 15 - serverQuarters / 4,
    appliedFractionRule: 'NONE' as never,
    lastModifiedById: 'teller-2',
  })

  // De merge bij het openen van het telscherm signaleert het conflict.
  await loadEntries(KIOSK_COUNT_ID)
}

beforeEach(async () => {
  fakeCountRepo.reset()
  await clearDatabase()
  registerSyncHandlers()
})

describe('getCountEntryConflicts', () => {
  it('geeft niets terug zonder conflicten', async () => {
    expect(await getCountEntryConflicts()).toEqual([])
  })

  it('toont beide versies van een conflict', async () => {
    await createConflict(20, 4)

    const conflicts = await getCountEntryConflicts()

    expect(conflicts).toHaveLength(1)
    expect(conflicts[0]!.local.countedQuantityQuarters).toBe(20)
    expect(conflicts[0]!.server.countedQuantityQuarters).toBe(4)
  })
})

describe('resolveConflict', () => {
  it('houdt de lokale telling aan en stuurt die naar de server', async () => {
    await createConflict(20, 4)
    const [conflict] = await getCountEntryConflicts()

    await resolveConflict(conflict!, 'LOCAL', PLANNER)
    await syncService.flush()

    const local = await getLocalEntries(KIOSK_COUNT_ID)
    expect(local).toHaveLength(1)
    expect(local[0]!.countedQuantityQuarters).toBe(20)

    const server = fakeCountRepo.entries.filter((e) => e.productId === PRODUCT_ID)
    expect(server).toHaveLength(1)
    expect(server[0]!.countedQuantityQuarters).toBe(20)
  })

  it('neemt de serverwaarde over wanneer daarvoor wordt gekozen', async () => {
    await createConflict(20, 4)
    const [conflict] = await getCountEntryConflicts()

    await resolveConflict(conflict!, 'SERVER', PLANNER)
    await syncService.flush()

    const local = await getLocalEntries(KIOSK_COUNT_ID)
    expect(local[0]!.countedQuantityQuarters).toBe(4)
    expect(fakeCountRepo.entries[0]!.countedQuantityQuarters).toBe(4)
  })

  it('haalt een opgelost conflict uit de lijst', async () => {
    await createConflict(20, 4)
    const [conflict] = await getCountEntryConflicts()

    await resolveConflict(conflict!, 'LOCAL', PLANNER)

    expect(await getCountEntryConflicts()).toEqual([])
  })

  it('legt vast wie het conflict heeft opgelost', async () => {
    await createConflict(20, 4)
    const [conflict] = await getCountEntryConflicts()

    await resolveConflict(conflict!, 'LOCAL', PLANNER)

    const stored = await getOfflineDb().conflicts.get(conflict!.conflict.id)
    expect(stored!.resolvedBy).toBe(PLANNER)
    expect(stored!.resolvedAt).toBeDefined()
  })

  it('laat de gekozen versie een volgende merge winnen', async () => {
    await createConflict(20, 4)
    const [conflict] = await getCountEntryConflicts()

    await resolveConflict(conflict!, 'LOCAL', PLANNER)
    await syncService.flush()

    // Opnieuw laden mag het conflict niet opnieuw opwerpen.
    const merged = await loadEntries(KIOSK_COUNT_ID)
    expect(merged.get(PRODUCT_ID)!.countedQuantityQuarters).toBe(20)
    expect(await getCountEntryConflicts()).toEqual([])
  })
})
