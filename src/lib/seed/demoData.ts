import { assortmentForKiosk } from './assortment'
import type {
  Profile,
  Ring,
  Kiosk,
  KioskProductStandard,
  Event,
} from '@/types'
import { UserRole, EventStatus, EventType } from '@/types'

// ─── Rings ────────────────────────────────────────────────────────────────

export const RING1_ID = 'ring-eerste'
export const RING2_ID = 'ring-tweede'

export const demoRings: Ring[] = [
  {
    id: RING1_ID,
    name: 'Eerste ring',
    description: 'Kiosknummers 100-serie',
    isActive: true,
    sortOrder: 1,
    // Tellen begint bij de lift; vullen komt er met een pallet anders in.
    countStartKioskId: 'kiosk-127',
    restockStartKioskId: 'kiosk-122',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: RING2_ID,
    name: 'Tweede ring',
    description: 'Kiosknummers 400-serie',
    isActive: true,
    sortOrder: 2,
    // Tellen begint bij de lift; vullen komt er met een pallet anders in.
    countStartKioskId: 'kiosk-429',
    restockStartKioskId: 'kiosk-423',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
]

// ─── Kiosks ───────────────────────────────────────────────────────────────

function makeKiosks(ringId: string, start: number, count: number): Kiosk[] {
  return Array.from({ length: count }, (_, i) => {
    const number = start + i
    return {
      id: `kiosk-${number}`,
      ringId,
      number,
      name: `Kiosk ${number}`,
      sortOrder: i + 1,
      isActive: true,
      location: undefined,
      notes: undefined,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    }
  })
}

export const demoKiosks: Kiosk[] = [
  ...makeKiosks(RING1_ID, 101, 28), // 101–128
  ...makeKiosks(RING2_ID, 401, 29), // 401–429, daarna wrapt de ring naar 401
]

// ─── Users / Profiles ────────────────────────────────────────────────────

export const DEMO_ADMIN_ID = 'user-admin'
export const DEMO_PLANNER_ID = 'user-planner'
export const DEMO_TELLER1_ID = 'user-teller1'
export const DEMO_TELLER2_ID = 'user-teller2'
export const DEMO_VULLER1_ID = 'user-vuller1'
export const DEMO_VULLER2_ID = 'user-vuller2'

export const demoProfiles: Profile[] = [
  {
    id: DEMO_ADMIN_ID,
    email: 'admin@demo.nl',
    displayName: 'Admin Gebruiker',
    roles: [UserRole.ADMIN],
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: DEMO_PLANNER_ID,
    email: 'planner@demo.nl',
    displayName: 'Planner Anna',
    roles: [UserRole.PLANNER],
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: DEMO_TELLER1_ID,
    email: 'teller1@demo.nl',
    displayName: 'Teller Jan',
    roles: [UserRole.TELLER],
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: DEMO_TELLER2_ID,
    email: 'teller2@demo.nl',
    displayName: 'Teller Sara',
    roles: [UserRole.TELLER],
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: DEMO_VULLER1_ID,
    email: 'vuller1@demo.nl',
    displayName: 'Vuller Marco',
    roles: [UserRole.VULLER],
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: DEMO_VULLER2_ID,
    email: 'vuller2@demo.nl',
    displayName: 'Vuller Lisa',
    roles: [UserRole.VULLER],
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
]

export const DEMO_PASSWORDS: Record<string, string> = {
  'admin@demo.nl': 'demo1234',
  'planner@demo.nl': 'demo1234',
  'teller1@demo.nl': 'demo1234',
  'teller2@demo.nl': 'demo1234',
  'vuller1@demo.nl': 'demo1234',
  'vuller2@demo.nl': 'demo1234',
}

// ─── Catalogus ────────────────────────────────────────────────────────────
// Producten en categorieën staan in catalogue.ts; hier alleen doorgegeven,
// zodat bestaande imports blijven werken.

export {
  demoCategories,
  demoProducts,
  CAT_BIERBEKERS_ID,
  CAT_DRANK_ID,
  CAT_CHIPS_ID,
  CAT_POSTMIX_ID,
  CAT_SNOEP_ID,
  CAT_KOFFIE_ID,
  CAT_VERPAKKINGEN_ID,
  CAT_SAUZEN_ID,
  CAT_SCHOONMAAK_ID,
} from './catalogue'

// ─── Voorraadnormen ───────────────────────────────────────────────────────

function standard(
  kioskId: string,
  productId: string,
  targetPackages: number
): KioskProductStandard {
  return {
    id: `std-${kioskId}-${productId}`,
    kioskId,
    productId,
    targetQuantityQuarters: targetPackages * 4,
    halfPackageThresholdPercentage: 80,
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  }
}

/**
 * Welke producten een kiosk voert en hoeveel ervan, staat in assortment.ts —
 * dicht bij de regels die eruit voortkomen (koeling, patat, hotdog, snoep).
 */
export const demoStandards: KioskProductStandard[] = demoKiosks.flatMap((kiosk) =>
  assortmentForKiosk(kiosk.number).map((item) => standard(kiosk.id, item.productId, item.target))
)

// ─── Demo event ───────────────────────────────────────────────────────────

export const DEMO_EVENT_ID = 'event-demo-ajax'

export const demoEvent: Event = {
  id: DEMO_EVENT_ID,
  name: 'Ajax – Demo FC',
  date: '2026-09-15',
  eventType: EventType.VOETBAL,
  status: EventStatus.READY_FOR_COUNTING,
  expectedAttendees: 55000,
  notes: 'Demo evenement voor testdoeleinden',
  activeRingIds: [RING1_ID, RING2_ID],
  activeKioskIds: demoKiosks.map((k) => k.id),
  assignedUserIds: [DEMO_TELLER1_ID, DEMO_TELLER2_ID, DEMO_VULLER1_ID, DEMO_VULLER2_ID],
  createdById: DEMO_ADMIN_ID,
  createdAt: '2026-08-01T09:00:00Z',
  updatedAt: '2026-08-01T09:00:00Z',
}
