import type {
  RestockRequirement,
  RestockRound,
  RestockRoundItem,
  RestockRoundStop,
  RestockStopItem,
  RestockDelivery,
  StockReservation,
} from '@/types'

export interface IRestockRepository {
  // ─── Behoeften (bijvullijst) ───────────────────────────────────────────────
  getRequirements(eventId: string): Promise<RestockRequirement[]>
  upsertRequirement(
    data: Omit<RestockRequirement, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<RestockRequirement>
  bulkUpsertRequirements(
    data: Array<Omit<RestockRequirement, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<RestockRequirement[]>
  updateRequirement(id: string, data: Partial<RestockRequirement>): Promise<RestockRequirement>

  // ─── Vulrondes ─────────────────────────────────────────────────────────────
  getRounds(eventId: string): Promise<RestockRound[]>
  getRoundById(id: string): Promise<RestockRound | null>
  createRound(data: Omit<RestockRound, 'createdAt' | 'updatedAt'>): Promise<RestockRound>
  updateRound(id: string, data: Partial<RestockRound>): Promise<RestockRound>

  getRoundItems(roundId: string): Promise<RestockRoundItem[]>
  upsertRoundItem(
    data: Omit<RestockRoundItem, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<RestockRoundItem>

  getRoundStops(roundId: string): Promise<RestockRoundStop[]>
  createRoundStops(stops: Array<Omit<RestockRoundStop, 'id'>>): Promise<RestockRoundStop[]>
  updateStop(stopId: string, data: Partial<RestockRoundStop>): Promise<RestockRoundStop>
  deleteRoundStops(roundId: string): Promise<void>

  getStopItems(stopId: string): Promise<RestockStopItem[]>
  getStopItemsForRound(roundId: string): Promise<RestockStopItem[]>
  createStopItems(items: Array<Omit<RestockStopItem, 'id' | 'createdAt'>>): Promise<RestockStopItem[]>

  // ─── Leveringen ────────────────────────────────────────────────────────────
  /**
   * Legt een levering vast. Het id komt van de client en de aanroep is
   * idempotent: dezelfde levering twee keer wegschrijven — rechtstreeks én
   * later nog eens vanuit de outbox — levert één regel op.
   */
  createDelivery(data: RestockDelivery): Promise<RestockDelivery>
  getDeliveriesForStop(stopId: string): Promise<RestockDelivery[]>
  getDeliveriesForRound(roundId: string): Promise<RestockDelivery[]>

  // ─── Reserveringen ─────────────────────────────────────────────────────────
  createReservation(data: Omit<StockReservation, 'id' | 'createdAt'>): Promise<StockReservation>
  getReservationsForRound(roundId: string): Promise<StockReservation[]>
  getReservationsForEvent(eventId: string): Promise<StockReservation[]>
  releaseReservation(roundId: string, requirementId: string): Promise<void>
  releaseReservationsForRound(roundId: string): Promise<void>
}
