import { assortmentForKiosk } from './assortment'
import { secondRingStandards, authoritativeKioskKeys } from './secondRingStandards'
import type {
  AgendaEntry,
  Profile,
  Ring,
  Kiosk,
  KioskProductStandard,
  Event,
} from '@/types'
import { UserRole, EventStatus, EventType, DrinkStorageType } from '@/types'

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
      // Stappen van 10: dan past er een telpunt tussen twee kiosken in,
      // zoals de cubes tegenover 120.
      sortOrder: (i + 1) * 10,
      isActive: true,
      location: undefined,
      notes: undefined,
      // Wordt hierna gezet vanuit de tweede-ringconfig. NONE is de veilige
      // uitgangswaarde: wie niets weet van een telpunt gaat er niet vanuit dat
      // er een koeling staat.
      drinkStorageType: DrinkStorageType.NONE,
      keepsOwnDrinkStock: false,
      drinkSourceKioskId: null,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    }
  })
}

/**
 * De cubes: drie hokjes tegenover kiosk 120 met hotdogs, kroketten en
 * kipburgers. Fysiek een eigen stop, dus een eigen telpunt — met een eigen
 * naam, want "1201" zegt niemand iets.
 */
const cubes120: Kiosk = {
  id: 'kiosk-120-cubes',
  ringId: RING1_ID,
  number: 1201,
  label: '120 Cubes',
  name: 'Cubes tegenover kiosk 120',
  location: 'Tegenover kiosk 120',
  sortOrder: 205, // direct na 120 (200), vóór 121 (210)
  isActive: true,
  drinkStorageType: DrinkStorageType.NONE,
  keepsOwnDrinkStock: false,
  drinkSourceKioskId: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}

/**
 * De extra bar bij kiosk 420: een eigen tappunt met een post-mixinstallatie,
 * dat los van de kiosk zelf geteld en gevuld wordt.
 */
const bar420: Kiosk = {
  id: 'kiosk-420-bar',
  ringId: RING2_ID,
  number: 4201,
  label: '420 Bar',
  name: 'Bar naast kiosk 420',
  location: 'Naast kiosk 420',
  sortOrder: 205, // direct na 420 (200), vóór 421 (210)
  isActive: true,
  drinkStorageType: DrinkStorageType.NONE,
  keepsOwnDrinkStock: false,
  drinkSourceKioskId: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}

/**
 * Naast kiosk 406 staat een tweede telpunt met een eigen assortiment.
 *
 * Twee losse locaties, geen twee namen voor hetzelfde: ze worden apart geteld
 * en apart gevuld. De database staat maar één keer nummer 406 per ring toe, dus
 * de nieuwe krijgt intern 4061 — hetzelfde patroon als "120 Cubes" (1201) en
 * "420 Bar" (4201). Op het scherm zie je altijd het opschrift.
 *
 * De bestaande kiosk 406 wordt "406 Oud"; die rij blijft dus staan, met alles
 * wat eraan hangt.
 */
const kiosk406Nieuw: Kiosk = {
  id: 'kiosk-406-nieuw',
  ringId: RING2_ID,
  number: 4061,
  label: '406 Nieuw',
  name: 'Kiosk 406 nieuw',
  location: 'Naast kiosk 406',
  sortOrder: 65, // tussen 406 (60) en 407 (70)
  isActive: true,
  drinkStorageType: DrinkStorageType.NONE,
  keepsOwnDrinkStock: false,
  drinkSourceKioskId: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}

/**
 * Het Ziggo Platform: een eigen verkooppunt met een korte lijst.
 *
 * De ligging is inmiddels bevestigd: wie 420 heeft geteld loopt hierlangs en
 * komt daarna pas bij 420 Bar. Stond eerder achteraan omdat de plek in de route
 * nog niet vaststond.
 */
const ziggoPlatform: Kiosk = {
  id: 'kiosk-ziggo-platform',
  ringId: RING2_ID,
  number: 4300,
  label: 'Ziggo Platform',
  name: 'Ziggo Platform',
  sortOrder: 204, // tussen 420 (200) en 420 Bar (205)
  isActive: true,
  drinkStorageType: DrinkStorageType.NONE,
  keepsOwnDrinkStock: false,
  drinkSourceKioskId: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}

/** Het opslagtype komt uit de tweede-ringconfig; de rest blijft NONE. */
const storageByKioskKey = new Map(
  secondRingStandards.map((config) => [config.kioskKey, config.drinkStorageType])
)

/**
 * Telpunten met een eigen drankvoorraad ondanks hun opslagtype.
 *
 * Komt uit dezelfde config, zodat de uitzondering op één plek staat en niet
 * hier nog eens overgetypt wordt.
 */
const localDrinkStockByKioskKey = new Map(
  secondRingStandards.map((config) => [config.kioskKey, config.keepsOwnDrinkStock === true])
)

export const demoKiosks: Kiosk[] = [
  ...makeKiosks(RING1_ID, 101, 28), // 101–128
  cubes120,
  ...makeKiosks(RING2_ID, 401, 29), // 401–429, daarna wrapt de ring naar 401
  bar420,
  kiosk406Nieuw,
  ziggoPlatform,
]
  .map((kiosk) => ({
    ...kiosk,
    drinkStorageType: storageByKioskKey.get(kiosk.id) ?? kiosk.drinkStorageType,
    keepsOwnDrinkStock: localDrinkStockByKioskKey.get(kiosk.id) ?? kiosk.keepsOwnDrinkStock,
    // Op de vloer heet dit "406 Oud" sinds er een tweede bijstaat.
    label: kiosk.id === 'kiosk-406' ? '406 Oud' : kiosk.label,
  }))
  .sort((a, b) => a.sortOrder - b.sortOrder)

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
 * De voorraadnormen.
 *
 * Twee bronnen, en de volgorde is niet willekeurig. Voor de locaties waarvoor
 * echte papieren lijsten zijn aangeleverd geldt `secondRingStandards`: dat is
 * stamdata, overgenomen van de vloer. Al het andere valt terug op
 * `assortmentForKiosk`, dat normen afleidt uit regels op het kiosknummer —
 * een benadering, goed genoeg zolang er geen echte lijst is.
 *
 * Wat níet in de config staat krijgt dus geen norm bij die kiosk. Een leeg vak
 * op de lijst betekent "geen actieve norm", niet "norm 0".
 */
const standardsByKioskKey = new Map(
  secondRingStandards.map((config) => [config.kioskKey, config.standards])
)

export const demoStandards: KioskProductStandard[] = demoKiosks.flatMap((kiosk) => {
  const explicit = standardsByKioskKey.get(kiosk.id)
  if (explicit) {
    return Object.entries(explicit).map(([productId, target]) =>
      standard(kiosk.id, productId, target)
    )
  }
  return assortmentForKiosk(kiosk.number).map((item) =>
    standard(kiosk.id, item.productId, item.target)
  )
})

/**
 * Locaties waarvoor echte normdata is aangeleverd.
 *
 * De rest draait nog op afgeleide demo-normen. Dat onderscheid moet zichtbaar
 * blijven: anders is over een maand niet meer te zien welke lijst je kunt
 * vertrouwen.
 */
export const kiosksWithRealStandards: ReadonlySet<string> = authoritativeKioskKeys

// ─── Demo event ───────────────────────────────────────────────────────────

export const DEMO_EVENT_ID = 'event-demo-ajax'

export const demoEvent: Event = {
  id: DEMO_EVENT_ID,
  name: 'Ajax – Demo FC',
  date: '2026-09-15',
  eventType: EventType.VOETBAL,
  status: EventStatus.READY_FOR_COUNTING,
  notes: 'Demo evenement voor testdoeleinden',
  activeRingIds: [RING1_ID, RING2_ID],
  activeKioskIds: demoKiosks.map((k) => k.id),
  assignedUserIds: [DEMO_TELLER1_ID, DEMO_TELLER2_ID, DEMO_VULLER1_ID, DEMO_VULLER2_ID],
  createdById: DEMO_ADMIN_ID,
  createdAt: '2026-08-01T09:00:00Z',
  updatedAt: '2026-08-01T09:00:00Z',
}

/**
 * De evenementenagenda: wat er op de kalender staat. Hieruit wordt gekozen bij
 * het aanmaken van een evenement, zodat naam en datum niet elke keer met de
 * hand overgetypt hoeven te worden.
 */
function agenda(id: string, name: string, date: string, eventType: EventType): AgendaEntry {
  return {
    id: `agenda-${id}`,
    name,
    date,
    eventType,
    createdAt: '2026-08-01T09:00:00Z',
    updatedAt: '2026-08-01T09:00:00Z',
  }
}

export const demoAgenda: AgendaEntry[] = [
  agenda('psv', 'Ajax – PSV', '2026-08-30', EventType.VOETBAL),
  agenda('demo-fc', 'Ajax – Demo FC', '2026-09-15', EventType.VOETBAL),
  agenda('feyenoord', 'Ajax – Feyenoord', '2026-09-27', EventType.VOETBAL),
  agenda('concert', 'Concert – Zomeravond', '2026-10-04', EventType.CONCERT),
  agenda('twente', 'Ajax – FC Twente', '2026-10-18', EventType.VOETBAL),
]
