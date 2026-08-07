import { repositories } from '@/repositories'
import { newId } from '@/lib/ids'
import { planRestock, type RestockPlanItem } from '@/domain/restocking/planRestock'
import { unplannedPackages, openPackages } from '@/domain/restocking/buildRequirements'
import { planRoundStops, type PlannedStop } from '@/domain/restocking/planRoundStops'
import { RestockRoundStatus, RestockRoundType, RouteDirection } from '@/types'
import type {
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
 * Reserveren en het aanmaken van de ronde horen bij elkaar: mislukt het
 * reserveren, dan wordt de ronde weer opgeruimd zodat er geen halve planning
 * achterblijft. (Demo-modus kent geen transacties; in productie doet de
 * unique-constraint op (behoefte, ronde) het zware werk.)
 */
export async function createRound(params: CreateRoundParams): Promise<RestockRound> {
  const { eventId, ringId, productIds, createdById, name, roundType } = params
  if (productIds.length === 0) {
    throw new Error('Kies minstens één product voor deze ronde.')
  }

  const restock = repositories.restock()
  const kiosksInRing = new Set((await repositories.kiosk().getKiosks(ringId)).map((k) => k.id))

  const requirements = (await restock.getRequirements(eventId)).filter(
    (requirement) =>
      productIds.includes(requirement.productId) &&
      kiosksInRing.has(requirement.kioskId) &&
      unplannedPackages(requirement) > 0
  )

  if (requirements.length === 0) {
    throw new Error('Er is voor deze producten niets meer te plannen in deze ring.')
  }

  const round = await restock.createRound({
    id: newId(),
    eventId,
    ringId,
    name,
    roundType,
    status: RestockRoundStatus.PICKING,
    createdById,
  })

  try {
    const proposedByProduct = new Map<string, number>()

    for (const requirement of requirements) {
      const packages = unplannedPackages(requirement)
      await restock.createReservation({
        restockRequirementId: requirement.id,
        restockRoundId: round.id,
        reservedPackages: packages,
      })
      await restock.updateRequirement(requirement.id, {
        reservedPackages: requirement.reservedPackages + packages,
      })
      proposedByProduct.set(
        requirement.productId,
        (proposedByProduct.get(requirement.productId) ?? 0) + packages
      )
    }

    for (const [productId, proposed] of proposedByProduct) {
      await restock.upsertRoundItem({
        restockRoundId: round.id,
        productId,
        proposedPackages: proposed,
        // Standaard laden we het voorgestelde aantal; de vuller past aan.
        loadedPackages: proposed,
        deliveredPackages: 0,
      })
    }

    return round
  } catch (error) {
    console.error('[vulplanning] Ronde aanmaken mislukt; reserveringen worden vrijgegeven.', error)
    await cancelRound(round.id).catch((cleanupError: unknown) => {
      console.error('[vulplanning] Opruimen na een mislukte ronde is ook mislukt.', cleanupError)
    })
    throw error
  }
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
