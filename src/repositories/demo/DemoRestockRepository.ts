import type { IRestockRepository } from '../interfaces/IRestockRepository'
import type {
  RestockRequirement,
  RestockRound,
  RestockRoundItem,
  RestockRoundStop,
  RestockStopItem,
  RestockDelivery,
  StockReservation,
} from '@/types'
import { demoTables } from './demoTables'
import { newId, restockRequirementId } from '@/lib/ids'

export class DemoRestockRepository implements IRestockRepository {
  // ─── Behoeften ─────────────────────────────────────────────────────────────

  async getRequirements(eventId: string): Promise<RestockRequirement[]> {
    return demoTables.restockRequirements.filter((r) => r.eventId === eventId)
  }

  async upsertRequirement(
    data: Omit<RestockRequirement, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<RestockRequirement> {
    const id = restockRequirementId(data.eventId, data.kioskId, data.productId)
    const existing = demoTables.restockRequirements.getById(id)
    const now = new Date().toISOString()
    const requirement: RestockRequirement = {
      ...data,
      id,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    }
    demoTables.restockRequirements.put(requirement)
    return requirement
  }

  async bulkUpsertRequirements(
    data: Array<Omit<RestockRequirement, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<RestockRequirement[]> {
    const now = new Date().toISOString()
    const requirements = data.map((item) => {
      const id = restockRequirementId(item.eventId, item.kioskId, item.productId)
      const existing = demoTables.restockRequirements.getById(id)
      return { ...item, id, createdAt: existing?.createdAt ?? now, updatedAt: now }
    })
    demoTables.restockRequirements.putMany(requirements)
    return requirements
  }

  async updateRequirement(
    id: string,
    data: Partial<RestockRequirement>
  ): Promise<RestockRequirement> {
    return demoTables.restockRequirements.update(id, {
      ...data,
      updatedAt: new Date().toISOString(),
    })
  }

  // ─── Vulrondes ─────────────────────────────────────────────────────────────

  async getRounds(eventId: string): Promise<RestockRound[]> {
    return demoTables.restockRounds
      .filter((r) => r.eventId === eventId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  }

  async getRoundById(id: string): Promise<RestockRound | null> {
    return demoTables.restockRounds.getById(id)
  }

  async createRound(data: Omit<RestockRound, 'createdAt' | 'updatedAt'>): Promise<RestockRound> {
    const now = new Date().toISOString()
    const existing = demoTables.restockRounds.getById(data.id)
    const round: RestockRound = {
      ...data,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    }
    demoTables.restockRounds.put(round)
    return round
  }

  async updateRound(id: string, data: Partial<RestockRound>): Promise<RestockRound> {
    return demoTables.restockRounds.update(id, { ...data, updatedAt: new Date().toISOString() })
  }

  async getRoundItems(roundId: string): Promise<RestockRoundItem[]> {
    return demoTables.restockRoundItems.filter((i) => i.restockRoundId === roundId)
  }

  async upsertRoundItem(
    data: Omit<RestockRoundItem, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<RestockRoundItem> {
    const now = new Date().toISOString()
    const existing = demoTables.restockRoundItems.find(
      (i) => i.restockRoundId === data.restockRoundId && i.productId === data.productId
    )
    const item: RestockRoundItem = {
      ...data,
      id: existing?.id ?? newId(),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    }
    demoTables.restockRoundItems.put(item)
    return item
  }

  async getRoundStops(roundId: string): Promise<RestockRoundStop[]> {
    return demoTables.restockRoundStops
      .filter((s) => s.restockRoundId === roundId)
      .sort((a, b) => a.sortOrder - b.sortOrder)
  }

  async createRoundStops(
    stops: Array<Omit<RestockRoundStop, 'id'>>
  ): Promise<RestockRoundStop[]> {
    const created = stops.map((stop) => ({ ...stop, id: newId() }))
    demoTables.restockRoundStops.putMany(created)
    return created
  }

  async updateStop(stopId: string, data: Partial<RestockRoundStop>): Promise<RestockRoundStop> {
    return demoTables.restockRoundStops.update(stopId, data)
  }

  async deleteRoundStops(roundId: string): Promise<void> {
    for (const stop of demoTables.restockRoundStops.filter((s) => s.restockRoundId === roundId)) {
      for (const item of demoTables.restockStopItems.filter(
        (i) => i.restockRoundStopId === stop.id
      )) {
        demoTables.restockStopItems.remove(item.id)
      }
      demoTables.restockRoundStops.remove(stop.id)
    }
  }

  async getStopItems(stopId: string): Promise<RestockStopItem[]> {
    return demoTables.restockStopItems.filter((i) => i.restockRoundStopId === stopId)
  }

  async getStopItemsForRound(roundId: string): Promise<RestockStopItem[]> {
    const stopIds = new Set(
      demoTables.restockRoundStops.filter((s) => s.restockRoundId === roundId).map((s) => s.id)
    )
    return demoTables.restockStopItems.filter((i) => stopIds.has(i.restockRoundStopId))
  }

  async createStopItems(
    items: Array<Omit<RestockStopItem, 'id' | 'createdAt'>>
  ): Promise<RestockStopItem[]> {
    const now = new Date().toISOString()
    const created = items.map((item) => ({ ...item, id: newId(), createdAt: now }))
    demoTables.restockStopItems.putMany(created)
    return created
  }

  // ─── Leveringen ────────────────────────────────────────────────────────────

  async createDelivery(data: RestockDelivery): Promise<RestockDelivery> {
    // Zie de interface: dezelfde levering twee keer aanbieden mag maar één
    // regel opleveren.
    const existing = demoTables.restockDeliveries.getById(data.id)
    if (existing) return existing

    const delivery: RestockDelivery = {
      ...data,
      createdAt: data.createdAt || new Date().toISOString(),
    }
    demoTables.restockDeliveries.insert(delivery)
    return delivery
  }

  async getDeliveriesForStop(stopId: string): Promise<RestockDelivery[]> {
    return demoTables.restockDeliveries.filter((d) => d.restockRoundStopId === stopId)
  }

  async getDeliveriesForRound(roundId: string): Promise<RestockDelivery[]> {
    const stopIds = new Set(
      demoTables.restockRoundStops.filter((s) => s.restockRoundId === roundId).map((s) => s.id)
    )
    return demoTables.restockDeliveries.filter((d) => stopIds.has(d.restockRoundStopId))
  }

  // ─── Reserveringen ─────────────────────────────────────────────────────────

  async createReservation(
    data: Omit<StockReservation, 'id' | 'createdAt'>
  ): Promise<StockReservation> {
    const existing = demoTables.stockReservations.find(
      (r) =>
        r.restockRequirementId === data.restockRequirementId &&
        r.restockRoundId === data.restockRoundId
    )
    const reservation: StockReservation = {
      ...data,
      id: existing?.id ?? newId(),
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    }
    demoTables.stockReservations.put(reservation)
    return reservation
  }

  async getReservationsForRound(roundId: string): Promise<StockReservation[]> {
    return demoTables.stockReservations.filter((r) => r.restockRoundId === roundId)
  }

  async getReservationsForEvent(eventId: string): Promise<StockReservation[]> {
    const requirementIds = new Set(
      demoTables.restockRequirements.filter((r) => r.eventId === eventId).map((r) => r.id)
    )
    return demoTables.stockReservations.filter((r) => requirementIds.has(r.restockRequirementId))
  }

  async releaseReservation(roundId: string, requirementId: string): Promise<void> {
    const reservation = demoTables.stockReservations.find(
      (r) => r.restockRoundId === roundId && r.restockRequirementId === requirementId
    )
    if (reservation) demoTables.stockReservations.remove(reservation.id)
  }

  async releaseReservationsForRound(roundId: string): Promise<void> {
    for (const reservation of demoTables.stockReservations.filter(
      (r) => r.restockRoundId === roundId
    )) {
      demoTables.stockReservations.remove(reservation.id)
    }
  }
}
