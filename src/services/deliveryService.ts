import { repositories } from '@/repositories'
import { syncService } from './syncService'
import { KeyedQueue } from '@/lib/keyedQueue'
import { newId } from '@/lib/ids'
import { releaseReservations } from './restockPlanningService'
import { RestockRoundStatus, DeliveryReason } from '@/types'
import type {
  RestockRound,
  RestockRoundItem,
  RestockRoundStop,
  RestockStopItem,
  RestockDelivery,
  RestockRequirement,
} from '@/types'

/**
 * Uitvoeren van een vulronde: kiosk voor kiosk afleveren.
 *
 * Kern van de regels: er wordt nooit meer geleverd dan er geladen is, en een
 * gedeeltelijke levering sluit een behoefte niet af — het restant hoort weer
 * in de vulplanning terug te komen.
 */

const writeQueue = new KeyedQueue()

export async function flushPendingDeliveryWrites(): Promise<void> {
  await writeQueue.flush()
}

export interface StopProductPlan {
  productId: string
  plannedPackages: number
  deliveredPackages: number
  /** Wat er nog op de pallet ligt voor dit product, over de hele ronde. */
  remainingOnPallet: number
  isDelivered: boolean
}

export interface StopPlan {
  round: RestockRound
  stop: RestockRoundStop
  stopNumber: number
  totalStops: number
  products: StopProductPlan[]
  isCompleted: boolean
}

export interface RoundPlan {
  round: RestockRound
  items: RestockRoundItem[]
  stops: RestockRoundStop[]
  stopItems: RestockStopItem[]
  deliveries: RestockDelivery[]
  /** Nog op de pallet: geladen min geleverd, per product. */
  remainingByProduct: Map<string, number>
  completedStops: number
}

export async function getRoundPlan(roundId: string): Promise<RoundPlan> {
  const restock = repositories.restock()
  const round = await restock.getRoundById(roundId)
  if (!round) throw new Error(`Vulronde niet gevonden: ${roundId}`)

  const [items, stops, stopItems, deliveries] = await Promise.all([
    restock.getRoundItems(roundId),
    restock.getRoundStops(roundId),
    restock.getStopItemsForRound(roundId),
    restock.getDeliveriesForRound(roundId),
  ])

  const deliveredByProduct = new Map<string, number>()
  for (const delivery of deliveries) {
    deliveredByProduct.set(
      delivery.productId,
      (deliveredByProduct.get(delivery.productId) ?? 0) + delivery.deliveredPackages
    )
  }

  const remainingByProduct = new Map(
    items.map((item) => [
      item.productId,
      Math.max(0, item.loadedPackages - (deliveredByProduct.get(item.productId) ?? 0)),
    ])
  )

  return {
    round,
    items,
    stops,
    stopItems,
    deliveries,
    remainingByProduct,
    completedStops: stops.filter((stop) => stop.completedAt).length,
  }
}

export async function getStopPlan(roundId: string, stopId: string): Promise<StopPlan> {
  const plan = await getRoundPlan(roundId)
  const stop = plan.stops.find((s) => s.id === stopId)
  if (!stop) throw new Error(`Halte niet gevonden: ${stopId}`)

  const deliveriesForStop = plan.deliveries.filter((d) => d.restockRoundStopId === stopId)
  const deliveredByProduct = new Map<string, number>()
  for (const delivery of deliveriesForStop) {
    deliveredByProduct.set(
      delivery.productId,
      (deliveredByProduct.get(delivery.productId) ?? 0) + delivery.deliveredPackages
    )
  }

  const products: StopProductPlan[] = plan.stopItems
    .filter((item) => item.restockRoundStopId === stopId)
    .map((item) => ({
      productId: item.productId,
      plannedPackages: item.plannedPackages,
      deliveredPackages: deliveredByProduct.get(item.productId) ?? 0,
      remainingOnPallet: plan.remainingByProduct.get(item.productId) ?? 0,
      isDelivered: deliveredByProduct.has(item.productId),
    }))

  return {
    round: plan.round,
    stop,
    stopNumber: plan.stops.findIndex((s) => s.id === stopId) + 1,
    totalStops: plan.stops.length,
    products,
    isCompleted: Boolean(stop.completedAt),
  }
}

export interface RegisterDeliveryParams {
  roundId: string
  stopId: string
  productId: string
  plannedPackages: number
  deliveredPackages: number
  reason?: DeliveryReason
  reasonNotes?: string
  userId: string
}

/**
 * Registreert wat er bij een kiosk daadwerkelijk is afgeleverd.
 *
 * Bij een afwijking is een reden verplicht: anders is achteraf niet te zien
 * of er te weinig op de pallet lag of dat de kiosk dicht was.
 */
export async function registerDelivery(params: RegisterDeliveryParams): Promise<void> {
  const {
    roundId,
    stopId,
    productId,
    plannedPackages,
    deliveredPackages,
    reason,
    reasonNotes,
    userId,
  } = params

  if (deliveredPackages < 0) {
    throw new Error('Een geleverd aantal kan niet negatief zijn.')
  }
  if (deliveredPackages !== plannedPackages && !reason) {
    throw new Error('Geef een reden op wanneer het geleverde aantal afwijkt.')
  }
  if (reason === DeliveryReason.ANDERE_REDEN && !reasonNotes?.trim()) {
    throw new Error('Licht "andere reden" kort toe.')
  }

  const restock = repositories.restock()
  const plan = await getRoundPlan(roundId)

  const alreadyDelivered = plan.deliveries
    .filter((d) => d.productId === productId)
    .reduce((sum, d) => sum + d.deliveredPackages, 0)
  const loaded = plan.items.find((i) => i.productId === productId)?.loadedPackages ?? 0

  if (alreadyDelivered + deliveredPackages > loaded) {
    throw new Error(
      `Er ligt maar ${loaded - alreadyDelivered} van dit product op de pallet.`
    )
  }

  const delivery: RestockDelivery = {
    id: newId(),
    restockRoundStopId: stopId,
    productId,
    plannedPackages,
    deliveredPackages,
    notDeliveredPackages: Math.max(0, plannedPackages - deliveredPackages),
    reason,
    reasonNotes: reasonNotes?.trim() || undefined,
    deliveredAt: new Date().toISOString(),
    deliveredById: userId,
    createdAt: new Date().toISOString(),
  }

  await writeQueue.run(`delivery:${stopId}:${productId}`, async () => {
    await restock.createDelivery(delivery)
  })
  await syncService.enqueue('restockDelivery', delivery.id, 'create', delivery)

  await applyDeliveryToRequirement(plan, stopId, productId, deliveredPackages)
  await updateRoundItemDelivered(roundId, productId)
}

/**
 * Boekt de levering af op de behoefte en geeft de reservering vrij.
 *
 * Wat niet geleverd is blijft openstaan: `requiredPackages - deliveredPackages`
 * is groter dan nul en de reservering verdwijnt, waardoor het restant vanzelf
 * weer in de vulplanning opduikt.
 */
async function applyDeliveryToRequirement(
  plan: RoundPlan,
  stopId: string,
  productId: string,
  deliveredPackages: number
): Promise<void> {
  const restock = repositories.restock()
  const stopItem = plan.stopItems.find(
    (item) => item.restockRoundStopId === stopId && item.productId === productId
  )
  if (!stopItem?.restockRequirementId) return

  const requirements = await restock.getRequirements(plan.round.eventId)
  const requirement = requirements.find(
    (r: RestockRequirement) => r.id === stopItem.restockRequirementId
  )
  if (!requirement) return

  const reservation = (await restock.getReservationsForRound(plan.round.id)).find(
    (r) => r.restockRequirementId === requirement.id
  )

  await restock.updateRequirement(requirement.id, {
    deliveredPackages: Math.min(
      requirement.requiredPackages,
      requirement.deliveredPackages + deliveredPackages
    ),
    reservedPackages: Math.max(
      0,
      requirement.reservedPackages - (reservation?.reservedPackages ?? 0)
    ),
  })

  if (reservation) {
    await restock.releaseReservation(plan.round.id, requirement.id)
  }
}

async function updateRoundItemDelivered(roundId: string, productId: string): Promise<void> {
  const restock = repositories.restock()
  const plan = await getRoundPlan(roundId)
  const item = plan.items.find((i) => i.productId === productId)
  if (!item) return

  const delivered = plan.deliveries
    .filter((d) => d.productId === productId)
    .reduce((sum, d) => sum + d.deliveredPackages, 0)

  await restock.upsertRoundItem({ ...item, deliveredPackages: delivered })
}

export async function completeStop(stopId: string, notes?: string): Promise<RestockRoundStop> {
  await flushPendingDeliveryWrites()
  return repositories.restock().updateStop(stopId, {
    completedAt: new Date().toISOString(),
    notes: notes?.trim() || undefined,
  })
}

export async function skipStop(stopId: string, skipReason: string): Promise<RestockRoundStop> {
  const reason = skipReason.trim()
  if (!reason) throw new Error('Een halte overslaan kan alleen met een reden.')
  return repositories.restock().updateStop(stopId, {
    completedAt: new Date().toISOString(),
    skipReason: reason,
  })
}

/**
 * Sluit de ronde af. Wat er niet geleverd is, komt via het vrijgeven van de
 * reserveringen terug in de vulplanning.
 */
export async function completeRound(roundId: string): Promise<RestockRound> {
  await flushPendingDeliveryWrites()
  const plan = await getRoundPlan(roundId)

  const allStopsHandled = plan.stops.every((stop) => stop.completedAt)
  const everythingDelivered = plan.items.every(
    (item) => item.deliveredPackages >= item.proposedPackages
  )

  await releaseReservations(roundId)

  return repositories.restock().updateRound(roundId, {
    status:
      allStopsHandled && everythingDelivered
        ? RestockRoundStatus.COMPLETED
        : RestockRoundStatus.PARTIALLY_COMPLETED,
    completedAt: new Date().toISOString(),
  })
}

/** Eerstvolgende halte die nog bezocht moet worden. */
export function getNextStop(plan: RoundPlan): RestockRoundStop | null {
  return plan.stops.find((stop) => !stop.completedAt) ?? null
}
