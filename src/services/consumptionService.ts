import { repositories } from '@/repositories'
import { buildConsumptionRows, key, type ConsumptionRow } from '@/domain/analytics/consumption'
import { CountSessionStatus, KioskCountStatus } from '@/types'
import type { CountSession, Event } from '@/types'

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

/**
 * Per ring precies één goedgekeurde telronde: de laatst gestarte.
 *
 * Wordt een ring opnieuw geteld — na heropenen, of met een tweede ronde ter
 * correctie — dan staan er twee goedgekeurde rondes voor dezelfde kiosken.
 * Optellen zou het verbruik verdubbelen; de oudste nemen zou de correctie
 * negeren. De laatst gestarte is de versie die geldt.
 *
 * SUBMITTED telt niet mee: een ingediende telling is nog niet gecontroleerd, en
 * cijfers waar nog iets aan kan veranderen horen niet in een analyse.
 */
export function leadingSessionsPerRing(sessions: CountSession[]): CountSession[] {
  const byRing = new Map<string, CountSession>()

  for (const session of sessions) {
    if (session.status !== CountSessionStatus.APPROVED) continue

    const current = byRing.get(session.ringId)
    const isNewer =
      !current ||
      session.startedAt > current.startedAt ||
      (session.startedAt === current.startedAt && session.updatedAt > current.updatedAt)
    if (isNewer) byRing.set(session.ringId, session)
  }

  return [...byRing.values()]
}

/** Wat er bij een evenement geteld is, en wat daar níet in staat. */
interface CountSnapshot {
  /** `kioskId:productId` → getelde kwarteenheden. */
  counted: Map<string, number>
  /** Kiosken met een afgeronde telling; overgeslagen en dichte kiosken niet. */
  countedKioskIds: Set<string>
  /** Ringen waarvan een goedgekeurde telling gebruikt is. */
  ringIds: Set<string>
}

/** Getelde kwarteenheden per kiosk en product, uit de goedgekeurde telronden. */
async function countSnapshot(eventId: string): Promise<CountSnapshot | null> {
  const leading = leadingSessionsPerRing(await repositories.count().getSessions(eventId))
  if (leading.length === 0) return null

  const counted = new Map<string, number>()
  const countedKioskIds = new Set<string>()
  const ringIds = new Set<string>()

  for (const session of leading) {
    ringIds.add(session.ringId)

    const [kioskCounts, entries] = await Promise.all([
      repositories.count().getKioskCountsForSession(session.id),
      repositories.count().getEntriesForSession(session.id),
    ])

    // Alleen afgeronde kiosken. Bij een overgeslagen kiosk is niet bekend wat
    // er stond, dus valt er ook geen verbruik uit af te leiden.
    const kioskByCount = new Map<string, string>()
    for (const kioskCount of kioskCounts) {
      if (kioskCount.status !== KioskCountStatus.COMPLETED) continue
      kioskByCount.set(kioskCount.id, kioskCount.kioskId)
      countedKioskIds.add(kioskCount.kioskId)
    }

    for (const entry of entries) {
      const kioskId = kioskByCount.get(entry.kioskCountId)
      if (!kioskId) continue
      // Eén telling per kiosk en product: binnen één ronde is dat een unieke
      // regel, dus zetten in plaats van optellen.
      counted.set(key(kioskId, entry.productId), entry.countedQuantityQuarters)
    }
  }

  return { counted, countedKioskIds, ringIds }
}

/**
 * De kiosk-productcombinaties die bij dit evenement nog een actieve norm
 * hebben.
 *
 * Zonder norm hoort het product er niet meer te staan; dat het bij de volgende
 * telling ontbreekt betekent dan niet dat het op is, maar dat het uit het
 * assortiment is.
 */
async function activeStandards(ringIds: Set<string>): Promise<Set<string>> {
  const active = new Set<string>()

  for (const ringId of ringIds) {
    const matrix = await repositories.product().getStandardMatrix(ringId)
    for (const [productId, byKiosk] of Object.entries(matrix.standards)) {
      for (const [kioskId, standard] of Object.entries(byKiosk)) {
        if (standard.isActive) active.add(key(kioskId, productId))
      }
    }
  }

  return active
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

  const [before, delivered] = await Promise.all([
    countSnapshot(event.id),
    deliveredByKioskProduct(event.id),
  ])

  if (!before) {
    return { rows: [], nextEvent, blocker: 'GEEN_TELLING' }
  }
  if (!nextEvent) {
    return { rows: [], nextEvent, blocker: 'GEEN_VOLGEND_EVENEMENT' }
  }

  const after = await countSnapshot(nextEvent.id)
  if (!after) {
    return { rows: [], nextEvent, blocker: 'VOLGENDE_NIET_GETELD' }
  }

  return {
    rows: buildConsumptionRows({
      countedBefore: before.counted,
      delivered,
      countedAfter: after.counted,
      countedKioskIdsAfter: after.countedKioskIds,
      activeStandardsAfter: await activeStandards(after.ringIds),
    }),
    nextEvent,
    blocker: null,
  }
}
