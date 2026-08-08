import type {
  IRestockRepository,
  ReserveRoundInput,
  ReserveRoundResult,
} from '@/repositories/interfaces/IRestockRepository'
import type {
  RestockRequirement,
  RestockRound,
  RestockRoundItem,
  RestockRoundStop,
  RestockStopItem,
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
  stopItems: RestockStopItem[] = []
  deliveries: RestockDelivery[] = []
  reservations: StockReservation[] = []

  reset(): void {
    this.requirements = []
    this.rounds = []
    this.items = []
    this.stops = []
    this.stopItems = []
    this.deliveries = []
    this.reservations = []
    this.reservationLock = Promise.resolve()
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

  async deleteRoundStops(roundId: string): Promise<void> {
    const stopIds = new Set(this.stops.filter((s) => s.restockRoundId === roundId).map((s) => s.id))
    this.stops = this.stops.filter((s) => !stopIds.has(s.id))
    this.stopItems = this.stopItems.filter((i) => !stopIds.has(i.restockRoundStopId))
  }

  async getStopItems(stopId: string): Promise<RestockStopItem[]> {
    return this.stopItems.filter((i) => i.restockRoundStopId === stopId)
  }

  async getStopItemsForRound(roundId: string): Promise<RestockStopItem[]> {
    const stopIds = new Set(this.stops.filter((s) => s.restockRoundId === roundId).map((s) => s.id))
    return this.stopItems.filter((i) => stopIds.has(i.restockRoundStopId))
  }

  async createStopItems(
    items: Array<Omit<RestockStopItem, 'id' | 'createdAt'>>
  ): Promise<RestockStopItem[]> {
    const created = items.map((item) => ({
      ...item,
      id: newId(),
      createdAt: new Date().toISOString(),
    }))
    this.stopItems.push(...created)
    return created
  }

  async createDelivery(data: RestockDelivery): Promise<RestockDelivery> {
    // Idempotent, net als de echte repositories: de levering wordt zowel
    // rechtstreeks als via de outbox aangeboden.
    const existing = this.deliveries.find((d) => d.id === data.id)
    if (existing) return existing

    const delivery: RestockDelivery = {
      ...data,
      createdAt: data.createdAt || new Date().toISOString(),
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

  /**
   * Bootst `select ... for update` na: aanroepen worden achter elkaar
   * afgehandeld, zodat de tweede het resultaat van de eerste ziet. Zonder die
   * serialisatie zou een test over gelijktijdig reserveren niets bewijzen.
   */
  private reservationLock: Promise<unknown> = Promise.resolve()

  async reserveRoundAtomic(input: ReserveRoundInput): Promise<ReserveRoundResult> {
    const next = this.reservationLock.then(() => this.reserveExclusively(input))
    this.reservationLock = next.catch(() => undefined)
    return next
  }

  private async reserveExclusively({
    round,
    kioskIds,
    productIds,
  }: ReserveRoundInput): Promise<ReserveRoundResult> {
    const kiosks = new Set(kioskIds)
    const products = new Set(productIds)

    const claimable = this.requirements
      .filter(
        (requirement) =>
          requirement.eventId === round.eventId &&
          kiosks.has(requirement.kioskId) &&
          products.has(requirement.productId)
      )
      .map((requirement) => ({
        requirement,
        packages:
          requirement.requiredPackages -
          requirement.deliveredPackages -
          requirement.reservedPackages,
      }))
      .filter((entry) => entry.packages > 0)

    if (claimable.length === 0) return { ok: false, reason: 'NOTHING_AVAILABLE' }

    const createdRound = await this.createRound(round)
    const reservations: StockReservation[] = []
    const proposedByProduct = new Map<string, number>()

    for (const { requirement, packages } of claimable) {
      reservations.push(
        await this.createReservation({
          restockRequirementId: requirement.id,
          restockRoundId: createdRound.id,
          reservedPackages: packages,
        })
      )
      await this.updateRequirement(requirement.id, {
        reservedPackages: requirement.reservedPackages + packages,
      })
      proposedByProduct.set(
        requirement.productId,
        (proposedByProduct.get(requirement.productId) ?? 0) + packages
      )
    }

    const items: RestockRoundItem[] = []
    for (const [productId, proposed] of proposedByProduct) {
      items.push(
        await this.upsertRoundItem({
          restockRoundId: createdRound.id,
          productId,
          proposedPackages: proposed,
          loadedPackages: proposed,
          deliveredPackages: 0,
        })
      )
    }

    return { ok: true, round: createdRound, items, reservations }
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
