import type {
  RestockRequirement,
  RestockRound,
  RestockRoundItem,
  RestockRoundStop,
  RestockDelivery,
  StockReservation,
} from '@/types'

export interface IRestockRepository {
  getRequirements(eventId: string): Promise<RestockRequirement[]>
  upsertRequirement(data: Omit<RestockRequirement, 'id' | 'createdAt' | 'updatedAt'>): Promise<RestockRequirement>
  bulkUpsertRequirements(data: Array<Omit<RestockRequirement, 'id' | 'createdAt' | 'updatedAt'>>): Promise<void>

  getRounds(eventId: string): Promise<RestockRound[]>
  getRoundById(id: string): Promise<RestockRound | null>
  createRound(data: Omit<RestockRound, 'id' | 'createdAt' | 'updatedAt'>): Promise<RestockRound>
  updateRound(id: string, data: Partial<RestockRound>): Promise<RestockRound>

  getRoundItems(roundId: string): Promise<RestockRoundItem[]>
  upsertRoundItem(data: Omit<RestockRoundItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<RestockRoundItem>

  getRoundStops(roundId: string): Promise<RestockRoundStop[]>
  createRoundStops(stops: Omit<RestockRoundStop, 'id'>[]): Promise<RestockRoundStop[]>
  completeStop(stopId: string): Promise<RestockRoundStop>

  createDelivery(data: Omit<RestockDelivery, 'id' | 'createdAt'>): Promise<RestockDelivery>
  getDeliveriesForStop(stopId: string): Promise<RestockDelivery[]>

  createReservation(data: Omit<StockReservation, 'id' | 'createdAt'>): Promise<StockReservation>
  releaseReservation(roundId: string, requirementId: string): Promise<void>
}
