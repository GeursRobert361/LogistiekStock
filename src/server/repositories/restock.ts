import type { IRestockRepository } from '@/repositories/interfaces/IRestockRepository'
import { query, queryOne, queryRequired, buildUpdate, buildUpsert, transaction } from '@/server/db/pool'
import {
  mapRequirement,
  mapRound,
  mapRoundItem,
  mapRoundStop,
  mapStopItem,
  mapDelivery,
  mapReservation,
  requirementToRow,
  roundToRow,
  roundItemToRow,
  roundStopToRow,
  stopItemToRow,
  deliveryToRow,
  reservationToRow,
} from '@/server/db/rowMappers'

export const restockRepository: IRestockRepository = {
  // ─── Behoeften ─────────────────────────────────────────────────────────────

  async getRequirements(eventId) {
    const rows = await query('select * from restock_requirements where event_id = $1', [eventId])
    return rows.map(mapRequirement)
  },

  async upsertRequirement(data) {
    const { text, params } = buildUpsert('restock_requirements', requirementToRow(data), [
      'event_id',
      'kiosk_id',
      'product_id',
    ])
    return mapRequirement(await queryRequired(text, params))
  },

  async bulkUpsertRequirements(data) {
    if (data.length === 0) return []
    return transaction(async (client) => {
      const saved = []
      for (const item of data) {
        const { text, params } = buildUpsert('restock_requirements', requirementToRow(item), [
          'event_id',
          'kiosk_id',
          'product_id',
        ])
        const result = await client.query(text, params)
        saved.push(mapRequirement(result.rows[0] as Record<string, unknown>))
      }
      return saved
    })
  },

  async updateRequirement(id, data) {
    const statement = buildUpdate('restock_requirements', requirementToRow(data), id)
    if (!statement) {
      return mapRequirement(
        await queryRequired('select * from restock_requirements where id = $1', [id])
      )
    }
    return mapRequirement(await queryRequired(statement.text, statement.params))
  },

  // ─── Vulrondes ─────────────────────────────────────────────────────────────

  async getRounds(eventId) {
    const rows = await query(
      'select * from restock_rounds where event_id = $1 order by created_at',
      [eventId]
    )
    return rows.map(mapRound)
  },

  async getRoundById(id) {
    const row = await queryOne('select * from restock_rounds where id = $1', [id])
    return row ? mapRound(row) : null
  },

  async createRound(data) {
    const { text, params } = buildUpsert('restock_rounds', roundToRow(data), ['id'])
    return mapRound(await queryRequired(text, params))
  },

  async updateRound(id, data) {
    const statement = buildUpdate('restock_rounds', roundToRow(data), id)
    if (!statement) {
      return mapRound(await queryRequired('select * from restock_rounds where id = $1', [id]))
    }
    return mapRound(await queryRequired(statement.text, statement.params))
  },

  async getRoundItems(roundId) {
    const rows = await query('select * from restock_round_items where restock_round_id = $1', [
      roundId,
    ])
    return rows.map(mapRoundItem)
  },

  async upsertRoundItem(data) {
    const { text, params } = buildUpsert('restock_round_items', roundItemToRow(data), [
      'restock_round_id',
      'product_id',
    ])
    return mapRoundItem(await queryRequired(text, params))
  },

  // ─── Haltes ────────────────────────────────────────────────────────────────

  async getRoundStops(roundId) {
    const rows = await query(
      'select * from restock_round_stops where restock_round_id = $1 order by sort_order',
      [roundId]
    )
    return rows.map(mapRoundStop)
  },

  async createRoundStops(stops) {
    if (stops.length === 0) return []
    return transaction(async (client) => {
      const created = []
      for (const stop of stops) {
        const row = roundStopToRow(stop)
        const columns = Object.keys(row)
        const result = await client.query(
          `insert into restock_round_stops (${columns.join(', ')}) values (${columns
            .map((_, i) => `$${i + 1}`)
            .join(', ')}) returning *`,
          Object.values(row)
        )
        created.push(mapRoundStop(result.rows[0] as Record<string, unknown>))
      }
      return created
    })
  },

  async updateStop(stopId, data) {
    const statement = buildUpdate('restock_round_stops', roundStopToRow(data), stopId)
    if (!statement) {
      return mapRoundStop(
        await queryRequired('select * from restock_round_stops where id = $1', [stopId])
      )
    }
    return mapRoundStop(await queryRequired(statement.text, statement.params))
  },

  async deleteRoundStops(roundId) {
    // stop items hangen met on delete cascade aan de haltes.
    await query('delete from restock_round_stops where restock_round_id = $1', [roundId])
  },

  async getStopItems(stopId) {
    const rows = await query('select * from restock_stop_items where restock_round_stop_id = $1', [
      stopId,
    ])
    return rows.map(mapStopItem)
  },

  async getStopItemsForRound(roundId) {
    const rows = await query(
      `select i.* from restock_stop_items i
       join restock_round_stops s on s.id = i.restock_round_stop_id
       where s.restock_round_id = $1`,
      [roundId]
    )
    return rows.map(mapStopItem)
  },

  async createStopItems(items) {
    if (items.length === 0) return []
    return transaction(async (client) => {
      const created = []
      for (const item of items) {
        const row = stopItemToRow(item)
        const columns = Object.keys(row)
        const result = await client.query(
          `insert into restock_stop_items (${columns.join(', ')}) values (${columns
            .map((_, i) => `$${i + 1}`)
            .join(', ')}) returning *`,
          Object.values(row)
        )
        created.push(mapStopItem(result.rows[0] as Record<string, unknown>))
      }
      return created
    })
  },

  // ─── Leveringen ────────────────────────────────────────────────────────────

  async createDelivery(data) {
    const row = deliveryToRow(data)
    const columns = Object.keys(row)

    // De levering wordt rechtstreeks weggeschreven én belandt in de outbox;
    // zonder deze conflictregel staat er daarna twee keer hetzelfde ("16 van 8
    // geleverd"). Het id van de client maakt de tweede poging een no-op.
    const inserted = await queryOne(
      `insert into restock_deliveries (${columns.join(', ')}) values (${columns
        .map((_, i) => `$${i + 1}`)
        .join(', ')})
       on conflict (id) do nothing
       returning *`,
      Object.values(row)
    )
    if (inserted) return mapDelivery(inserted)

    return mapDelivery(
      await queryRequired('select * from restock_deliveries where id = $1', [data.id])
    )
  },

  async getDeliveriesForStop(stopId) {
    const rows = await query('select * from restock_deliveries where restock_round_stop_id = $1', [
      stopId,
    ])
    return rows.map(mapDelivery)
  },

  async getDeliveriesForRound(roundId) {
    const rows = await query(
      `select d.* from restock_deliveries d
       join restock_round_stops s on s.id = d.restock_round_stop_id
       where s.restock_round_id = $1`,
      [roundId]
    )
    return rows.map(mapDelivery)
  },

  // ─── Reserveringen ─────────────────────────────────────────────────────────

  async createReservation(data) {
    const { text, params } = buildUpsert('stock_reservations', reservationToRow(data), [
      'restock_requirement_id',
      'restock_round_id',
    ])
    return mapReservation(await queryRequired(text, params))
  },

  async getReservationsForRound(roundId) {
    const rows = await query('select * from stock_reservations where restock_round_id = $1', [
      roundId,
    ])
    return rows.map(mapReservation)
  },

  async getReservationsForEvent(eventId) {
    const rows = await query(
      `select r.* from stock_reservations r
       join restock_requirements q on q.id = r.restock_requirement_id
       where q.event_id = $1`,
      [eventId]
    )
    return rows.map(mapReservation)
  },

  async releaseReservation(roundId, requirementId) {
    await query(
      'delete from stock_reservations where restock_round_id = $1 and restock_requirement_id = $2',
      [roundId, requirementId]
    )
  },

  async releaseReservationsForRound(roundId) {
    await query('delete from stock_reservations where restock_round_id = $1', [roundId])
  },
}
