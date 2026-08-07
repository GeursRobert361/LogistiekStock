import { describe, it, expect } from 'vitest'
import { buildRestockRequirements, openPackages, unplannedPackages } from '../buildRequirements'
import { aggregateRestockTotals } from '../aggregateTotals'
import { KioskCountStatus, FractionRule } from '@/types/enums'
import type { KioskCount, CountEntry, RestockRequirement } from '@/types/domain'

function kioskCount(overrides: Partial<KioskCount> & { id: string; kioskId: string }): KioskCount {
  return {
    countSessionId: 'sessie-1',
    counterId: 'teller-1',
    status: KioskCountStatus.COMPLETED,
    createdAt: '2026-08-01T10:00:00Z',
    updatedAt: '2026-08-01T10:00:00Z',
    ...overrides,
  }
}

function entry(
  kioskCountId: string,
  productId: string,
  restockPackages: number
): CountEntry {
  return {
    id: `${kioskCountId}:${productId}`,
    kioskCountId,
    productId,
    targetQuantityQuarters: 60,
    countedQuantityQuarters: 0,
    effectiveQuantityQuarters: 0,
    restockQuantityPackages: restockPackages,
    appliedFractionRule: FractionRule.NONE,
    lastModifiedAt: '2026-08-01T10:00:00Z',
    lastModifiedById: 'teller-1',
  }
}

describe('buildRestockRequirements', () => {
  it('maakt één behoefte per kiosk en product', () => {
    const counts = [
      kioskCount({ id: 'kc-101', kioskId: 'kiosk-101' }),
      kioskCount({ id: 'kc-102', kioskId: 'kiosk-102' }),
    ]
    const entries = new Map([
      ['kc-101', [entry('kc-101', 'water', 7), entry('kc-101', 'chips', 2)]],
      ['kc-102', [entry('kc-102', 'water', 3)]],
    ])

    const result = buildRestockRequirements({
      eventId: 'event-1',
      kioskCounts: counts,
      entriesByKioskCount: entries,
    })

    expect(result).toHaveLength(3)
    expect(result.filter((r) => r.productId === 'water')).toHaveLength(2)
  })

  it('slaat producten zonder tekort over', () => {
    const counts = [kioskCount({ id: 'kc-101', kioskId: 'kiosk-101' })]
    const entries = new Map([
      ['kc-101', [entry('kc-101', 'water', 0), entry('kc-101', 'chips', 4)]],
    ])

    const result = buildRestockRequirements({
      eventId: 'event-1',
      kioskCounts: counts,
      entriesByKioskCount: entries,
    })

    expect(result).toHaveLength(1)
    expect(result[0]!.productId).toBe('chips')
  })

  it('negeert overgeslagen en lopende kiosken', () => {
    const counts = [
      kioskCount({ id: 'kc-101', kioskId: 'kiosk-101', status: KioskCountStatus.SKIPPED }),
      kioskCount({ id: 'kc-102', kioskId: 'kiosk-102', status: KioskCountStatus.IN_PROGRESS }),
      kioskCount({ id: 'kc-103', kioskId: 'kiosk-103' }),
    ]
    const entries = new Map([
      ['kc-101', [entry('kc-101', 'water', 9)]],
      ['kc-102', [entry('kc-102', 'water', 9)]],
      ['kc-103', [entry('kc-103', 'water', 5)]],
    ])

    const result = buildRestockRequirements({
      eventId: 'event-1',
      kioskCounts: counts,
      entriesByKioskCount: entries,
    })

    expect(result).toHaveLength(1)
    expect(result[0]!.kioskId).toBe('kiosk-103')
  })

  it('levert bij twee keer verwerken exact hetzelfde resultaat', () => {
    const counts = [kioskCount({ id: 'kc-101', kioskId: 'kiosk-101' })]
    const entries = new Map([['kc-101', [entry('kc-101', 'water', 7)]]])
    const input = { eventId: 'event-1', kioskCounts: counts, entriesByKioskCount: entries }

    const first = buildRestockRequirements(input)
    const second = buildRestockRequirements({ ...input, existing: withIds(first) })

    expect(second).toEqual(first)
    expect(second).toHaveLength(1)
  })

  it('behoudt al geleverde en gereserveerde aantallen bij opnieuw goedkeuren', () => {
    const counts = [kioskCount({ id: 'kc-101', kioskId: 'kiosk-101' })]
    const entries = new Map([['kc-101', [entry('kc-101', 'water', 7)]]])
    const existing: RestockRequirement[] = [
      {
        id: 'req-1',
        eventId: 'event-1',
        kioskId: 'kiosk-101',
        productId: 'water',
        requiredPackages: 7,
        reservedPackages: 2,
        deliveredPackages: 3,
        createdAt: '2026-08-01T10:00:00Z',
        updatedAt: '2026-08-01T10:00:00Z',
      },
    ]

    const result = buildRestockRequirements({
      eventId: 'event-1',
      kioskCounts: counts,
      entriesByKioskCount: entries,
      existing,
    })

    expect(result[0]!.deliveredPackages).toBe(3)
    expect(result[0]!.reservedPackages).toBe(2)
  })

  it('gebruikt de meest recente telling wanneer een kiosk twee keer geteld is', () => {
    const counts = [
      kioskCount({
        id: 'kc-oud',
        kioskId: 'kiosk-101',
        updatedAt: '2026-08-01T10:00:00Z',
      }),
      kioskCount({
        id: 'kc-nieuw',
        kioskId: 'kiosk-101',
        updatedAt: '2026-08-01T12:00:00Z',
      }),
    ]
    const entries = new Map([
      ['kc-oud', [entry('kc-oud', 'water', 9)]],
      ['kc-nieuw', [entry('kc-nieuw', 'water', 4)]],
    ])

    const result = buildRestockRequirements({
      eventId: 'event-1',
      kioskCounts: counts,
      entriesByKioskCount: entries,
    })

    expect(result).toHaveLength(1)
    expect(result[0]!.requiredPackages).toBe(4)
  })
})

describe('openPackages / unplannedPackages', () => {
  const requirement: RestockRequirement = {
    id: 'req-1',
    eventId: 'event-1',
    kioskId: 'kiosk-101',
    productId: 'water',
    requiredPackages: 6,
    reservedPackages: 2,
    deliveredPackages: 4,
    createdAt: '',
    updatedAt: '',
  }

  it('rekent geleverd af tegen nodig', () => {
    expect(openPackages(requirement)).toBe(2)
  })

  it('houdt rekening met reserveringen bij het plannen', () => {
    expect(unplannedPackages(requirement)).toBe(0)
    expect(unplannedPackages({ ...requirement, reservedPackages: 0 })).toBe(2)
  })

  it('gaat nooit onder nul', () => {
    expect(openPackages({ ...requirement, deliveredPackages: 10 })).toBe(0)
  })
})

describe('aggregateRestockTotals', () => {
  it('telt per product op over kiosken', () => {
    const counts = [
      kioskCount({ id: 'kc-101', kioskId: 'kiosk-101' }),
      kioskCount({ id: 'kc-102', kioskId: 'kiosk-102' }),
    ]
    const entries = new Map([
      ['kc-101', [entry('kc-101', 'water', 7), entry('kc-101', 'chips', 2)]],
      ['kc-102', [entry('kc-102', 'water', 5)]],
    ])

    const totals = aggregateRestockTotals(counts, entries)
    const water = totals.find((t) => t.productId === 'water')!

    expect(water.totalPackages).toBe(12)
    expect(water.perKiosk).toHaveLength(2)
    // Grootste tekort bovenaan
    expect(totals[0]!.productId).toBe('water')
  })

  it('negeert kiosken die niet zijn afgerond', () => {
    const counts = [
      kioskCount({ id: 'kc-101', kioskId: 'kiosk-101', status: KioskCountStatus.SKIPPED }),
    ]
    const entries = new Map([['kc-101', [entry('kc-101', 'water', 7)]]])

    expect(aggregateRestockTotals(counts, entries)).toEqual([])
  })
})

function withIds(
  drafts: ReturnType<typeof buildRestockRequirements>
): RestockRequirement[] {
  return drafts.map((draft, index) => ({
    ...draft,
    id: `req-${index}`,
    createdAt: '2026-08-01T10:00:00Z',
    updatedAt: '2026-08-01T10:00:00Z',
  }))
}
