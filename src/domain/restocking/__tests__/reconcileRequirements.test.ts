import { describe, it, expect } from 'vitest'
import { reconcileRestockRequirements } from '../reconcileRequirements'
import { KioskCountStatus, FractionRule } from '@/types'
import type { CountEntry, KioskCount, RestockRequirement } from '@/types'

const EVENT_ID = 'event-1'

function kioskCount(kioskId: string, status = KioskCountStatus.COMPLETED): KioskCount {
  return {
    id: `kc-${kioskId}`,
    countSessionId: 'sessie-1',
    kioskId,
    counterId: 'teller-1',
    status,
    createdAt: '2026-08-01T10:00:00.000Z',
    updatedAt: '2026-08-01T10:00:00.000Z',
  }
}

function entry(kioskCountId: string, productId: string, restock: number): CountEntry {
  return {
    id: `${kioskCountId}:${productId}`,
    kioskCountId,
    productId,
    targetQuantityQuarters: 40,
    countedQuantityQuarters: 0,
    effectiveQuantityQuarters: 0,
    restockQuantityPackages: restock,
    appliedFractionRule: FractionRule.NONE,
    lastModifiedAt: '2026-08-01T10:00:00.000Z',
    lastModifiedById: 'teller-1',
  }
}

function requirement(
  kioskId: string,
  productId: string,
  overrides: Partial<RestockRequirement> = {}
): RestockRequirement {
  return {
    id: `${kioskId}:${productId}`,
    eventId: EVENT_ID,
    kioskId,
    productId,
    requiredPackages: 6,
    reservedPackages: 0,
    deliveredPackages: 0,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  }
}

/** Eén kiosk met één product; `restock` is het nieuwe tekort. */
function reconcileOneKiosk(params: {
  restock: number
  existing: RestockRequirement[]
  status?: KioskCountStatus
}) {
  const count = kioskCount('kiosk-116', params.status)
  return reconcileRestockRequirements({
    eventId: EVENT_ID,
    kioskCounts: [count],
    entriesByKioskCount: new Map([[count.id, [entry(count.id, 'water', params.restock)]]]),
    existing: params.existing,
    scopeKioskIds: ['kiosk-116'],
  })
}

describe('reconcileRestockRequirements', () => {
  it('maakt een nieuwe behoefte aan', () => {
    const result = reconcileOneKiosk({ restock: 6, existing: [] })

    expect(result.toUpsert).toEqual([
      expect.objectContaining({ kioskId: 'kiosk-116', productId: 'water', requiredPackages: 6 }),
    ])
    expect(result.toClear).toEqual([])
    expect(result.blocked).toEqual([])
  })

  it('schrijft niets weg als er niets veranderd is', () => {
    const result = reconcileOneKiosk({
      restock: 6,
      existing: [requirement('kiosk-116', 'water', { requiredPackages: 6 })],
    })

    expect(result.toUpsert).toEqual([])
    expect(result.toClear).toEqual([])
    expect(result.active).toHaveLength(1)
  })

  it('werkt een gewijzigd aantal bij', () => {
    const result = reconcileOneKiosk({
      restock: 2,
      existing: [requirement('kiosk-116', 'water', { requiredPackages: 6 })],
    })

    expect(result.toUpsert).toEqual([
      expect.objectContaining({ requiredPackages: 2 }),
    ])
  })

  it('laat een behoefte vervallen zodra het tekort nul is', () => {
    // Het scenario uit de praktijk: water kiosk 116 stond op 6, na correctie
    // blijkt de kiosk vol. Zonder deze stap zou die 6 blijven staan.
    const result = reconcileOneKiosk({
      restock: 0,
      existing: [requirement('kiosk-116', 'water', { requiredPackages: 6 })],
    })

    expect(result.toUpsert).toEqual([])
    expect(result.toClear).toEqual([
      expect.objectContaining({ kioskId: 'kiosk-116', productId: 'water', requiredPackages: 0 }),
    ])
    expect(result.active).toEqual([])
  })

  it('laat een overgeslagen kiosk zijn oude behoefte niet houden', () => {
    const result = reconcileOneKiosk({
      restock: 6,
      status: KioskCountStatus.SKIPPED,
      existing: [requirement('kiosk-116', 'water', { requiredPackages: 6 })],
    })

    expect(result.toClear).toHaveLength(1)
  })

  it('blokkeert een behoefte waarvoor al gereserveerd is', () => {
    const result = reconcileOneKiosk({
      restock: 0,
      existing: [
        requirement('kiosk-116', 'water', { requiredPackages: 6, reservedPackages: 6 }),
      ],
    })

    expect(result.blocked).toHaveLength(1)
    expect(result.toClear).toEqual([])
  })

  it('blokkeert een behoefte waarvoor al geleverd is', () => {
    const result = reconcileOneKiosk({
      restock: 2,
      existing: [
        requirement('kiosk-116', 'water', { requiredPackages: 6, deliveredPackages: 4 }),
      ],
    })

    expect(result.blocked).toHaveLength(1)
    expect(result.toUpsert).toEqual([])
  })

  it('blokkeert niet wanneer een gebruikte behoefte ongewijzigd blijft', () => {
    const result = reconcileOneKiosk({
      restock: 6,
      existing: [
        requirement('kiosk-116', 'water', { requiredPackages: 6, deliveredPackages: 4 }),
      ],
    })

    expect(result.blocked).toEqual([])
    expect(result.toUpsert).toEqual([])
  })

  it('laat behoeften van een andere ring ongemoeid', () => {
    // Een telronde gaat over één ring. Ring 1 goedkeuren mag ring 2 niet wissen.
    const count = kioskCount('kiosk-116')
    const result = reconcileRestockRequirements({
      eventId: EVENT_ID,
      kioskCounts: [count],
      entriesByKioskCount: new Map([[count.id, [entry(count.id, 'water', 6)]]]),
      existing: [requirement('kiosk-216', 'water', { requiredPackages: 9 })],
      scopeKioskIds: ['kiosk-116'],
    })

    expect(result.toClear).toEqual([])
    expect(result.toUpsert.map((draft) => draft.kioskId)).toEqual(['kiosk-116'])
  })

  it('behoudt gereserveerde en geleverde aantallen bij een wijziging', () => {
    const result = reconcileOneKiosk({
      restock: 8,
      existing: [
        requirement('kiosk-116', 'water', {
          requiredPackages: 6,
          reservedPackages: 0,
          deliveredPackages: 0,
        }),
      ],
    })

    expect(result.toUpsert[0]).toMatchObject({
      requiredPackages: 8,
      reservedPackages: 0,
      deliveredPackages: 0,
    })
  })
})
