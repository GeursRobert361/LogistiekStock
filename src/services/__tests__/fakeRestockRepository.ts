import type { IRestockRepository } from '@/repositories/interfaces/IRestockRepository'
import type {
  RestockRequirement,
  RestockRound,
  RestockRoundItem,
  RestockRoundStop,
  RestockDelivery,
  StockReservation,
} from '@/types'
import { newId, restockRequirementId } from '@/lib/ids'

/** In-memory bijvul-repository voor tests, met dezelfde natuurlijke sleutels. */
export class FakeRestockRepository implements IRestockRepository {
  requirements: RestockRequirement[] = []
  rounds: RestockRound[] = []
  items: RestockRoundItem[] = []
  stops: RestockRoundStop[] = []
  deliveries: RestockDelivery[] = []
  reservations: StockReservation[] = []

  reset(): void {
    this.requirements = []
    this.rounds = []
    this.items = []
    this.stops = []
    this.deliveries = []
    this.reservations = []
  }

  async getRequirements(eventId: string): Promise<RestockRequirement[]> {
    return this.requirements.filter((r) => r.eventId === eventId)
  }

  async upsertRequirement(
    data: Omit<RestockRequirement, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<RestockRequirement> {
    const id = restockRequirementId(data.eventId, data.kioskId, data.productId)
    const now = new Date().toISOString()
    const existing = this.requirements.find((r) => r.id === id)
    const requirement: RestockRequirement = {
      ...data,
      id,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    }
    if (existing) {
      this.requirements[this.requirements.indexOf(existing)] = requirement
    } else {
      this.requirements.push(requirement)
    }
    return requirement
  }

  async bulkUpsertRequirements(
    data: Array<Omit<RestockRequirement, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<RestockRequirement[]> {
    return Promise.all(data.map((item) => this.upsertRequirement(item)))
  }

  async updateRequirement(
    id: string,
    data: Partial<RestockRequirement>
  ): Promise<RestockRequirement> {
    const index = this.requirements.findIndex((r) => r.id === id)
    if (index === -1) throw new Error(`Behoefte niet gevonden: ${id}`)
    const updated = { ...this.requirements[index]!, ...data, updatedAt: new Date().toISOString() }
    this.requirements[index] = updated
    return updated
  }

  async getRounds(eventId: string): Promise<RestockRound[]> {
    return this.rounds.filter((r) => r.eventId === eventId)
  }

  async getRoundById(id: string): Promise<RestockRound | null> {
    return this.rounds.find((r) => r.id === id) ?? null
  }

  async createRound(data: Omit<RestockRound, 'createdAt' | 'updatedAt'>): Promise<RestockRound> {
    const now = new Date().toISOString()
    const existing = this.rounds.find((r) => r.id === data.id)
    const round: RestockRound = { ...data, createdAt: existing?.createdAt ?? now, updatedAt: now }
    if (existing) {
      this.rounds[this.rounds.indexOf(existing)] = round
    } else {
      this.rounds.push(round)
    }
    return round
  }

  async updateRound(id: string, data: Partial<RestockRound>): Promise<RestockRound> {
    const index = this.rounds.findIndex((r) => r.id === id)
    if (index === -1) throw new Error(`Vulronde niet gevonden: ${id}`)
    const updated = { ...this.rounds[index]!, ...data, updatedAt: new Date().toISOString() }
    this.rounds[index] = updated
    return updated
  }

  async getRoundItems(roundId: string): Promise<RestockRoundItem[]> {
    return this.items.filter((i) => i.restockRoundId === roundId)
  }

  async upsertRoundItem(
    data: Omit<RestockRoundItem, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<RestockRoundItem> {
    const now = new Date().toISOString()
    const existing = this.items.find(
      (i) => i.restockRoundId === data.restockRoundId && i.productId === data.productId
    )
    const item: RestockRoundItem = {
      ...data,
      id: existing?.id ?? newId(),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    }
    if (existing) {
      this.items[this.items.indexOf(existing)] = item
    } else {
      this.items.push(item)
    }
    return item
  }

  async getRoundStops(roundId: string): Promise<RestockRoundStop[]> {
    return this.stops
      .filter((s) => s.restockRoundId === roundId)
      .sort((a, b) => a.sortOrder - b.sortOrder)
  }

  async createRoundStops(stops: Array<Omit<RestockRoundStop, 'id'>>): Promise<RestockRoundStop[]> {
    const created = stops.map((stop) => ({ ...stop, id: newId() }))
    this.stops.push(...created)
    return created
  }

  async updateStop(stopId: string, data: Partial<RestockRoundStop>): Promise<RestockRoundStop> {
    const index = this.stops.findIndex((s) => s.id === stopId)
    if (index === -1) throw new Error(`Halte niet gevonden: ${stopId}`)
    const updated = { ...this.stops[index]!, ...data }
    this.stops[index] = updated
    return updated
  }

  async createDelivery(data: Omit<RestockDelivery, 'id' | 'createdAt'>): Promise<RestockDelivery> {
    const delivery: RestockDelivery = {
      ...data,
      id: newId(),
      createdAt: new Date().toISOString(),
    }
    this.deliveries.push(delivery)
    return delivery
  }

  async getDeliveriesForStop(stopId: string): Promise<RestockDelivery[]> {
    return this.deliveries.filter((d) => d.restockRoundStopId === stopId)
  }

  async getDeliveriesForRound(roundId: string): Promise<RestockDelivery[]> {
    const stopIds = new Set(this.stops.filter((s) => s.restockRoundId === roundId).map((s) => s.id))
    return this.deliveries.filter((d) => stopIds.has(d.restockRoundStopId))
  }

  async createReservation(
    data: Omit<StockReservation, 'id' | 'createdAt'>
  ): Promise<StockReservation> {
    const existing = this.reservations.find(
      (r) =>
        r.restockRequirementId === data.restockRequirementId &&
        r.restockRoundId === data.restockRoundId
    )
    const reservation: StockReservation = {
      ...data,
      id: existing?.id ?? newId(),
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    }
    if (existing) {
      this.reservations[this.reservations.indexOf(existing)] = reservation
    } else {
      this.reservations.push(reservation)
    }
    return reservation
  }

  async getReservationsForRound(roundId: string): Promise<StockReservation[]> {
    return this.reservations.filter((r) => r.restockRoundId === roundId)
  }

  async getReservationsForEvent(eventId: string): Promise<StockReservation[]> {
    const ids = new Set(this.requirements.filter((r) => r.eventId === eventId).map((r) => r.id))
    return this.reservations.filter((r) => ids.has(r.restockRequirementId))
  }

  async releaseReservation(roundId: string, requirementId: string): Promise<void> {
    this.reservations = this.reservations.filter(
      (r) => !(r.restockRoundId === roundId && r.restockRequirementId === requirementId)
    )
  }

  async releaseReservationsForRound(roundId: string): Promise<void> {
    this.reservations = this.reservations.filter((r) => r.restockRoundId !== roundId)
  }
}
