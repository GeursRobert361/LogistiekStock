import type {
  Profile,
  Ring,
  Kiosk,
  ProductCategory,
  Product,
  KioskProductStandard,
  Event,
} from '@/types'
import {
  UserRole,
  EventStatus,
  EventType,
  RoundType,
  ProductSize,
  InputStep,
} from '@/types'

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
  ...makeKiosks(RING2_ID, 401, 28), // 401–428
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

// ─── Product categories ───────────────────────────────────────────────────

export const CAT_BIERBEKERS_ID = 'cat-bierbekers'
export const CAT_DRANK_ID = 'cat-drank'
export const CAT_CHIPS_ID = 'cat-chips'
export const CAT_POSTMIX_ID = 'cat-postmix'
export const CAT_KOFFIE_ID = 'cat-koffie'
export const CAT_VERPAKKINGEN_ID = 'cat-verpakkingen'
export const CAT_SAUZEN_ID = 'cat-sauzen'
export const CAT_SCHOONMAAK_ID = 'cat-schoonmaak'
export const CAT_OVERIG_ID = 'cat-overig'

export const demoCategories: ProductCategory[] = [
  { id: CAT_BIERBEKERS_ID, name: 'Bierbekers', sortOrder: 1, isActive: true },
  { id: CAT_DRANK_ID, name: 'Drank', sortOrder: 2, isActive: true },
  { id: CAT_CHIPS_ID, name: 'Chips', sortOrder: 3, isActive: true },
  { id: CAT_POSTMIX_ID, name: 'Post-mix', sortOrder: 4, isActive: true },
  { id: CAT_KOFFIE_ID, name: 'Koffie en thee', sortOrder: 5, isActive: true },
  { id: CAT_VERPAKKINGEN_ID, name: 'Verpakkingen', sortOrder: 6, isActive: true },
  { id: CAT_SAUZEN_ID, name: 'Sauzen', sortOrder: 7, isActive: true },
  { id: CAT_SCHOONMAAK_ID, name: 'Schoonmaak', sortOrder: 8, isActive: true },
  { id: CAT_OVERIG_ID, name: 'Overig', sortOrder: 9, isActive: true },
]

// ─── Products ────────────────────────────────────────────────────────────

function product(
  id: string,
  categoryId: string,
  name: string,
  shortName: string,
  countUnit: string,
  packagingUnit: string,
  sortOrder: number,
  overrides: Partial<Product> = {}
): Product {
  return {
    id,
    categoryId,
    name,
    shortName,
    countUnit,
    packagingUnit,
    sortOrder,
    isActive: true,
    inputStep: InputStep.ONE,
    allowPartialPackage: false,
    roundType: RoundType.AUTO,
    productSize: ProductSize.MEDIUM,
    estimatedPalletLoad: 1,
    ownRoundThreshold: 20,
    priority: 0,
    refrigerated: false,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

export const demoProducts: Product[] = [
  // Bierbekers
  product('prod-bierbeker-05', CAT_BIERBEKERS_ID, 'Bierbeker 0,5 liter', 'Bierbeker 0,5L', 'rol', 'rollen', 1, {
    productSize: ProductSize.LARGE, ownRoundThreshold: 15, roundType: RoundType.PRODUCT_ROUND,
  }),
  product('prod-bierbeker-04', CAT_BIERBEKERS_ID, 'Bierbeker 0,4 liter', 'Bierbeker 0,4L', 'rol', 'rollen', 2, {
    productSize: ProductSize.LARGE, ownRoundThreshold: 15, roundType: RoundType.PRODUCT_ROUND,
  }),
  product('prod-bierbeker-03', CAT_BIERBEKERS_ID, 'Bierbeker 0,3 liter', 'Bierbeker 0,3L', 'rol', 'rollen', 3, {
    productSize: ProductSize.MEDIUM, ownRoundThreshold: 15,
  }),
  // Drank
  product('prod-water-blauw', CAT_DRANK_ID, 'Water blauw', 'Water blauw', 'pak', 'pakken', 4, {
    productSize: ProductSize.LARGE, ownRoundThreshold: 30, roundType: RoundType.PRODUCT_ROUND, inputStep: InputStep.HALF,
  }),
  product('prod-water-rood', CAT_DRANK_ID, 'Water rood', 'Water rood', 'pak', 'pakken', 5, {
    productSize: ProductSize.LARGE, ownRoundThreshold: 20, roundType: RoundType.PRODUCT_ROUND, inputStep: InputStep.HALF,
  }),
  product('prod-fuze-tea', CAT_DRANK_ID, 'Fuze Tea', 'Fuze Tea', 'pak', 'pakken', 6, {
    productSize: ProductSize.MEDIUM, inputStep: InputStep.HALF,
  }),
  product('prod-heineken-00', CAT_DRANK_ID, 'Heineken 0.0', 'Heineken 0.0', 'pak', 'pakken', 7, {
    refrigerated: true, inputStep: InputStep.HALF,
  }),
  product('prod-radler', CAT_DRANK_ID, 'Radler', 'Radler', 'pak', 'pakken', 8, {
    refrigerated: true, inputStep: InputStep.HALF,
  }),
  product('prod-bacardi-lemon', CAT_DRANK_ID, 'Bacardi Lemon', 'Bac. Lemon', 'fles', 'dozen', 9, {
    productSize: ProductSize.SMALL,
  }),
  product('prod-stelz-ice-tea', CAT_DRANK_ID, 'Stelz Ice Tea', 'Stelz', 'pak', 'pakken', 10, {
    inputStep: InputStep.HALF,
  }),
  product('prod-jack-daniels', CAT_DRANK_ID, "Jack Daniel's", "Jack D.", 'fles', 'dozen', 11, {
    productSize: ProductSize.SMALL,
  }),
  product('prod-red-bull', CAT_DRANK_ID, 'Red Bull', 'Red Bull', 'blikje', 'trays', 12, {
    productSize: ProductSize.SMALL, roundType: RoundType.MIXED_PALLET,
  }),
  product('prod-bacardi-cola', CAT_DRANK_ID, 'Bacardi Cola', 'Bac. Cola', 'blikje', 'trays', 13, {
    productSize: ProductSize.SMALL, roundType: RoundType.MIXED_PALLET,
  }),
  // Chips
  product('prod-chips-blauw', CAT_CHIPS_ID, 'Chips blauw', 'Chips blauw', 'zak', 'dozen', 14, {
    productSize: ProductSize.SMALL, roundType: RoundType.MIXED_PALLET,
  }),
  product('prod-chips-rood', CAT_CHIPS_ID, 'Chips rood', 'Chips rood', 'zak', 'dozen', 15, {
    productSize: ProductSize.SMALL, roundType: RoundType.MIXED_PALLET,
  }),
  product('prod-chips-oranje', CAT_CHIPS_ID, 'Chips oranje', 'Chips oranje', 'zak', 'dozen', 16, {
    productSize: ProductSize.SMALL, roundType: RoundType.MIXED_PALLET,
  }),
  // Koffie
  product('prod-koffiebekers', CAT_KOFFIE_ID, 'Koffiebekers', 'Koffiebekers', 'sleeve', 'dozen', 17, {
    productSize: ProductSize.SMALL, roundType: RoundType.MIXED_PALLET,
  }),
  // Verpakkingen
  product('prod-servetten', CAT_VERPAKKINGEN_ID, 'Servetten', 'Servetten', 'pak', 'pakken', 18, {
    productSize: ProductSize.SMALL, roundType: RoundType.MIXED_PALLET,
  }),
  product('prod-patatbakjes', CAT_VERPAKKINGEN_ID, 'Patatbakjes', 'Patatbakjes', 'pak', 'pakken', 19, {
    productSize: ProductSize.SMALL, roundType: RoundType.MIXED_PALLET,
  }),
  product('prod-snackbakjes', CAT_VERPAKKINGEN_ID, 'Snackbakjes', 'Snackbakjes', 'pak', 'pakken', 20, {
    productSize: ProductSize.SMALL, roundType: RoundType.MIXED_PALLET,
  }),
  product('prod-biertrays', CAT_VERPAKKINGEN_ID, 'Biertrays', 'Biertrays', 'pak', 'pakken', 21, {
    productSize: ProductSize.MEDIUM, roundType: RoundType.AUTO,
  }),
  product('prod-torkrollen', CAT_SCHOONMAAK_ID, 'Torkrollen', 'Torkrollen', 'rol', 'rollen', 22, {
    productSize: ProductSize.SMALL, roundType: RoundType.MIXED_PALLET,
  }),
  product('prod-vuilniszakken', CAT_SCHOONMAAK_ID, 'Vuilniszakken', 'Vuilniszakken', 'rol', 'rollen', 23, {
    productSize: ProductSize.SMALL, roundType: RoundType.MIXED_PALLET,
  }),
  // Overig
  product('prod-kassabonnen', CAT_OVERIG_ID, 'Kassabonnen', 'Kassabonnen', 'rol', 'rollen', 24, {
    productSize: ProductSize.SMALL, roundType: RoundType.MIXED_PALLET,
  }),
  // Sauzen
  product('prod-mayonaise', CAT_SAUZEN_ID, 'Mayonaise', 'Mayo', 'fles', 'dozen', 25, {
    productSize: ProductSize.SMALL, roundType: RoundType.MIXED_PALLET,
  }),
  product('prod-ketchup', CAT_SAUZEN_ID, 'Ketchup', 'Ketchup', 'fles', 'dozen', 26, {
    productSize: ProductSize.SMALL, roundType: RoundType.MIXED_PALLET,
  }),
]

// ─── Standards (voorraadnormen) ───────────────────────────────────────────
// Normen voor kiosken 101-110 als voorbeeld

function standard(
  kioskId: string,
  productId: string,
  targetPackages: number,
  overrides: Partial<KioskProductStandard> = {}
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
    ...overrides,
  }
}

/**
 * Iedere kiosk krijgt een basisassortiment. Even kiosknummers krijgen daarnaast
 * een aantal kleinere producten, zodat gemengde pallets in de vulplanning
 * realistisch zijn. Normen zijn altijd hele verpakkingen.
 */
export const demoStandards: KioskProductStandard[] = demoKiosks.flatMap((kiosk) => {
  const num = kiosk.number
  const variation = num % 3 // 0, 1 of 2 — zorgt voor verschillen tussen kiosken

  const base: KioskProductStandard[] = [
    standard(kiosk.id, 'prod-bierbeker-05', 15),
    standard(kiosk.id, 'prod-bierbeker-04', 10),
    standard(kiosk.id, 'prod-water-blauw', 12 + variation),
    standard(kiosk.id, 'prod-water-rood', 8),
    standard(kiosk.id, 'prod-chips-blauw', 6),
    standard(kiosk.id, 'prod-chips-rood', 6),
    standard(kiosk.id, 'prod-servetten', 4),
    standard(kiosk.id, 'prod-patatbakjes', 3 + variation),
    standard(kiosk.id, 'prod-torkrollen', 2),
    standard(kiosk.id, 'prod-vuilniszakken', 2),
  ]

  if (num % 2 !== 0) return base

  return [
    ...base,
    standard(kiosk.id, 'prod-red-bull', 4),
    standard(kiosk.id, 'prod-bacardi-cola', 3),
    standard(kiosk.id, 'prod-koffiebekers', 2),
    standard(kiosk.id, 'prod-snackbakjes', 3),
    standard(kiosk.id, 'prod-biertrays', 5),
  ]
})

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
