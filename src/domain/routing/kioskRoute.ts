import { RouteDirection } from '@/types/enums'
import type { GenerateCircularKioskRouteInput } from '@/types/domain'

export interface RouteKiosk {
  id: string
  sortOrder: number
  isActive: boolean
  isOpenForEvent?: boolean
}

/**
 * Generates a circular kiosk route starting from `startKioskId`.
 *
 * Only active kiosks that are open for the event are included.
 * The route is circular: after the last kiosk it wraps back to the first.
 *
 * Ascending:  increasing sortOrder, wrapping from max back to min
 *             — bijvoorbeeld 120 → 121 → 122
 * Descending: decreasing sortOrder, wrapping from min back to max
 *             — bijvoorbeeld 122 → 121 → 120
 *
 * Bewust niet "linksom" en "rechtsom": of oplopend tellen linksom of rechtsom
 * uitpakt hangt af van hoe de ring genummerd en gebouwd is, en daar legt niets
 * in de configuratie iets over vast.
 *
 * Returns an empty array when no eligible kiosks exist.
 * Returns all eligible kiosks (starting from index 0) when startKioskId
 * is not found among eligible kiosks.
 */
export function generateCircularKioskRoute(
  input: GenerateCircularKioskRouteInput
): RouteKiosk[] {
  const { kiosks, startKioskId, direction } = input

  // Filter to eligible kiosks: active AND open for this event (if specified)
  const eligible = kiosks.filter(
    (k) => k.isActive && (k.isOpenForEvent === undefined || k.isOpenForEvent)
  )

  if (eligible.length === 0) return []

  // Sort by sortOrder ascending — this is the canonical order for the ring
  const sorted = [...eligible].sort((a, b) => a.sortOrder - b.sortOrder)

  const startIndex = sorted.findIndex((k) => k.id === startKioskId)
  // If start kiosk not found (inactive or not in ring), begin from first
  const from = startIndex === -1 ? 0 : startIndex

  if (direction === RouteDirection.ASCENDING) {
    return [...sorted.slice(from), ...sorted.slice(0, from)]
  }

  // Descending: walk backwards through the sorted list, wrapping from min to max
  // Example sorted=[101..128], from=22 (kiosk 123):
  //   left  = sorted[0..22].reverse()  → [123,122,...,101]
  //   right = sorted[23..].reverse()   → [128,127,...,124]
  //   result: [123,122,...,101,128,127,...,124]
  const left = sorted.slice(0, from + 1).reverse()
  const right = sorted.slice(from + 1).reverse()
  return [...left, ...right]
}

/**
 * Returns the next kiosk ID in the route after `currentKioskId`.
 * Returns undefined when the route is empty or current is the last stop.
 */
export function getNextKioskInRoute(
  route: RouteKiosk[],
  currentKioskId: string
): RouteKiosk | undefined {
  const idx = route.findIndex((k) => k.id === currentKioskId)
  if (idx === -1 || idx === route.length - 1) return undefined
  return route[idx + 1]
}

/**
 * Returns the previous kiosk ID in the route before `currentKioskId`.
 * Returns undefined when the route is empty or current is the first stop.
 */
export function getPreviousKioskInRoute(
  route: RouteKiosk[],
  currentKioskId: string
): RouteKiosk | undefined {
  const idx = route.findIndex((k) => k.id === currentKioskId)
  if (idx <= 0) return undefined
  return route[idx - 1]
}
