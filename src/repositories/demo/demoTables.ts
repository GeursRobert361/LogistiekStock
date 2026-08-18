import { DemoTable } from '@/lib/demo/demoStore'
import {
  demoRings,
  demoKiosks,
  demoCategories,
  demoProducts,
  demoStandards,
  demoStorageNotes,
  demoEvent,
  demoAgenda,
  demoProfiles,
  DEMO_PASSWORDS,
} from '@/lib/seed/demoData'
import type {
  AgendaEntry,
  Ring,
  Kiosk,
  ProductCategory,
  Product,
  KioskProductStandard,
  KioskStorageNote,
  Event,
  CountSession,
  KioskCount,
  CountEntry,
  RestockRequirement,
  RestockRound,
  RestockRoundItem,
  RestockRoundStop,
  RestockStopItem,
  RestockDelivery,
  StockReservation,
  Incident,
  Profile,
} from '@/types'

/**
 * Wachtwoorden in demo-modus staan als leesbare tekst in de browser. Dat mag:
 * demo-data is openbaar en er staat niets echts in. In productie gaat dit via
 * bcrypt op de server, waar de browser er niet bij kan.
 */
interface DemoPassword {
  /** Het e-mailadres; DemoTable werkt op een veld dat `id` heet. */
  id: string
  password: string
}

/**
 * Alle demo-tabellen op één plek, zodat repositories dezelfde data delen
 * (bijvoorbeeld: de kiosk-repository leest de open-kiosken van het evenement).
 */
export const demoTables = {
  rings: new DemoTable<Ring>('rings', () => [...demoRings]),
  kiosks: new DemoTable<Kiosk>('kiosks', () => [...demoKiosks]),
  categories: new DemoTable<ProductCategory>('categories', () => [...demoCategories]),
  products: new DemoTable<Product>('products', () => [...demoProducts]),
  standards: new DemoTable<KioskProductStandard>('standards', () => [...demoStandards]),
  storageNotes: new DemoTable<KioskStorageNote>('storageNotes', () => [...demoStorageNotes]),
  events: new DemoTable<Event>('events', () => [demoEvent]),
  agenda: new DemoTable<AgendaEntry>('agenda', () => [...demoAgenda]),
  countSessions: new DemoTable<CountSession>('countSessions', () => []),
  kioskCounts: new DemoTable<KioskCount>('kioskCounts', () => []),
  countEntries: new DemoTable<CountEntry>('countEntries', () => []),
  restockRequirements: new DemoTable<RestockRequirement>('restockRequirements', () => []),
  restockRounds: new DemoTable<RestockRound>('restockRounds', () => []),
  restockRoundItems: new DemoTable<RestockRoundItem>('restockRoundItems', () => []),
  restockRoundStops: new DemoTable<RestockRoundStop>('restockRoundStops', () => []),
  restockStopItems: new DemoTable<RestockStopItem>('restockStopItems', () => []),
  restockDeliveries: new DemoTable<RestockDelivery>('restockDeliveries', () => []),
  stockReservations: new DemoTable<StockReservation>('stockReservations', () => []),
  incidents: new DemoTable<Incident>('incidents', () => []),
  profiles: new DemoTable<Profile>('profiles', () => [...demoProfiles]),
  passwords: new DemoTable<DemoPassword>('passwords', () =>
    Object.entries(DEMO_PASSWORDS).map(([email, password]) => ({ id: email, password }))
  ),
} as const

/** Zet alle demo-data terug naar de seed. */
export function resetDemoTables(): void {
  for (const table of Object.values(demoTables)) {
    table.reset()
  }
}
