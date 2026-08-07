import { DemoTable } from '@/lib/demo/demoStore'
import {
  demoRings,
  demoKiosks,
  demoCategories,
  demoProducts,
  demoStandards,
  demoEvent,
  demoAgenda,
} from '@/lib/seed/demoData'
import type {
  AgendaEntry,
  Ring,
  Kiosk,
  ProductCategory,
  Product,
  KioskProductStandard,
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
} from '@/types'

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
} as const

/** Zet alle demo-data terug naar de seed. */
export function resetDemoTables(): void {
  for (const table of Object.values(demoTables)) {
    table.reset()
  }
}
