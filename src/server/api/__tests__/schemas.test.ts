import { describe, it, expect } from 'vitest'
import { checkArguments, ARGUMENT_SCHEMAS } from '../schemas'
import { METHOD_PERMISSIONS } from '../methodPermissions'
import {
  CountSessionStatus,
  EventStatus,
  EventType,
  FractionRule,
  IncidentCategory,
  IncidentStatus,
  IncidentUrgency,
  KioskCountStatus,
  RestockRoundStatus,
  RestockRoundType,
  RouteDirection,
  SyncStatus,
} from '@/types'

const ID = '2b7c1f4e-0e4a-4a1f-9f6d-2b5c8a1d3e70'
const OTHER = '9a1d3e70-2b5c-4a1f-8f6d-0e4a2b7c1f4e'

function ok(resource: string, method: string, args: unknown[]) {
  const result = checkArguments(resource, method, args)
  expect(result.message ?? 'ok').toBe('ok')
  expect(result.ok).toBe(true)
}

function rejected(resource: string, method: string, args: unknown[]) {
  expect(checkArguments(resource, method, args).ok).toBe(false)
}

describe('argumentcontrole', () => {
  it('laat een methode zonder schema ongemoeid', () => {
    // Leesacties worden niet gevalideerd; dit is geen tweede rechtenlaag.
    ok('kiosk', 'getKiosks', ['van alles'])
  })

  it('hoort alleen regels te hebben voor methodes die bestaan', () => {
    const onbekend = Object.keys(ARGUMENT_SCHEMAS).filter((key) => !METHOD_PERMISSIONS[key])
    expect(onbekend).toEqual([])
  })
})

describe('telronde', () => {
  const session = {
    id: ID,
    userId: OTHER,
    eventId: ID,
    ringId: OTHER,
    startKioskId: ID,
    direction: RouteDirection.ASCENDING,
    kioskRoute: [ID, OTHER],
    startedAt: '2026-08-08T10:00:00.000Z',
    status: CountSessionStatus.IN_PROGRESS,
    syncStatus: SyncStatus.LOCAL,
    // De client stuurt deze mee; extra velden mogen.
    createdAt: '2026-08-08T10:00:00.000Z',
    updatedAt: '2026-08-08T10:00:00.000Z',
  }

  it('accepteert wat de app werkelijk verstuurt', () => {
    ok('count', 'createSession', [session])
  })

  it('weigert een id dat geen uuid is', () => {
    rejected('count', 'createSession', [{ ...session, id: 'sessie-1' }])
  })

  it('weigert een onbekende status', () => {
    rejected('count', 'updateSessionStatus', [ID, 'VERZONNEN'])
  })

  it('weigert een ontbrekend argument', () => {
    rejected('count', 'deleteCountEntry', [ID])
  })
})

describe('telregel', () => {
  const entry = {
    id: ID,
    kioskCountId: OTHER,
    productId: ID,
    targetQuantityQuarters: 60,
    countedQuantityQuarters: 16,
    effectiveQuantityQuarters: 16,
    restockQuantityPackages: 11,
    appliedFractionRule: FractionRule.NONE,
    lastModifiedById: OTHER,
  }

  it('accepteert een telregel', () => {
    ok('count', 'upsertCountEntry', [entry])
    ok('count', 'bulkUpsertCountEntries', [[entry]])
  })

  it('weigert een negatief aantal', () => {
    rejected('count', 'upsertCountEntry', [{ ...entry, countedQuantityQuarters: -1 }])
  })

  it('weigert een gebroken aantal kwarten', () => {
    rejected('count', 'upsertCountEntry', [{ ...entry, countedQuantityQuarters: 1.5 }])
  })
})

describe('kiosktelling', () => {
  it('accepteert een afgeronde kiosk', () => {
    ok('count', 'upsertKioskCount', [
      {
        id: ID,
        countSessionId: OTHER,
        kioskId: ID,
        counterId: OTHER,
        status: KioskCountStatus.COMPLETED,
        completedAt: '2026-08-08T11:00:00.000Z',
      },
    ])
  })

  it('weigert een onbekende status', () => {
    rejected('count', 'upsertKioskCount', [
      { id: ID, countSessionId: OTHER, kioskId: ID, counterId: OTHER, status: 'KLAARISKLAAR' },
    ])
  })
})

describe('vulronde en levering', () => {
  const round = {
    id: ID,
    eventId: OTHER,
    ringId: ID,
    name: 'Productronde Water blauw — Eerste ring',
    roundType: RestockRoundType.PRODUCT_ROUND,
    status: RestockRoundStatus.PICKING,
    createdById: OTHER,
  }

  const delivery = {
    id: ID,
    restockRoundStopId: OTHER,
    productId: ID,
    plannedPackages: 6,
    deliveredPackages: 6,
    notDeliveredPackages: 0,
    deliveredById: OTHER,
    deliveredAt: '2026-08-08T12:00:00.000Z',
    createdAt: '2026-08-08T12:00:00.000Z',
  }

  it('accepteert het reserveren van een ronde', () => {
    ok('restock', 'reserveRoundAtomic', [{ round, kioskIds: [ID], productIds: [OTHER] }])
  })

  it('accepteert een levering met behoefte', () => {
    ok('restock', 'registerDeliveryAtomic', [{ delivery, roundId: ID, requirementId: OTHER }])
  })

  it('accepteert een levering zonder behoefte', () => {
    ok('restock', 'registerDeliveryAtomic', [{ delivery, roundId: ID }])
  })

  it('weigert een negatief geleverd aantal', () => {
    rejected('restock', 'registerDeliveryAtomic', [
      { delivery: { ...delivery, deliveredPackages: -2 }, roundId: ID },
    ])
  })

  it('weigert een lege rondenaam', () => {
    rejected('restock', 'createRound', [{ ...round, name: '' }])
  })

  it('accepteert een deelupdate van een ronde', () => {
    ok('restock', 'updateRound', [ID, { status: RestockRoundStatus.CLAIMED }])
  })
})

describe('behoefte, evenement, norm en storing', () => {
  it('accepteert een bijvulbehoefte', () => {
    ok('restock', 'bulkUpsertRequirements', [
      [
        {
          eventId: ID,
          kioskId: OTHER,
          productId: ID,
          requiredPackages: 6,
          reservedPackages: 0,
          deliveredPackages: 0,
        },
      ],
    ])
  })

  it('accepteert een nieuw evenement zoals het scherm het stuurt', () => {
    ok('event', 'createEvent', [
      {
        name: 'Ajax — Feyenoord',
        date: '2026-08-12',
        eventType: EventType.VOETBAL,
        status: EventStatus.READY_FOR_COUNTING,
        activeRingIds: [ID],
        activeKioskIds: [OTHER],
        assignedUserIds: [],
        createdById: ID,
      },
    ])
  })

  it('weigert een evenement zonder naam', () => {
    rejected('event', 'createEvent', [
      {
        name: '',
        date: '2026-08-12',
        eventType: EventType.VOETBAL,
        status: EventStatus.READY_FOR_COUNTING,
        createdById: ID,
      },
    ])
  })

  it('accepteert een norm', () => {
    ok('product', 'bulkUpsertStandards', [
      [
        {
          kioskId: ID,
          productId: OTHER,
          targetQuantityQuarters: 60,
          halfPackageThresholdPercentage: 80,
          isActive: true,
        },
      ],
    ])
  })

  it('weigert een drempel buiten 0–100', () => {
    rejected('product', 'upsertStandard', [
      {
        kioskId: ID,
        productId: OTHER,
        targetQuantityQuarters: 60,
        halfPackageThresholdPercentage: 140,
        isActive: true,
      },
    ])
  })

  it('accepteert een storingsmelding', () => {
    ok('incident', 'createIncident', [
      {
        id: ID,
        eventId: OTHER,
        kioskId: ID,
        category: IncidentCategory.BIERTAP,
        description: 'Tap geeft alleen schuim',
        urgency: IncidentUrgency.HIGH,
        reportedById: OTHER,
        reportedAt: '2026-08-08T12:00:00.000Z',
        status: IncidentStatus.OPEN,
        createdAt: '2026-08-08T12:00:00.000Z',
        updatedAt: '2026-08-08T12:00:00.000Z',
      },
    ])
  })

  it('weigert een lege omschrijving', () => {
    rejected('incident', 'createIncident', [
      {
        id: ID,
        eventId: OTHER,
        kioskId: ID,
        category: IncidentCategory.BIERTAP,
        description: '',
        urgency: IncidentUrgency.HIGH,
        reportedById: OTHER,
        status: IncidentStatus.OPEN,
      },
    ])
  })
})
