import { KioskCountStatus } from '@/types/enums'
import type { KioskCount, CountEntry } from '@/types/domain'

export interface ProductRestockTotal {
  productId: string
  /** Totaal aantal bij te vullen verpakkingen over alle kiosken. */
  totalPackages: number
  /** Kiosken met een tekort, gesorteerd op kiosk-id. */
  perKiosk: Array<{ kioskId: string; packages: number }>
}

/**
 * Telt bijvulbehoeften per product op over alle getelde kiosken.
 *
 * Alleen afgeronde kiosktellingen tellen mee: bij een overgeslagen of nog
 * lopende kiosk is niet bekend wat er staat, dus daar valt niets te bestellen.
 */
export function aggregateRestockTotals(
  kioskCounts: KioskCount[],
  entriesByKioskCount: Map<string, CountEntry[]>
): ProductRestockTotal[] {
  const perProduct = new Map<string, Map<string, number>>()

  for (const kioskCount of kioskCounts) {
    if (kioskCount.status !== KioskCountStatus.COMPLETED) continue

    for (const entry of entriesByKioskCount.get(kioskCount.id) ?? []) {
      if (entry.restockQuantityPackages <= 0) continue

      let byKiosk = perProduct.get(entry.productId)
      if (!byKiosk) {
        byKiosk = new Map()
        perProduct.set(entry.productId, byKiosk)
      }
      // Bij twee tellingen van dezelfde kiosk telt de laatste, niet de som.
      byKiosk.set(kioskCount.kioskId, entry.restockQuantityPackages)
    }
  }

  const totals: ProductRestockTotal[] = []
  for (const [productId, byKiosk] of perProduct) {
    const perKiosk = [...byKiosk.entries()]
      .map(([kioskId, packages]) => ({ kioskId, packages }))
      .sort((a, b) => a.kioskId.localeCompare(b.kioskId))

    totals.push({
      productId,
      totalPackages: perKiosk.reduce((sum, k) => sum + k.packages, 0),
      perKiosk,
    })
  }

  return totals.sort((a, b) => b.totalPackages - a.totalPackages)
}
