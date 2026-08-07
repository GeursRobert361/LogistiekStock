import { RouteDirection } from '@/types/enums'
import { generateCircularKioskRoute, type RouteKiosk } from '@/domain/routing/kioskRoute'

export interface PlannedStopItem {
  productId: string
  plannedPackages: number
}

export interface PlannedStop {
  kioskId: string
  sortOrder: number
  items: PlannedStopItem[]
}

export interface PlanRoundStopsInput {
  /** Kiosken van de ring, in ringvolgorde. */
  ringKiosks: RouteKiosk[]
  /** Openstaande behoefte: kioskId → productId → verpakkingen. */
  demandByKiosk: Map<string, Map<string, number>>
  /** Wat er daadwerkelijk op de pallet ligt: productId → verpakkingen. */
  loadedByProduct: Map<string, number>
  /** Startkiosk; standaard de eerste kiosk in de route met vraag. */
  startKioskId?: string
  direction?: RouteDirection
}

/**
 * Verdeelt de geladen voorraad over de kiosken van een ring.
 *
 * De route volgt dezelfde circulaire ringvolgorde als het tellen. Kiosken
 * zonder vraag komen niet in de route: daar valt niets af te leveren.
 *
 * Is er minder geladen dan nodig, dan krijgen de eerste kiosken op de route
 * hun volledige aantal en houdt het daarna op — beter volle kiosken dan overal
 * een restje. Er wordt nooit meer verdeeld dan er geladen is.
 */
export function planRoundStops(input: PlanRoundStopsInput): PlannedStop[] {
  const {
    ringKiosks,
    demandByKiosk,
    loadedByProduct,
    startKioskId,
    direction = RouteDirection.ASCENDING,
  } = input

  const sorted = [...ringKiosks].sort((a, b) => a.sortOrder - b.sortOrder)
  const firstWithDemand = sorted.find((kiosk) => {
    const demand = demandByKiosk.get(kiosk.id)
    return demand !== undefined && demand.size > 0
  })
  if (!firstWithDemand) return []

  const route = generateCircularKioskRoute({
    kiosks: sorted,
    startKioskId: startKioskId ?? firstWithDemand.id,
    direction,
  })

  const remaining = new Map(loadedByProduct)
  const stops: PlannedStop[] = []

  for (const kiosk of route) {
    const demand = demandByKiosk.get(kiosk.id)
    if (!demand || demand.size === 0) continue

    const items: PlannedStopItem[] = []
    for (const [productId, needed] of demand) {
      const available = remaining.get(productId) ?? 0
      if (available <= 0 || needed <= 0) continue

      const planned = Math.min(needed, available)
      items.push({ productId, plannedPackages: planned })
      remaining.set(productId, available - planned)
    }

    if (items.length === 0) continue

    items.sort((a, b) => a.productId.localeCompare(b.productId))
    stops.push({ kioskId: kiosk.id, sortOrder: stops.length, items })
  }

  return stops
}

/** Totaal aantal verpakkingen dat in een plan wordt uitgezet, per product. */
export function totalPlannedByProduct(stops: PlannedStop[]): Map<string, number> {
  const totals = new Map<string, number>()
  for (const stop of stops) {
    for (const item of stop.items) {
      totals.set(item.productId, (totals.get(item.productId) ?? 0) + item.plannedPackages)
    }
  }
  return totals
}
