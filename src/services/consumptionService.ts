import { repositories } from '@/repositories'
import { buildConsumptionRows, key, type ConsumptionRow } from '@/domain/analytics/consumption'
import { CountSessionStatus } from '@/types'
import type { Event } from '@/types'

/**
 * Verbruik per evenement: wat er tijdens een wedstrijd doorheen is gegaan.
 *
 * Er wordt alleen vóór een evenement geteld. Het verbruik van evenement A is
 * dus pas bekend als er voor evenement B geteld is — B is het evenement dat A
 * als voorganger heeft.
 */

export interface ConsumptionOverview {
  rows: ConsumptionRow[]
  /** Het evenement waarvan de telling het verbruik afsluit, als dat er is. */
  nextEvent: Event | null
  /** Waarom er (nog) niets te zien is. */
  blocker: 'GEEN_TELLING' | 'GEEN_VOLGEND_EVENEMENT' | 'VOLGENDE_NIET_GETELD' | null
}

/** Het evenement dat dit evenement als voorganger heeft. */
export function findNextEvent(events: Event[], eventId: string): Event | null {
  const linked = events.find((event) => event.previousEventId === eventId)
  if (linked) return linked

  // Niet gekoppeld (bijvoorbeeld bij oudere evenementen): dan het eerst
  // volgende op datum.
  const current = events.find((event) => event.id === eventId)
  if (!current) return null

  return (
    [...events]
      .filter((event) => event.id !== eventId && event.date > current.date)
      .sort((a, b) => a.date.localeCompare(b.date))[0] ?? null
  )
}

/** Het laatste evenement vóór deze datum — de voorganger bij het aanmaken. */
export function findPreviousEventId(events: Event[], date: string): string | undefined {
  return [...events]
    .filter((event) => event.date < date)
    .sort((a, b) => b.date.localeCompare(a.date))[0]?.id
}

/** Getelde kwarteenheden per kiosk en product, uit de goedgekeurde telronden. */
async function countedByKioskProduct(eventId: string): Promise<Map<string, number> | null> {
  const sessions = await repositories.count().getSessions(eventId)
  const usable = sessions.filter(
    (session) =>
      session.status === CountSessionStatus.APPROVED ||
      session.status === CountSessionStatus.SUBMITTED
  )
  if (usable.length === 0) return null

  const counted = new Map<string, number>()
  for (const session of usable) {
    const [kioskCounts, entries] = await Promise.all([
      repositories.count().getKioskCountsForSession(session.id),
      repositories.count().getEntriesForSession(session.id),
    ])
    const kioskByCount = new Map(kioskCounts.map((count) => [count.id, count.kioskId]))

    for (const entry of entries) {
      const kioskId = kioskByCount.get(entry.kioskCountId)
      if (!kioskId) continue
      const composite = key(kioskId, entry.productId)
      counted.set(composite, (counted.get(composite) ?? 0) + entry.countedQuantityQuarters)
    }
  }
  return counted
}

/** Afgeleverde verpakkingen per kiosk en product tijdens dit evenement. */
async function deliveredByKioskProduct(eventId: string): Promise<Map<string, number>> {
  const restock = repositories.restock()
  const rounds = await restock.getRounds(eventId)

  const delivered = new Map<string, number>()
  for (const round of rounds) {
    const [stops, deliveries] = await Promise.all([
      restock.getRoundStops(round.id),
      restock.getDeliveriesForRound(round.id),
    ])
    const kioskByStop = new Map(stops.map((stop) => [stop.id, stop.kioskId]))

    for (const delivery of deliveries) {
      const kioskId = kioskByStop.get(delivery.restockRoundStopId)
      if (!kioskId) continue
      const composite = key(kioskId, delivery.productId)
      delivered.set(composite, (delivered.get(composite) ?? 0) + delivery.deliveredPackages)
    }
  }
  return delivered
}

export async function getConsumptionOverview(
  event: Event,
  allEvents: Event[]
): Promise<ConsumptionOverview> {
  const nextEvent = findNextEvent(allEvents, event.id)

  const [countedBefore, delivered] = await Promise.all([
    countedByKioskProduct(event.id),
    deliveredByKioskProduct(event.id),
  ])

  if (!countedBefore) {
    return { rows: [], nextEvent, blocker: 'GEEN_TELLING' }
  }
  if (!nextEvent) {
    return { rows: [], nextEvent, blocker: 'GEEN_VOLGEND_EVENEMENT' }
  }

  const countedAfter = await countedByKioskProduct(nextEvent.id)
  if (!countedAfter) {
    return { rows: [], nextEvent, blocker: 'VOLGENDE_NIET_GETELD' }
  }

  return {
    rows: buildConsumptionRows({ countedBefore, delivered, countedAfter }),
    nextEvent,
    blocker: null,
  }
}
