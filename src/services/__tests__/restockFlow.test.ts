import { describe, it, expect, beforeEach, vi } from 'vitest'
import { FakeRestockRepository } from './fakeRestockRepository'
import type { Event, Kiosk, Product } from '@/types'

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

/** Normen per kiosk, zodat het afleverscherm "moet er staan" kan tonen. */
const STANDARDS = new Map<string, Array<{ productId: string; targetQuantityQuarters: number }>>()

vi.mock('@/repositories', () => ({
  repositories: {
    restock: () => fakeRestockRepo,
    product: () => ({
      getStandards: async (kioskId: string) => STANDARDS.get(kioskId) ?? [],
    }),
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
  findEventWithOpenRestockWork,
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
const {
  RestockRoundStatus,
  RestockRoundType,
  RoundType,
  ProductSize,
  InputStep,
  DeliveryReason,
  EventStatus,
  EventType,
} = await import('@/types')

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
  STANDARDS.clear()
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

describe('evenement met openstaand vulwerk', () => {
  function fakeEvent(id: string): Event {
    return {
      id,
      name: id,
      date: '2026-08-08',
      eventType: EventType.VOETBAL,
      status: EventStatus.READY_FOR_RESTOCK,
      activeRingIds: [],
      activeKioskIds: [],
      assignedUserIds: [],
      createdById: PLANNER,
      createdAt: '',
      updatedAt: '',
    }
  }

  it('slaat een evenement zonder openstaand tekort over', async () => {
    await seedRequirements('water', [5])

    const chosen = await findEventWithOpenRestockWork([
      fakeEvent('event-afgerond'),
      fakeEvent(EVENT_ID),
    ])

    expect(chosen?.id).toBe(EVENT_ID)
  })

  it('slaat ook een evenement over waarvan alles al gereserveerd is', async () => {
    await seedRequirements('water', [5])
    await createProductRound({
      eventId: EVENT_ID,
      ringId: RING_ID,
      productId: 'water',
      productName: 'Water blauw',
      createdById: PLANNER,
    })

    expect(await findEventWithOpenRestockWork([fakeEvent(EVENT_ID)])).toBeNull()
  })
})

describe('gelijktijdig reserveren', () => {
  /** Twee gebruikers die op hetzelfde moment dezelfde ronde willen maken. */
  function raceForWater() {
    return Promise.allSettled([
      createProductRound({
        eventId: EVENT_ID,
        ringId: RING_ID,
        productId: 'water',
        productName: 'Water blauw',
        createdById: PLANNER,
      }),
      createProductRound({
        eventId: EVENT_ID,
        ringId: RING_ID,
        productId: 'water',
        productName: 'Water blauw',
        createdById: VULLER,
      }),
    ])
  }

  it('reserveert dezelfde tien pakken niet twee keer', async () => {
    await seedRequirements('water', [10])

    await raceForWater()

    const requirement = (await fakeRestockRepo.getRequirements(EVENT_ID))[0]!
    expect(requirement.reservedPackages).toBe(10)
    expect(requirement.reservedPackages + requirement.deliveredPackages).toBeLessThanOrEqual(
      requirement.requiredPackages
    )

    const totalReserved = fakeRestockRepo.reservations.reduce(
      (sum, reservation) => sum + reservation.reservedPackages,
      0
    )
    expect(totalReserved).toBe(10)
  })

  it('laat maar één van de twee rondes slagen', async () => {
    await seedRequirements('water', [10])

    const outcomes = (await raceForWater()).map((result) => result.status)

    expect(outcomes.filter((status) => status === 'fulfilled')).toHaveLength(1)
    expect(outcomes.filter((status) => status === 'rejected')).toHaveLength(1)
    expect(fakeRestockRepo.rounds).toHaveLength(1)
  })

  it('maakt geen lege ronde aan als er niets meer vrij is', async () => {
    await seedRequirements('water', [5])
    await createProductRound({
      eventId: EVENT_ID,
      ringId: RING_ID,
      productId: 'water',
      productName: 'Water blauw',
      createdById: PLANNER,
    })

    await expect(
      createProductRound({
        eventId: EVENT_ID,
        ringId: RING_ID,
        productId: 'water',
        productName: 'Water blauw',
        createdById: VULLER,
      })
    ).rejects.toThrow('niets meer te plannen')

    // Geen weesronde zonder inhoud.
    expect(fakeRestockRepo.rounds).toHaveLength(1)
  })

  it('reserveert alleen wat er na een eerdere levering nog over is', async () => {
    await seedRequirements('water', [10])
    const requirement = (await fakeRestockRepo.getRequirements(EVENT_ID))[0]!
    await fakeRestockRepo.updateRequirement(requirement.id, { deliveredPackages: 4 })

    await createProductRound({
      eventId: EVENT_ID,
      ringId: RING_ID,
      productId: 'water',
      productName: 'Water blauw',
      createdById: PLANNER,
    })

    const after = (await fakeRestockRepo.getRequirements(EVENT_ID))[0]!
    expect(after.reservedPackages).toBe(6)
    expect(after.reservedPackages + after.deliveredPackages).toBe(after.requiredPackages)
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

  it('toont naast het te leveren aantal ook de norm van de kiosk', async () => {
    STANDARDS.set('kiosk-101', [{ productId: 'water', targetQuantityQuarters: 60 }])
    const round = await readyRound()
    const plan = await getRoundPlan(round.id)
    const stopPlan = await getStopPlan(round.id, plan.stops[0]!.id)

    expect(stopPlan.products[0]).toMatchObject({
      productId: 'water',
      plannedPackages: 6,
      targetPackages: 15,
    })
  })

  it('laat de norm weg als die er voor deze kiosk niet is', async () => {
    const round = await readyRound()
    const plan = await getRoundPlan(round.id)
    const stopPlan = await getStopPlan(round.id, plan.stops[0]!.id)

    expect(stopPlan.products[0]!.targetPackages).toBeUndefined()
  })

  it('toont bij een halte wat er daarna nog nodig is', async () => {
    await seedRequirements('servetten', [0, 3])
    const round = await readyRound()
    const plan = await getRoundPlan(round.id)

    // Bij de eerste halte staan de 4 water van kiosk 102 nog open.
    const first = await getStopPlan(round.id, plan.stops[0]!.id)
    expect(first.stillNeededAfter).toEqual([
      { productId: 'water', packages: 4, kioskCount: 1 },
    ])

    // Bij de laatste halte, met de eerste afgerond, volgt er niets meer.
    await completeStop(plan.stops[0]!.id)
    const last = await getStopPlan(round.id, plan.stops[1]!.id)
    expect(last.stillNeededAfter).toEqual([])
  })

  it('telt een afgeronde halte niet meer mee in wat er nog nodig is', async () => {
    const round = await readyRound()
    const plan = await getRoundPlan(round.id)

    expect(plan.stillNeededByProduct.get('water')).toEqual({
      productId: 'water',
      packages: 10,
      kioskCount: 2,
    })

    await registerDelivery({
      roundId: round.id,
      stopId: plan.stops[0]!.id,
      productId: 'water',
      plannedPackages: 6,
      deliveredPackages: 6,
      userId: VULLER,
    })
    await completeStop(plan.stops[0]!.id)

    const after = await getRoundPlan(round.id)
    expect(after.stillNeededByProduct.get('water')).toEqual({
      productId: 'water',
      packages: 4,
      kioskCount: 1,
    })
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

  it('boekt nooit meer af dan er voor de ronde gepland staat', async () => {
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
    ).rejects.toThrow(/nog maar 4 van dit product gepland/)
  })

  it('telt een levering niet dubbel als hij twee keer wordt weggeschreven', async () => {
    // De app schrijft de levering rechtstreeks weg én zet hem in de outbox.
    // Kwam die tweede poging als losse regel binnen, dan stond er "16 van 8
    // geleverd" op het scherm.
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

    const delivery = (await fakeRestockRepo.getDeliveriesForStop(plan.stops[0]!.id))[0]!
    await fakeRestockRepo.createDelivery(delivery)

    const stopPlan = await getStopPlan(round.id, plan.stops[0]!.id)
    expect(stopPlan.products[0]!.deliveredPackages).toBe(6)
    expect(await fakeRestockRepo.getDeliveriesForStop(plan.stops[0]!.id)).toHaveLength(1)
  })

  it('boekt dezelfde levering maar één keer af op de behoefte', async () => {
    // De levering gaat rechtstreeks weg én via de outbox. Zou de tweede
    // aanbieding opnieuw afboeken, dan telde de behoefte dubbel af.
    const round = await readyRound()
    const plan = await getRoundPlan(round.id)
    const stopId = plan.stops[0]!.id
    const requirementId = plan.stopItems.find(
      (item) => item.restockRoundStopId === stopId
    )!.restockRequirementId

    const delivery = {
      id: 'levering-1',
      restockRoundStopId: stopId,
      productId: 'water',
      plannedPackages: 6,
      deliveredPackages: 6,
      notDeliveredPackages: 0,
      deliveredAt: '2026-08-08T12:00:00.000Z',
      deliveredById: VULLER,
      createdAt: '2026-08-08T12:00:00.000Z',
    }

    const first = await fakeRestockRepo.registerDeliveryAtomic({
      delivery,
      roundId: round.id,
      requirementId,
    })
    const second = await fakeRestockRepo.registerDeliveryAtomic({
      delivery,
      roundId: round.id,
      requirementId,
    })

    expect(first.isNew).toBe(true)
    expect(second.isNew).toBe(false)
    expect(await fakeRestockRepo.getDeliveriesForStop(stopId)).toHaveLength(1)

    const requirement = (await fakeRestockRepo.getRequirements(EVENT_ID)).find(
      (r) => r.kioskId === 'kiosk-101'
    )!
    expect(requirement.deliveredPackages).toBe(6)
    expect(requirement.reservedPackages).toBe(0)

    const item = (await fakeRestockRepo.getRoundItems(round.id))[0]!
    expect(item.deliveredPackages).toBe(6)
  })

  it('geeft na een gedeeltelijke levering het restant direct terug aan de planning', async () => {
    await seedRequirements('water', [10])
    const round = await createProductRound({
      eventId: EVENT_ID,
      ringId: RING_ID,
      productId: 'water',
      productName: 'Water blauw',
      createdById: PLANNER,
    })
    await setLoadedQuantities(round.id, new Map([['water', 10]]))
    const plan = await getRoundPlan(round.id)

    expect((await fakeRestockRepo.getRequirements(EVENT_ID))[0]!.reservedPackages).toBe(10)

    await registerDelivery({
      roundId: round.id,
      stopId: plan.stops[0]!.id,
      productId: 'water',
      plannedPackages: 10,
      deliveredPackages: 6,
      reason: DeliveryReason.ONVOLDOENDE_VOORRAAD,
      userId: VULLER,
    })

    const requirement = (await fakeRestockRepo.getRequirements(EVENT_ID))[0]!
    expect(requirement.deliveredPackages).toBe(6)
    expect(requirement.reservedPackages).toBe(0)
    expect(openPackages(requirement)).toBe(4)
    expect(unplannedPackages(requirement)).toBe(4)
    // De invariant die de database sinds migratie 006 ook bewaakt.
    expect(requirement.reservedPackages + requirement.deliveredPackages).toBeLessThanOrEqual(
      requirement.requiredPackages
    )

    const { mixedPalletItems } = planRestock(
      await fakeRestockRepo.getRequirements(EVENT_ID),
      new Map([['water', product('water', { roundType: RoundType.MIXED_PALLET })]])
    )
    expect(mixedPalletItems[0]!.totalRequiredPackages).toBe(4)
  })

  it('stopt een ronde halverwege en geeft de rest terug aan de vulplanning', async () => {
    const round = await readyRound()
    const plan = await getRoundPlan(round.id)

    // Eerste kiosk gevuld, tweede niet meer aan toegekomen.
    await registerDelivery({
      roundId: round.id,
      stopId: plan.stops[0]!.id,
      productId: 'water',
      plannedPackages: 6,
      deliveredPackages: 6,
      userId: VULLER,
    })
    await completeStop(plan.stops[0]!.id)

    const stopped = await completeRound(round.id)
    expect(stopped.status).toBe(RestockRoundStatus.PARTIALLY_COMPLETED)

    const requirements = await fakeRestockRepo.getRequirements(EVENT_ID)
    const first = requirements.find((r) => r.kioskId === 'kiosk-101')!
    const second = requirements.find((r) => r.kioskId === 'kiosk-102')!

    // Wat geleverd is blijft staan; de niet-bezochte kiosk staat weer open.
    expect(openPackages(first)).toBe(0)
    expect(unplannedPackages(second)).toBe(4)
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
