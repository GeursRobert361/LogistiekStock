import { describe, it, expect, beforeEach, vi } from 'vitest'
import { FakeCountRepository } from './fakeCountRepository'
import { FakeRestockRepository } from './fakeRestockRepository'
import type {
  CountSession,
  CountSessionStatus as CountSessionStatusType,
  Event,
  KioskProductStandard,
} from '@/types'

const fakeCountRepo = new FakeCountRepository()
const fakeRestockRepo = new FakeRestockRepository()

/** Normen per ring, zoals getStandardMatrix ze teruggeeft. */
const standardsByRing = new Map<string, Record<string, Record<string, KioskProductStandard>>>()

vi.mock('@/repositories', () => ({
  repositories: {
    count: () => fakeCountRepo,
    restock: () => fakeRestockRepo,
    product: () => ({
      getStandardMatrix: async (ringId: string) => ({
        products: [],
        kiosks: [],
        standards: standardsByRing.get(ringId) ?? {},
      }),
    }),
  },
}))

const { getConsumptionOverview, leadingSessionsPerRing } = await import('../consumptionService')
const { toQuarterUnits, fromQuarterUnits } = await import('@/lib/quarterUnits')
const {
  CountSessionStatus,
  KioskCountStatus,
  RouteDirection,
  SyncStatus,
  FractionRule,
  EventStatus,
  EventType,
} = await import('@/types')

const qu = toQuarterUnits

const EVENT_A = 'event-a'
const EVENT_B = 'event-b'

function makeEvent(id: string, date: string, previousEventId?: string): Event {
  return {
    id,
    name: id,
    date,
    eventType: EventType.VOETBAL,
    status: EventStatus.COMPLETED,
    previousEventId,
    activeRingIds: ['ring-1'],
    activeKioskIds: ['kiosk-101', 'kiosk-102'],
    assignedUserIds: [],
    createdById: 'planner-1',
    createdAt: '',
    updatedAt: '',
  }
}

const EVENTS = [makeEvent(EVENT_A, '2026-08-01'), makeEvent(EVENT_B, '2026-08-08', EVENT_A)]

interface SessionSpec {
  id: string
  eventId: string
  ringId?: string
  status: CountSessionStatusType
  startedAt?: string
  /** kioskId → productId → getelde verpakkingen; `null` = kiosk overgeslagen. */
  counts: Record<string, Record<string, number> | null>
}

/** Zet een hele telronde in de nep-server. */
async function seedSession(spec: SessionSpec) {
  const startedAt = spec.startedAt ?? '2026-08-01T10:00:00.000Z'
  await fakeCountRepo.createSession({
    id: spec.id,
    userId: 'teller-1',
    eventId: spec.eventId,
    ringId: spec.ringId ?? 'ring-1',
    startKioskId: 'kiosk-101',
    direction: RouteDirection.ASCENDING,
    kioskRoute: Object.keys(spec.counts),
    startedAt,
    status: spec.status,
    syncStatus: SyncStatus.SYNCED,
  })

  for (const [kioskId, products] of Object.entries(spec.counts)) {
    const kioskCountId = `${spec.id}:${kioskId}`
    await fakeCountRepo.upsertKioskCount({
      id: kioskCountId,
      countSessionId: spec.id,
      kioskId,
      counterId: 'teller-1',
      status: products === null ? KioskCountStatus.SKIPPED : KioskCountStatus.COMPLETED,
      skipReason: products === null ? 'Kiosk gesloten' : undefined,
    })

    for (const [productId, packages] of Object.entries(products ?? {})) {
      await fakeCountRepo.upsertCountEntry({
        id: `${kioskCountId}:${productId}`,
        kioskCountId,
        productId,
        targetQuantityQuarters: qu(10),
        countedQuantityQuarters: qu(packages),
        effectiveQuantityQuarters: qu(packages),
        restockQuantityPackages: 0,
        appliedFractionRule: FractionRule.NONE,
        lastModifiedById: 'teller-1',
      })
    }
  }
}

function standard(kioskId: string, productId: string): KioskProductStandard {
  return {
    id: `${kioskId}:${productId}`,
    kioskId,
    productId,
    targetQuantityQuarters: qu(10),
    halfPackageThresholdPercentage: 80,
    isActive: true,
    createdAt: '',
    updatedAt: '',
  }
}

beforeEach(() => {
  fakeCountRepo.reset()
  fakeRestockRepo.reset()
  standardsByRing.clear()
})

describe('leadingSessionsPerRing', () => {
  function session(
    id: string,
    ringId: string,
    status: CountSessionStatusType,
    startedAt: string
  ): CountSession {
    return {
      id,
      userId: 'teller-1',
      eventId: EVENT_A,
      ringId,
      startKioskId: 'kiosk-101',
      direction: RouteDirection.ASCENDING,
      kioskRoute: [],
      startedAt,
      status,
      syncStatus: SyncStatus.SYNCED,
      createdAt: '',
      updatedAt: startedAt,
    }
  }

  it('laat een ingediende telling buiten beschouwing', () => {
    const result = leadingSessionsPerRing([
      session('a', 'ring-1', CountSessionStatus.SUBMITTED, '2026-08-01T10:00:00.000Z'),
    ])
    expect(result).toEqual([])
  })

  it('kiest per ring de laatst gestarte goedgekeurde ronde', () => {
    const result = leadingSessionsPerRing([
      session('oud', 'ring-1', CountSessionStatus.APPROVED, '2026-08-01T09:00:00.000Z'),
      session('nieuw', 'ring-1', CountSessionStatus.APPROVED, '2026-08-01T14:00:00.000Z'),
    ])
    expect(result.map((s) => s.id)).toEqual(['nieuw'])
  })

  it('houdt ringen apart', () => {
    const result = leadingSessionsPerRing([
      session('een', 'ring-1', CountSessionStatus.APPROVED, '2026-08-01T09:00:00.000Z'),
      session('twee', 'ring-2', CountSessionStatus.APPROVED, '2026-08-01T09:00:00.000Z'),
    ])
    expect(result.map((s) => s.ringId).sort()).toEqual(['ring-1', 'ring-2'])
  })
})

describe('verbruiksoverzicht', () => {
  it('gebruikt geen ingediende telling', async () => {
    await seedSession({
      id: 'a1',
      eventId: EVENT_A,
      status: CountSessionStatus.SUBMITTED,
      counts: { 'kiosk-101': { water: 10 } },
    })

    const overview = await getConsumptionOverview(EVENTS[0]!, EVENTS)
    expect(overview.blocker).toBe('GEEN_TELLING')
  })

  it('telt twee goedgekeurde rondes van dezelfde ring niet bij elkaar op', async () => {
    // De ring is opnieuw geteld; de tweede ronde is de geldige.
    await seedSession({
      id: 'a1',
      eventId: EVENT_A,
      status: CountSessionStatus.APPROVED,
      startedAt: '2026-08-01T09:00:00.000Z',
      counts: { 'kiosk-101': { water: 10 } },
    })
    await seedSession({
      id: 'a2',
      eventId: EVENT_A,
      status: CountSessionStatus.APPROVED,
      startedAt: '2026-08-01T14:00:00.000Z',
      counts: { 'kiosk-101': { water: 8 } },
    })
    await seedSession({
      id: 'b1',
      eventId: EVENT_B,
      status: CountSessionStatus.APPROVED,
      counts: { 'kiosk-101': { water: 3 } },
    })

    const overview = await getConsumptionOverview(EVENTS[0]!, EVENTS)
    const water = overview.rows[0]!.products[0]!

    // 8 stond er, 3 over → 5 verbruikt. Niet 18 − 3 = 15.
    expect(fromQuarterUnits(water.consumedQuarters!)).toBe(5)
    expect(water.confidence).toBe('KNOWN')
  })

  it('geeft geen verbruik voor een kiosk die bij de volgende telling is overgeslagen', async () => {
    await seedSession({
      id: 'a1',
      eventId: EVENT_A,
      status: CountSessionStatus.APPROVED,
      counts: { 'kiosk-101': { water: 10 }, 'kiosk-102': { water: 6 } },
    })
    await seedSession({
      id: 'b1',
      eventId: EVENT_B,
      status: CountSessionStatus.APPROVED,
      counts: { 'kiosk-101': { water: 4 }, 'kiosk-102': null },
    })

    const overview = await getConsumptionOverview(EVENTS[0]!, EVENTS)
    const skipped = overview.rows.find((row) => row.kioskId === 'kiosk-102')!

    expect(skipped.products[0]!.confidence).toBe('KIOSK_SKIPPED')
    expect(skipped.products[0]!.consumedQuarters).toBeNull()
    expect(skipped.totalConsumedQuarters).toBe(0)
  })

  it('herkent een product dat uit het assortiment is', async () => {
    await seedSession({
      id: 'a1',
      eventId: EVENT_A,
      status: CountSessionStatus.APPROVED,
      counts: { 'kiosk-101': { water: 10, cola: 4 } },
    })
    await seedSession({
      id: 'b1',
      eventId: EVENT_B,
      status: CountSessionStatus.APPROVED,
      counts: { 'kiosk-101': { water: 4 } },
    })
    // Bij het volgende evenement heeft alleen water nog een norm.
    standardsByRing.set('ring-1', { water: { 'kiosk-101': standard('kiosk-101', 'water') } })

    const overview = await getConsumptionOverview(EVENTS[0]!, EVENTS)
    const cola = overview.rows[0]!.products.find((p) => p.productId === 'cola')!

    expect(cola.confidence).toBe('ASSORTMENT_CHANGED')
    expect(cola.consumedQuarters).toBeNull()
  })

  it('meldt een niet ingevuld product met een geldige norm als onbekend', async () => {
    await seedSession({
      id: 'a1',
      eventId: EVENT_A,
      status: CountSessionStatus.APPROVED,
      counts: { 'kiosk-101': { water: 10, cola: 4 } },
    })
    await seedSession({
      id: 'b1',
      eventId: EVENT_B,
      status: CountSessionStatus.APPROVED,
      counts: { 'kiosk-101': { water: 4 } },
    })
    standardsByRing.set('ring-1', {
      water: { 'kiosk-101': standard('kiosk-101', 'water') },
      cola: { 'kiosk-101': standard('kiosk-101', 'cola') },
    })

    const overview = await getConsumptionOverview(EVENTS[0]!, EVENTS)
    const cola = overview.rows[0]!.products.find((p) => p.productId === 'cola')!

    expect(cola.confidence).toBe('NEXT_COUNT_MISSING')
  })
})
