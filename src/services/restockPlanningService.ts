import { repositories } from '@/repositories'
import { newId } from '@/lib/ids'
import { planRestock, type RestockPlanItem } from '@/domain/restocking/planRestock'
import { unplannedPackages, openPackages } from '@/domain/restocking/buildRequirements'
import { planRoundStops, type PlannedStop } from '@/domain/restocking/planRoundStops'
import { RestockRoundStatus, RestockRoundType, RouteDirection } from '@/types'
import type {
  Event,
  Kiosk,
  Product,
  RestockRequirement,
  RestockRound,
  RestockRoundItem,
} from '@/types'

/**
 * Vulplanning: van openstaande behoeften naar geladen pallets met een route.
 *
 * Reserveringen zijn hier de kern. Zodra een behoefte aan een ronde wordt
 * gekoppeld, wordt hij gereserveerd; daardoor kan dezelfde voorraadbehoefte
 * niet op twee actieve pallets tegelijk terechtkomen.
 */

/** Rondestatussen waarin de gereserveerde voorraad nog vastligt. */
const ACTIVE_ROUND_STATUSES: RestockRoundStatus[] = [
  RestockRoundStatus.DRAFT,
  RestockRoundStatus.PICKING,
  RestockRoundStatus.READY,
  RestockRoundStatus.CLAIMED,
  RestockRoundStatus.IN_PROGRESS,
]

export interface RestockOverview {
  requirements: RestockRequirement[]
  productRoundItems: RestockPlanItem[]
  mixedPalletItems: RestockPlanItem[]
  /** Behoeften per product, met kiosken en aantallen. */
  byProduct: Map<string, { total: number; perKiosk: Array<{ kioskId: string; packages: number }> }>
}

export async function getRestockOverview(
  eventId: string,
  products: Map<string, Product>
): Promise<RestockOverview> {
  const requirements = await repositories.restock().getRequirements(eventId)
  const { productRoundItems, mixedPalletItems } = planRestock(requirements, products)

  const byProduct = new Map<
    string,
    { total: number; perKiosk: Array<{ kioskId: string; packages: number }> }
  >()

  for (const requirement of requirements) {
    const remaining = unplannedPackages(requirement)
    if (remaining <= 0) continue

    const current = byProduct.get(requirement.productId) ?? { total: 0, perKiosk: [] }
    current.total += remaining
    current.perKiosk.push({ kioskId: requirement.kioskId, packages: remaining })
    byProduct.set(requirement.productId, current)
  }

  for (const entry of byProduct.values()) {
    entry.perKiosk.sort((a, b) => a.kioskId.localeCompare(b.kioskId))
  }

  return { requirements, productRoundItems, mixedPalletItems, byProduct }
}

/**
 * Het eerste evenement uit `candidates` waar nog vulwerk voor open staat.
 *
 * Het palletscherm begon standaard bij het oudste evenement uit de lijst — vaak
 * een afgeronde wedstrijd zonder één openstaand tekort. Welk evenement er werk
 * heeft is niet uit de status af te lezen, dus dat wordt hier nagevraagd. De
 * kandidaten staan op volgorde van relevantie, dus in de praktijk is het de
 * eerste.
 */
export async function findEventWithOpenRestockWork(
  candidates: Event[],
  limit = 5
): Promise<Event | null> {
  const restock = repositories.restock()

  for (const event of candidates.slice(0, limit)) {
    const requirements = await restock.getRequirements(event.id)
    if (requirements.some((requirement) => unplannedPackages(requirement) > 0)) {
      return event
    }
  }
  return null
}

export interface CreateRoundParams {
  eventId: string
  ringId: string
  productIds: string[]
  createdById: string
  name: string
  roundType: RestockRoundType
}

/**
 * Maakt een vulronde met gereserveerde voorraad.
 *
 * Het reserveren gebeurt server-side in één transactie. Dat is geen detail:
 * eerst hier uitrekenen wat er vrij is en dat daarna wegschrijven, betekent dat
 * twee vullers die tegelijk bij de pallet staan allebei dezelfde tien pakken
 * kunnen opeisen. Wat er werkelijk vrij is wordt daarom pas bepaald met de
 * behoefterijen vergrendeld.
 */
export async function createRound(params: CreateRoundParams): Promise<RestockRound> {
  const { eventId, ringId, productIds, createdById, name, roundType } = params
  if (productIds.length === 0) {
    throw new Error('Kies minstens één product voor deze ronde.')
  }

  const kioskIds = (await repositories.kiosk().getKiosks(ringId)).map((k: Kiosk) => k.id)

  const result = await repositories.restock().reserveRoundAtomic({
    round: {
      id: newId(),
      eventId,
      ringId,
      name,
      roundType,
      status: RestockRoundStatus.PICKING,
      createdById,
    },
    kioskIds,
    productIds,
  })

  if (!result.ok) {
    throw new Error('Er is voor deze producten niets meer te plannen in deze ring.')
  }

  return result.round
}

export async function createProductRound(params: {
  eventId: string
  ringId: string
  productId: string
  productName: string
  createdById: string
}): Promise<RestockRound> {
  return createRound({
    eventId: params.eventId,
    ringId: params.ringId,
    productIds: [params.productId],
    createdById: params.createdById,
    name: `Productronde ${params.productName}`,
    roundType: RestockRoundType.PRODUCT_ROUND,
  })
}

export async function createMixedPalletRound(params: {
  eventId: string
  ringId: string
  productIds: string[]
  createdById: string
  sequenceNumber: number
}): Promise<RestockRound> {
  return createRound({
    eventId: params.eventId,
    ringId: params.ringId,
    productIds: params.productIds,
    createdById: params.createdById,
    name: `Gemengde pallet #${params.sequenceNumber}`,
    roundType: RestockRoundType.MIXED_PALLET,
  })
}

/**
 * Bouwt de route voor alles wat er voor deze ronde gereserveerd staat.
 *
 * De vuller stapelt wat er nodig is; hoeveel er op dat moment werkelijk op de
 * pallet past is geen planningsvraag. Raakt de pallet onderweg leeg, dan haalt
 * hij bij — de route blijft compleet.
 */
export async function planRouteForRound(roundId: string): Promise<PlannedStop[]> {
  const items = await repositories.restock().getRoundItems(roundId)
  if (items.length === 0) throw new Error('Deze ronde heeft geen producten.')
  return setLoadedQuantities(roundId, roundItemsToLoadMap(items))
}

export interface PalletRoundResult {
  round: RestockRound
  /** Eerste halte, of null als er met deze lading nergens heen te rijden valt. */
  firstStopId: string | null
}

/**
 * Een pallet pakken en er meteen mee weglopen.
 *
 * Dit doet in één keer wat anders over drie schermen verdeeld is: ronde maken,
 * de lading vastleggen, de ronde aannemen en starten. Wie bij de pallet staat
 * heeft die tussenstappen niet nodig — die weet al wat erop ligt.
 *
 * De aantallen zijn de voorgestelde: alles wat er nog open staat voor deze
 * producten in deze ring. Klopt dat niet met wat er werkelijk op de pallet
 * ligt, dan past de vuller het onderweg aan op de rondepagina.
 */
export async function startPalletRound(params: {
  eventId: string
  ringId: string
  productIds: string[]
  productNames: Map<string, string>
  userId: string
  sequenceNumber: number
}): Promise<PalletRoundResult> {
  const { eventId, ringId, productIds, productNames, userId, sequenceNumber } = params

  // Eén product is een productronde, meer is een gemengde pallet. Dat scheelt
  // later zoeken: de naam zegt dan wat er op de pallet lag.
  const single = productIds.length === 1 ? productIds[0] : undefined
  const round = await createRound({
    eventId,
    ringId,
    productIds,
    createdById: userId,
    name: single
      ? `Productronde ${productNames.get(single) ?? single}`
      : `Gemengde pallet #${sequenceNumber}`,
    roundType: single ? RestockRoundType.PRODUCT_ROUND : RestockRoundType.MIXED_PALLET,
  })

  await planRouteForRound(round.id)
  await claimRound(round.id, userId)
  const started = await startRound(round.id)

  const stops = [...(await repositories.restock().getRoundStops(round.id))].sort(
    (a, b) => a.sortOrder - b.sortOrder
  )
  return { round: started, firstStopId: stops[0]?.id ?? null }
}

/**
 * Legt vast wat er werkelijk geladen is en bouwt de route.
 *
 * De geladen hoeveelheid is leidend: is er minder geladen dan nodig, dan komen
 * de laatste kiosken op de route niet meer aan bod en blijft hun behoefte open.
 */
export async function setLoadedQuantities(
  roundId: string,
  loadedByProduct: Map<string, number>
): Promise<PlannedStop[]> {
  const restock = repositories.restock()
  const round = await restock.getRoundById(roundId)
  if (!round) throw new Error(`Vulronde niet gevonden: ${roundId}`)

  const items = await restock.getRoundItems(roundId)
  for (const item of items) {
    const loaded = loadedByProduct.get(item.productId)
    if (loaded === undefined) continue
    if (loaded < 0) throw new Error('Een geladen aantal kan niet negatief zijn.')
    await restock.upsertRoundItem({ ...item, loadedPackages: loaded })
  }

  const effectiveLoad = new Map(
    items.map((item) => [item.productId, loadedByProduct.get(item.productId) ?? item.loadedPackages])
  )

  const stops = await buildStops(round, effectiveLoad)

  // Opnieuw laden mag geen dubbele haltes opleveren.
  await restock.deleteRoundStops(roundId)

  const createdStops = await restock.createRoundStops(
    stops.map((stop) => ({
      restockRoundId: roundId,
      kioskId: stop.kioskId,
      sortOrder: stop.sortOrder,
    }))
  )

  const requirements = await restock.getRequirements(round.eventId)
  const requirementByKey = new Map(
    requirements.map((r) => [`${r.kioskId}:${r.productId}`, r.id])
  )

  await restock.createStopItems(
    createdStops.flatMap((createdStop) => {
      const planned = stops.find((s) => s.kioskId === createdStop.kioskId)
      return (planned?.items ?? []).map((item) => ({
        restockRoundStopId: createdStop.id,
        productId: item.productId,
        restockRequirementId: requirementByKey.get(`${createdStop.kioskId}:${item.productId}`),
        plannedPackages: item.plannedPackages,
      }))
    })
  )

  await restock.updateRound(roundId, { status: RestockRoundStatus.READY })
  return stops
}

async function buildStops(
  round: RestockRound,
  loadedByProduct: Map<string, number>
): Promise<PlannedStop[]> {
  const restock = repositories.restock()
  const [requirements, ringKiosks, reservations, ring] = await Promise.all([
    restock.getRequirements(round.eventId),
    repositories.kiosk().getKiosks(round.ringId),
    restock.getReservationsForRound(round.id),
    repositories.kiosk().getRingById(round.ringId),
  ])

  // Alleen de behoeften die aan déze ronde zijn toegewezen.
  const reservedRequirementIds = new Set(reservations.map((r) => r.restockRequirementId))
  const kioskIds = new Set(ringKiosks.map((k: Kiosk) => k.id))

  const demandByKiosk = new Map<string, Map<string, number>>()
  for (const requirement of requirements) {
    if (!reservedRequirementIds.has(requirement.id)) continue
    if (!kioskIds.has(requirement.kioskId)) continue

    const open = openPackages(requirement)
    if (open <= 0) continue

    const perProduct = demandByKiosk.get(requirement.kioskId) ?? new Map<string, number>()
    perProduct.set(requirement.productId, open)
    demandByKiosk.set(requirement.kioskId, perProduct)
  }

  // Vullen begint op een andere plek dan tellen: met een pallet rijd je een
  // andere kant op dan waar je de lift uitkomt.
  //
  // De startkiosk hoeft zelf geen vraag te hebben — je komt daar de ring
  // binnen. De eerste halte wordt dan gewoon de eerstvolgende kiosk waar wél
  // iets heen moet. Staat er niets ingesteld, dan begint de route bij de
  // eerste kiosk met vraag.
  const preferredStart = ring?.restockStartKioskId
  const startKioskId =
    preferredStart !== undefined && kioskIds.has(preferredStart) ? preferredStart : undefined

  return planRoundStops({
    ringKiosks: ringKiosks.map((k: Kiosk) => ({
      id: k.id,
      sortOrder: k.sortOrder,
      isActive: k.isActive,
    })),
    demandByKiosk,
    loadedByProduct,
    startKioskId,
    direction: RouteDirection.ASCENDING,
  })
}

/** Neemt een klaargezette ronde aan. */
export async function claimRound(roundId: string, userId: string): Promise<RestockRound> {
  return repositories.restock().updateRound(roundId, {
    assignedUserId: userId,
    claimedAt: new Date().toISOString(),
    status: RestockRoundStatus.CLAIMED,
  })
}

export async function startRound(roundId: string): Promise<RestockRound> {
  return repositories.restock().updateRound(roundId, {
    status: RestockRoundStatus.IN_PROGRESS,
    startedAt: new Date().toISOString(),
  })
}

/**
 * Annuleert een ronde en geeft de gereserveerde voorraad vrij, zodat die
 * opnieuw in de vulplanning verschijnt.
 */
export async function cancelRound(roundId: string): Promise<void> {
  const restock = repositories.restock()
  await releaseReservations(roundId)
  await restock.updateRound(roundId, { status: RestockRoundStatus.CANCELLED })
}

/** Geeft alle nog openstaande reserveringen van een ronde vrij. */
export async function releaseReservations(roundId: string): Promise<void> {
  const restock = repositories.restock()
  const reservations = await restock.getReservationsForRound(roundId)
  if (reservations.length === 0) return

  const round = await restock.getRoundById(roundId)
  if (!round) return

  const requirements = new Map(
    (await restock.getRequirements(round.eventId)).map((r) => [r.id, r])
  )

  for (const reservation of reservations) {
    const requirement = requirements.get(reservation.restockRequirementId)
    if (requirement) {
      await restock.updateRequirement(requirement.id, {
        reservedPackages: Math.max(0, requirement.reservedPackages - reservation.reservedPackages),
      })
    }
    await restock.releaseReservation(roundId, reservation.restockRequirementId)
  }
}

export function isRoundActive(round: RestockRound): boolean {
  return ACTIVE_ROUND_STATUSES.includes(round.status)
}

export function roundItemsToLoadMap(items: RestockRoundItem[]): Map<string, number> {
  return new Map(items.map((item) => [item.productId, item.loadedPackages]))
}
