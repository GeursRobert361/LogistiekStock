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
import { getSupabaseClient } from '@/lib/supabase/client'
import {
  mapRequirement,
  mapRound,
  mapRoundItem,
  mapRoundStop,
  mapStopItem,
  stopItemToRow,
  mapDelivery,
  mapReservation,
  requirementToRow,
  roundToRow,
  roundItemToRow,
  roundStopToRow,
  deliveryToRow,
  reservationToRow,
} from '@/server/db/rowMappers'
import { unwrap, unwrapList, unwrapMaybe } from './supabaseHelpers'

type Row = Record<string, unknown>

export class SupabaseRestockRepository implements IRestockRepository {
  private get db() {
    return getSupabaseClient()
  }

  // ─── Behoeften ───────────────────────────────────────────────────────────

  async getRequirements(eventId: string): Promise<RestockRequirement[]> {
    const rows = unwrapList<Row>(
      await this.db.from('restock_requirements').select('*').eq('event_id', eventId)
    )
    return rows.map(mapRequirement)
  }

  async upsertRequirement(
    data: Omit<RestockRequirement, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<RestockRequirement> {
    const row = unwrap<Row>(
      await this.db
        .from('restock_requirements')
        .upsert(requirementToRow(data), { onConflict: 'event_id,kiosk_id,product_id' })
        .select()
        .single()
    )
    return mapRequirement(row)
  }

  async bulkUpsertRequirements(
    data: Array<Omit<RestockRequirement, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<RestockRequirement[]> {
    if (data.length === 0) return []
    const rows = unwrapList<Row>(
      await this.db
        .from('restock_requirements')
        .upsert(data.map(requirementToRow), { onConflict: 'event_id,kiosk_id,product_id' })
        .select()
    )
    return rows.map(mapRequirement)
  }

  async updateRequirement(
    id: string,
    data: Partial<RestockRequirement>
  ): Promise<RestockRequirement> {
    const row = unwrap<Row>(
      await this.db
        .from('restock_requirements')
        .update(requirementToRow(data))
        .eq('id', id)
        .select()
        .single()
    )
    return mapRequirement(row)
  }

  // ─── Vulrondes ───────────────────────────────────────────────────────────

  async getRounds(eventId: string): Promise<RestockRound[]> {
    const rows = unwrapList<Row>(
      await this.db.from('restock_rounds').select('*').eq('event_id', eventId).order('created_at')
    )
    return rows.map(mapRound)
  }

  async getRoundById(id: string): Promise<RestockRound | null> {
    const row = unwrapMaybe<Row>(
      await this.db.from('restock_rounds').select('*').eq('id', id).maybeSingle()
    )
    return row ? mapRound(row) : null
  }

  async createRound(data: Omit<RestockRound, 'createdAt' | 'updatedAt'>): Promise<RestockRound> {
    const row = unwrap<Row>(
      await this.db
        .from('restock_rounds')
        .upsert(roundToRow(data), { onConflict: 'id' })
        .select()
        .single()
    )
    return mapRound(row)
  }

  async updateRound(id: string, data: Partial<RestockRound>): Promise<RestockRound> {
    const row = unwrap<Row>(
      await this.db.from('restock_rounds').update(roundToRow(data)).eq('id', id).select().single()
    )
    return mapRound(row)
  }

  async getRoundItems(roundId: string): Promise<RestockRoundItem[]> {
    const rows = unwrapList<Row>(
      await this.db.from('restock_round_items').select('*').eq('restock_round_id', roundId)
    )
    return rows.map(mapRoundItem)
  }

  async upsertRoundItem(
    data: Omit<RestockRoundItem, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<RestockRoundItem> {
    const row = unwrap<Row>(
      await this.db
        .from('restock_round_items')
        .upsert(roundItemToRow(data), { onConflict: 'restock_round_id,product_id' })
        .select()
        .single()
    )
    return mapRoundItem(row)
  }

  async getRoundStops(roundId: string): Promise<RestockRoundStop[]> {
    const rows = unwrapList<Row>(
      await this.db
        .from('restock_round_stops')
        .select('*')
        .eq('restock_round_id', roundId)
        .order('sort_order')
    )
    return rows.map(mapRoundStop)
  }

  async createRoundStops(stops: Array<Omit<RestockRoundStop, 'id'>>): Promise<RestockRoundStop[]> {
    if (stops.length === 0) return []
    const rows = unwrapList<Row>(
      await this.db.from('restock_round_stops').insert(stops.map(roundStopToRow)).select()
    )
    return rows.map(mapRoundStop)
  }

  async updateStop(stopId: string, data: Partial<RestockRoundStop>): Promise<RestockRoundStop> {
    const row = unwrap<Row>(
      await this.db
        .from('restock_round_stops')
        .update(roundStopToRow(data))
        .eq('id', stopId)
        .select()
        .single()
    )
    return mapRoundStop(row)
  }

  async deleteRoundStops(roundId: string): Promise<void> {
    // stop items hangen met on delete cascade aan de haltes.
    const { error } = await this.db
      .from('restock_round_stops')
      .delete()
      .eq('restock_round_id', roundId)
    if (error) throw new Error(`[supabase] ${error.message}`)
  }

  async getStopItems(stopId: string): Promise<RestockStopItem[]> {
    const rows = unwrapList<Row>(
      await this.db.from('restock_stop_items').select('*').eq('restock_round_stop_id', stopId)
    )
    return rows.map(mapStopItem)
  }

  async getStopItemsForRound(roundId: string): Promise<RestockStopItem[]> {
    const stops = await this.getRoundStops(roundId)
    if (stops.length === 0) return []
    const rows = unwrapList<Row>(
      await this.db
        .from('restock_stop_items')
        .select('*')
        .in(
          'restock_round_stop_id',
          stops.map((s) => s.id)
        )
    )
    return rows.map(mapStopItem)
  }

  async createStopItems(
    items: Array<Omit<RestockStopItem, 'id' | 'createdAt'>>
  ): Promise<RestockStopItem[]> {
    if (items.length === 0) return []
    const rows = unwrapList<Row>(
      await this.db.from('restock_stop_items').insert(items.map(stopItemToRow)).select()
    )
    return rows.map(mapStopItem)
  }

  // ─── Leveringen ──────────────────────────────────────────────────────────

  async createDelivery(data: Omit<RestockDelivery, 'id' | 'createdAt'>): Promise<RestockDelivery> {
    const row = unwrap<Row>(
      await this.db.from('restock_deliveries').insert(deliveryToRow(data)).select().single()
    )
    return mapDelivery(row)
  }

  async getDeliveriesForStop(stopId: string): Promise<RestockDelivery[]> {
    const rows = unwrapList<Row>(
      await this.db.from('restock_deliveries').select('*').eq('restock_round_stop_id', stopId)
    )
    return rows.map(mapDelivery)
  }

  async getDeliveriesForRound(roundId: string): Promise<RestockDelivery[]> {
    const stops = await this.getRoundStops(roundId)
    if (stops.length === 0) return []
    const rows = unwrapList<Row>(
      await this.db
        .from('restock_deliveries')
        .select('*')
        .in(
          'restock_round_stop_id',
          stops.map((s) => s.id)
        )
    )
    return rows.map(mapDelivery)
  }

  // ─── Reserveringen ───────────────────────────────────────────────────────

  async createReservation(
    data: Omit<StockReservation, 'id' | 'createdAt'>
  ): Promise<StockReservation> {
    const row = unwrap<Row>(
      await this.db
        .from('stock_reservations')
        .upsert(reservationToRow(data), {
          onConflict: 'restock_requirement_id,restock_round_id',
        })
        .select()
        .single()
    )
    return mapReservation(row)
  }

  async getReservationsForRound(roundId: string): Promise<StockReservation[]> {
    const rows = unwrapList<Row>(
      await this.db.from('stock_reservations').select('*').eq('restock_round_id', roundId)
    )
    return rows.map(mapReservation)
  }

  async getReservationsForEvent(eventId: string): Promise<StockReservation[]> {
    const requirements = await this.getRequirements(eventId)
    if (requirements.length === 0) return []
    const rows = unwrapList<Row>(
      await this.db
        .from('stock_reservations')
        .select('*')
        .in(
          'restock_requirement_id',
          requirements.map((r) => r.id)
        )
    )
    return rows.map(mapReservation)
  }

  async releaseReservation(roundId: string, requirementId: string): Promise<void> {
    const { error } = await this.db
      .from('stock_reservations')
      .delete()
      .eq('restock_round_id', roundId)
      .eq('restock_requirement_id', requirementId)
    if (error) throw new Error(`[supabase] ${error.message}`)
  }

  async releaseReservationsForRound(roundId: string): Promise<void> {
    const { error } = await this.db
      .from('stock_reservations')
      .delete()
      .eq('restock_round_id', roundId)
    if (error) throw new Error(`[supabase] ${error.message}`)
  }
}
