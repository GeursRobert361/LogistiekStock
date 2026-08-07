import { describe, it, expect, beforeEach, vi } from 'vitest'
import { FakeRestockRepository } from './fakeRestockRepository'
import type { Kiosk, Product } from '@/types'

const fakeRestockRepo = new FakeRestockRepository()

/** Ring met 6 kiosken, 101 t/m 106. */
const KIOSKS: Kiosk[] = Array.from({ length: 6 }, (_, i) => ({
  id: `kiosk-${101 + i}`,
  ringId: 'ring-1',
  number: 101 + i,
  sortOrder: i + 1,
  isActive: true,
  createdAt: '',
  updatedAt: '',
}))

/** Startkiosk voor vullen; per test aanpasbaar. */
let restockStartKioskId: string | undefined

vi.mock('@/repositories', () => ({
  repositories: {
    restock: () => fakeRestockRepo,
    kiosk: () => ({
      getKiosks: async (ringId?: string) =>
        KIOSKS.filter((k) => ringId === undefined || k.ringId === ringId),
      getRingById: async (id: string) => ({
        id,
        name: 'Ring 1',
        isActive: true,
        sortOrder: 1,
        restockStartKioskId,
        createdAt: '',
        updatedAt: '',
      }),
    }),
  },
}))

const {
  createProductRound,
  createMixedPalletRound,
  setLoadedQuantities,
  startPalletRound,
  cancelRound,
  claimRound,
  startRound,
} = await import('../restockPlanningService')
const {
  getRoundPlan,
  getStopPlan,
  registerDelivery,
  completeStop,
  completeRound,
  flushPendingDeliveryWrites,
} = await import('../deliveryService')
const { planRestock } = await import('@/domain/restocking/planRestock')
const { unplannedPackages, openPackages } = await import('@/domain/restocking/buildRequirements')
const { RestockRoundStatus, RestockRoundType, RoundType, ProductSize, InputStep, DeliveryReason } =
  await import('@/types')

const EVENT_ID = 'event-1'
const RING_ID = 'ring-1'
const PLANNER = 'planner-1'
const VULLER = 'vuller-1'

function product(id: string, overrides: Partial<Product> = {}): Product {
  return {
    id,
    categoryId: 'cat-1',
    name: id,
    shortName: id,
    countUnit: 'pak',
    packagingUnit: 'pakken',
    sortOrder: 1,
    isActive: true,
    inputStep: InputStep.ONE,
    allowPartialPackage: false,
    roundType: RoundType.AUTO,
    productSize: ProductSize.MEDIUM,
    estimatedPalletLoad: 1,
    ownRoundThreshold: 20,
    priority: 0,
    refrigerated: false,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  }
}

/** Legt behoeften klaar: kiosk-index → aantal verpakkingen. */
async function seedRequirements(productId: string, perKiosk: number[]) {
  for (const [index, packages] of perKiosk.entries()) {
    if (packages <= 0) continue
    await fakeRestockRepo.upsertRequirement({
      eventId: EVENT_ID,
      kioskId: KIOSKS[index]!.id,
      productId,
      requiredPackages: packages,
      reservedPackages: 0,
      deliveredPackages: 0,
    })
  }
}

beforeEach(() => {
  fakeRestockRepo.reset()
  restockStartKioskId = undefined
})

describe('planRestock', () => {
  const products = new Map<string, Product>([
    ['water', product('water', { roundType: RoundType.PRODUCT_ROUND })],
    ['chips', product('chips', { roundType: RoundType.MIXED_PALLET })],
    ['bekers', product('bekers', { roundType: RoundType.AUTO, ownRoundThreshold: 10 })],
    ['servetten', product('servetten', { roundType: RoundType.AUTO, ownRoundThreshold: 100 })],
  ])

  function requirement(productId: string, kioskId: string, packages: number) {
    return {
      id: `${productId}-${kioskId}`,
      eventId: EVENT_ID,
      kioskId,
      productId,
      requiredPackages: packages,
      reservedPackages: 0,
      deliveredPackages: 0,
      createdAt: '',
      updatedAt: '',
    }
  }

  it('geeft PRODUCT_ROUND-producten altijd een eigen ronde', () => {
    const { productRoundItems } = planRestock([requirement('water', 'kiosk-101', 3)], products)
    expect(productRoundItems.map((i) => i.product.id)).toEqual(['water'])
  })

  it('geeft een AUTO-product een eigen ronde zodra de drempel gehaald is', () => {
    const { productRoundItems, mixedPalletItems } = planRestock(
      [requirement('bekers', 'kiosk-101', 6), requirement('bekers', 'kiosk-102', 6)],
      products
    )
    expect(productRoundItems.map((i) => i.product.id)).toEqual(['bekers'])
    expect(productRoundItems[0]!.ownRoundReason).toBe('AANTAL')
    expect(mixedPalletItems).toEqual([])
  })

  it('houdt AUTO-producten onder de drempel op een gemengde pallet', () => {
    const { mixedPalletItems } = planRestock([requirement('servetten', 'kiosk-101', 4)], products)
    expect(mixedPalletItems.map((i) => i.product.id)).toEqual(['servetten'])
  })

  it('negeert al gereserveerde behoeften', () => {
    const reserved = { ...requirement('chips', 'kiosk-101', 5), reservedPackages: 5 }
    const { mixedPalletItems } = planRestock([reserved], products)
    expect(mixedPalletItems).toEqual([])
  })
})

describe('productronde', () => {
  it('reserveert de behoefte zodat die niet dubbel gepland kan worden', async () => {
    await seedRequirements('water', [7, 3, 0, 12, 0, 5])

    await createProductRound({
      eventId: EVENT_ID,
      ringId: RING_ID,
      productId: 'water',
      productName: 'Water blauw',
      createdById: PLANNER,
    })

    const requirements = await fakeRestockRepo.getRequirements(EVENT_ID)
    expect(requirements.every((r) => unplannedPackages(r) === 0)).toBe(true)
    expect(fakeRestockRepo.reservations).toHaveLength(4)

    await expect(
      createProductRound({
        eventId: EVENT_ID,
        ringId: RING_ID,
        productId: 'water',
        productName: 'Water blauw',
        createdById: PLANNER,
      })
    ).rejects.toThrow('niets meer te plannen')
  })

  it('slaat kiosken zonder vraag over in de route', async () => {
    await seedRequirements('water', [7, 0, 0, 12, 0, 5])

    const round = await createProductRound({
      eventId: EVENT_ID,
      ringId: RING_ID,
      productId: 'water',
      productName: 'Water blauw',
      createdById: PLANNER,
    })
    await setLoadedQuantities(round.id, new Map([['water', 24]]))

    const plan = await getRoundPlan(round.id)
    expect(plan.stops.map((s) => s.kioskId)).toEqual(['kiosk-101', 'kiosk-104', 'kiosk-106'])
  })

  it('verdeelt niet meer dan er geladen is', async () => {
    await seedRequirements('water', [7, 3, 12])

    const round = await createProductRound({
      eventId: EVENT_ID,
      ringId: RING_ID,
      productId: 'water',
      productName: 'Water blauw',
      createdById: PLANNER,
    })
    // Nodig is 22, maar er gaat maar 10 op de pallet.
    await setLoadedQuantities(round.id, new Map([['water', 10]]))

    const plan = await getRoundPlan(round.id)
    const totalPlanned = plan.stopItems.reduce((sum, item) => sum + item.plannedPackages, 0)

    expect(totalPlanned).toBe(10)
    expect(plan.stops).toHaveLength(2) // kiosk 103 valt buiten de lading
  })

  it('geeft reserveringen vrij bij annuleren', async () => {
    await seedRequirements('water', [7])
    const round = await createProductRound({
      eventId: EVENT_ID,
      ringId: RING_ID,
      productId: 'water',
      productName: 'Water blauw',
      createdById: PLANNER,
    })

    await cancelRound(round.id)

    const requirements = await fakeRestockRepo.getRequirements(EVENT_ID)
    expect(requirements[0]!.reservedPackages).toBe(0)
    expect(unplannedPackages(requirements[0]!)).toBe(7)
    expect((await fakeRestockRepo.getRoundById(round.id))!.status).toBe(
      RestockRoundStatus.CANCELLED
    )
  })
})

describe('gemengde pallet', () => {
  it('bevat alleen de geselecteerde producten', async () => {
    await seedRequirements('patatbakjes', [12])
    await seedRequirements('snackbakjes', [7])
    await seedRequirements('red-bull', [18])

    const round = await createMixedPalletRound({
      eventId: EVENT_ID,
      ringId: RING_ID,
      productIds: ['patatbakjes', 'snackbakjes'],
      createdById: PLANNER,
      sequenceNumber: 3,
    })

    const items = await fakeRestockRepo.getRoundItems(round.id)
    expect(items.map((i) => i.productId).sort()).toEqual(['patatbakjes', 'snackbakjes'])
    expect(round.roundType).toBe(RestockRoundType.MIXED_PALLET)
    expect(round.name).toBe('Gemengde pallet #3')

    // Red Bull blijft beschikbaar voor een andere pallet.
    const redBull = (await fakeRestockRepo.getRequirements(EVENT_ID)).find(
      (r) => r.productId === 'red-bull'
    )!
    expect(unplannedPackages(redBull)).toBe(18)
  })

  it('gebruikt de werkelijk geladen aantallen, niet het voorstel', async () => {
    await seedRequirements('patatbakjes', [12])
    await seedRequirements('snackbakjes', [7])

    const round = await createMixedPalletRound({
      eventId: EVENT_ID,
      ringId: RING_ID,
      productIds: ['patatbakjes', 'snackbakjes'],
      createdById: PLANNER,
      sequenceNumber: 1,
    })
    await setLoadedQuantities(
      round.id,
      new Map([
        ['patatbakjes', 12],
        ['snackbakjes', 6], // één minder geladen dan nodig
      ])
    )

    const plan = await getRoundPlan(round.id)
    const snack = plan.stopItems.filter((i) => i.productId === 'snackbakjes')
    expect(snack.reduce((sum, i) => sum + i.plannedPackages, 0)).toBe(6)
  })
})

describe('pallet pakken en meteen rijden', () => {
  it('levert een gestarte ronde met een eerste halte op', async () => {
    await seedRequirements('water', [6, 0, 4])
    await seedRequirements('servetten', [3])

    const result = await startPalletRound({
      eventId: EVENT_ID,
      ringId: RING_ID,
      productIds: ['water', 'servetten'],
      productNames: new Map([
        ['water', 'Water'],
        ['servetten', 'Servetten'],
      ]),
      userId: VULLER,
      sequenceNumber: 1,
    })

    expect(result.round.status).toBe(RestockRoundStatus.IN_PROGRESS)
    expect(result.round.assignedUserId).toBe(VULLER)
    expect(result.firstStopId).not.toBeNull()

    // De eerste halte is de eerste kiosk met vraag, niet zomaar de eerste kiosk.
    const stops = await fakeRestockRepo.getRoundStops(result.round.id)
    const first = stops.find((stop) => stop.id === result.firstStopId)!
    expect(first.kioskId).toBe('kiosk-101')
    expect(stops.map((s) => s.kioskId).sort()).toEqual(['kiosk-101', 'kiosk-103'])
  })

  it('laadt alles wat er open staat, zonder tussenstap', async () => {
    await seedRequirements('water', [6, 4])

    const result = await startPalletRound({
      eventId: EVENT_ID,
      ringId: RING_ID,
      productIds: ['water'],
      productNames: new Map([['water', 'Water']]),
      userId: VULLER,
      sequenceNumber: 1,
    })

    const items = await fakeRestockRepo.getRoundItems(result.round.id)
    expect(items).toHaveLength(1)
    expect(items[0]!.loadedPackages).toBe(10)

    const plan = await getRoundPlan(result.round.id)
    expect(plan.stopItems.reduce((sum, i) => sum + i.plannedPackages, 0)).toBe(10)
  })

  it('noemt één product een productronde en meerdere een gemengde pallet', async () => {
    await seedRequirements('water', [6])
    await seedRequirements('servetten', [3])

    const solo = await startPalletRound({
      eventId: EVENT_ID,
      ringId: RING_ID,
      productIds: ['water'],
      productNames: new Map([['water', 'Water']]),
      userId: VULLER,
      sequenceNumber: 1,
    })
    expect(solo.round.roundType).toBe(RestockRoundType.PRODUCT_ROUND)
    expect(solo.round.name).toBe('Productronde Water')

    const mixed = await startPalletRound({
      eventId: EVENT_ID,
      ringId: RING_ID,
      productIds: ['servetten'],
      productNames: new Map([['servetten', 'Servetten']]),
      userId: VULLER,
      sequenceNumber: 2,
    })
    expect(mixed.round.roundType).toBe(RestockRoundType.PRODUCT_ROUND)
  })

  it('weigert een pallet waar niets meer op kan', async () => {
    await expect(
      startPalletRound({
        eventId: EVENT_ID,
        ringId: RING_ID,
        productIds: ['water'],
        productNames: new Map(),
        userId: VULLER,
        sequenceNumber: 1,
      })
    ).rejects.toThrow(/niets meer te plannen/)
  })
})

describe('vulronde uitvoeren', () => {
  async function readyRound() {
    await seedRequirements('water', [6, 4])
    const round = await createProductRound({
      eventId: EVENT_ID,
      ringId: RING_ID,
      productId: 'water',
      productName: 'Water blauw',
      createdById: PLANNER,
    })
    await setLoadedQuantities(round.id, new Map([['water', 10]]))
    await claimRound(round.id, VULLER)
    await startRound(round.id)
    return round
  }

  it('toont per halte wat er geleverd moet worden', async () => {
    const round = await readyRound()
    const plan = await getRoundPlan(round.id)
    const stopPlan = await getStopPlan(round.id, plan.stops[0]!.id)

    expect(stopPlan.stopNumber).toBe(1)
    expect(stopPlan.totalStops).toBe(2)
    expect(stopPlan.products).toEqual([
      expect.objectContaining({ productId: 'water', plannedPackages: 6, deliveredPackages: 0 }),
    ])
  })

  it('sluit een behoefte bij volledige levering', async () => {
    const round = await readyRound()
    const plan = await getRoundPlan(round.id)

    await registerDelivery({
      roundId: round.id,
      stopId: plan.stops[0]!.id,
      productId: 'water',
      plannedPackages: 6,
      deliveredPackages: 6,
      userId: VULLER,
    })

    const requirement = (await fakeRestockRepo.getRequirements(EVENT_ID)).find(
      (r) => r.kioskId === 'kiosk-101'
    )!
    expect(openPackages(requirement)).toBe(0)
    expect(unplannedPackages(requirement)).toBe(0)
  })

  it('laat het restant van een gedeeltelijke levering openstaan', async () => {
    const round = await readyRound()
    const plan = await getRoundPlan(round.id)

    await registerDelivery({
      roundId: round.id,
      stopId: plan.stops[0]!.id,
      productId: 'water',
      plannedPackages: 6,
      deliveredPackages: 4,
      reason: DeliveryReason.NIET_OP_PALLET,
      userId: VULLER,
    })

    const requirement = (await fakeRestockRepo.getRequirements(EVENT_ID)).find(
      (r) => r.kioskId === 'kiosk-101'
    )!
    expect(openPackages(requirement)).toBe(2)
    // Reservering vrij: het restant is opnieuw te plannen.
    expect(unplannedPackages(requirement)).toBe(2)
  })

  it('verplicht een reden bij een afwijking', async () => {
    const round = await readyRound()
    const plan = await getRoundPlan(round.id)

    await expect(
      registerDelivery({
        roundId: round.id,
        stopId: plan.stops[0]!.id,
        productId: 'water',
        plannedPackages: 6,
        deliveredPackages: 4,
        userId: VULLER,
      })
    ).rejects.toThrow('reden')
  })

  it('vraagt om toelichting bij "andere reden"', async () => {
    const round = await readyRound()
    const plan = await getRoundPlan(round.id)

    await expect(
      registerDelivery({
        roundId: round.id,
        stopId: plan.stops[0]!.id,
        productId: 'water',
        plannedPackages: 6,
        deliveredPackages: 0,
        reason: DeliveryReason.ANDERE_REDEN,
        userId: VULLER,
      })
    ).rejects.toThrow('toe')
  })

  it('levert nooit meer dan er op de pallet ligt', async () => {
    const round = await readyRound()
    const plan = await getRoundPlan(round.id)

    await registerDelivery({
      roundId: round.id,
      stopId: plan.stops[0]!.id,
      productId: 'water',
      plannedPackages: 6,
      deliveredPackages: 6,
      userId: VULLER,
    })

    await expect(
      registerDelivery({
        roundId: round.id,
        stopId: plan.stops[1]!.id,
        productId: 'water',
        plannedPackages: 4,
        deliveredPackages: 8,
        reason: DeliveryReason.VERKEERDE_TELLING,
        userId: VULLER,
      })
    ).rejects.toThrow('op de pallet')
  })

  it('markeert een ronde met een tekort niet als volledig afgerond', async () => {
    const round = await readyRound()
    const plan = await getRoundPlan(round.id)

    await registerDelivery({
      roundId: round.id,
      stopId: plan.stops[0]!.id,
      productId: 'water',
      plannedPackages: 6,
      deliveredPackages: 4,
      reason: DeliveryReason.BESCHADIGD,
      userId: VULLER,
    })
    await completeStop(plan.stops[0]!.id)
    await registerDelivery({
      roundId: round.id,
      stopId: plan.stops[1]!.id,
      productId: 'water',
      plannedPackages: 4,
      deliveredPackages: 4,
      userId: VULLER,
    })
    await completeStop(plan.stops[1]!.id)

    const completed = await completeRound(round.id)
    expect(completed.status).toBe(RestockRoundStatus.PARTIALLY_COMPLETED)
  })

  it('markeert een volledig geleverde ronde als afgerond', async () => {
    const round = await readyRound()
    const plan = await getRoundPlan(round.id)

    for (const [index, stop] of plan.stops.entries()) {
      const stopPlan = await getStopPlan(round.id, stop.id)
      await registerDelivery({
        roundId: round.id,
        stopId: stop.id,
        productId: 'water',
        plannedPackages: stopPlan.products[0]!.plannedPackages,
        deliveredPackages: stopPlan.products[0]!.plannedPackages,
        userId: VULLER,
      })
      await completeStop(stop.id, index === 0 ? 'Alles afgeleverd' : undefined)
    }
    await flushPendingDeliveryWrites()

    const completed = await completeRound(round.id)
    expect(completed.status).toBe(RestockRoundStatus.COMPLETED)
  })

  it('laat het restant opnieuw in de vulplanning verschijnen', async () => {
    const round = await readyRound()
    const plan = await getRoundPlan(round.id)

    await registerDelivery({
      roundId: round.id,
      stopId: plan.stops[0]!.id,
      productId: 'water',
      plannedPackages: 6,
      deliveredPackages: 4,
      reason: DeliveryReason.ONVOLDOENDE_VOORRAAD,
      userId: VULLER,
    })
    await completeStop(plan.stops[0]!.id)
    await completeRound(round.id)

    const products = new Map([['water', product('water', { roundType: RoundType.MIXED_PALLET })]])
    const { mixedPalletItems } = planRestock(
      await fakeRestockRepo.getRequirements(EVENT_ID),
      products
    )

    // 2 open bij kiosk 101 en de volle 4 bij kiosk 102.
    expect(mixedPalletItems[0]!.totalRequiredPackages).toBe(6)
  })
})

describe('startkiosk van de ring', () => {
  it('begint de vulroute bij de ingestelde kiosk', async () => {
    // Vraag bij 101, 103 en 105; de ring start bij 103.
    await seedRequirements('water', [4, 0, 4, 0, 4, 0])
    restockStartKioskId = 'kiosk-103'

    const round = await createProductRound({
      eventId: EVENT_ID,
      ringId: RING_ID,
      productId: 'water',
      productName: 'Water blauw',
      createdById: PLANNER,
    })
    await setLoadedQuantities(round.id, new Map([['water', 12]]))

    const plan = await getRoundPlan(round.id)
    // Circulair vanaf 103: dus 103, 105, en dan wrapt hij naar 101.
    expect(plan.stops.map((s) => s.kioskId)).toEqual(['kiosk-103', 'kiosk-105', 'kiosk-101'])
  })

  it('start ook wanneer de ingestelde kiosk zelf geen vraag heeft', async () => {
    // Alleen vraag bij 101 en 105; de ring start bij 103, dat zelf niets nodig heeft.
    await seedRequirements('water', [4, 0, 0, 0, 4, 0])
    restockStartKioskId = 'kiosk-103'

    const round = await createProductRound({
      eventId: EVENT_ID,
      ringId: RING_ID,
      productId: 'water',
      productName: 'Water blauw',
      createdById: PLANNER,
    })
    await setLoadedQuantities(round.id, new Map([['water', 8]]))

    const plan = await getRoundPlan(round.id)
    // Je komt de ring binnen bij 103; de eerste halte is dan 105.
    expect(plan.stops.map((s) => s.kioskId)).toEqual(['kiosk-105', 'kiosk-101'])
  })

  it('valt terug op de eerste kiosk met vraag zonder instelling', async () => {
    await seedRequirements('water', [0, 0, 4, 0, 4, 0])
    restockStartKioskId = undefined

    const round = await createProductRound({
      eventId: EVENT_ID,
      ringId: RING_ID,
      productId: 'water',
      productName: 'Water blauw',
      createdById: PLANNER,
    })
    await setLoadedQuantities(round.id, new Map([['water', 8]]))

    const plan = await getRoundPlan(round.id)
    expect(plan.stops.map((s) => s.kioskId)).toEqual(['kiosk-103', 'kiosk-105'])
  })
})
