import type { IKioskRepository } from '@/repositories/interfaces/IKioskRepository'
import type { Kiosk, Ring } from '@/types'
import { query, queryOne, queryRequired, buildUpdate, transaction, type Row } from '@/server/db/pool'
import { mapKiosk, mapRing, kioskToRow, ringToRow } from '@/server/db/rowMappers'

export const kioskRepository: IKioskRepository = {
  async getRings(options) {
    const rows = await query(
      options?.includeInactive === true
        ? 'select * from rings order by sort_order'
        : 'select * from rings where is_active = true order by sort_order'
    )
    return rows.map(mapRing)
  },

  async getRingById(id) {
    const row = await queryOne('select * from rings where id = $1', [id])
    return row ? mapRing(row) : null
  },

  async createRing(data) {
    const row = ringToRow(data)
    const columns = Object.keys(row)
    const created = await queryRequired(
      `insert into rings (${columns.join(', ')}) values (${columns
        .map((_, i) => `$${i + 1}`)
        .join(', ')}) returning *`,
      Object.values(row)
    )
    return mapRing(created)
  },

  async updateRing(id, data) {
    const statement = buildUpdate('rings', ringToRow(data), id)
    if (!statement) return (await this.getRingById(id)) as Ring
    return mapRing(await queryRequired(statement.text, statement.params))
  },

  async getKiosks(ringId, options) {
    const conditions: string[] = []
    const params: unknown[] = []

    if (options?.includeInactive !== true) conditions.push('is_active = true')
    if (ringId) {
      params.push(ringId)
      conditions.push(`ring_id = $${params.length}`)
    }
    conditions.push('deleted_at is null')

    const rows = await query(
      `select * from kiosks where ${conditions.join(' and ')} order by sort_order`,
      params
    )
    return rows.map(mapKiosk)
  },

  async getKioskById(id) {
    const row = await queryOne('select * from kiosks where id = $1', [id])
    return row ? mapKiosk(row) : null
  },

  async getKiosksByEvent(eventId) {
    // Left join: kiosken die niet aan het evenement hangen tellen als gesloten.
    const rows = await query(
      `select k.*, coalesce(ek.is_open, false) as is_open_for_event
       from kiosks k
       left join event_kiosks ek on ek.kiosk_id = k.id and ek.event_id = $1
       where k.is_active = true and k.deleted_at is null
       order by k.sort_order`,
      [eventId]
    )
    return rows.map((row) => ({
      ...mapKiosk(row),
      isOpenForEvent: row.is_open_for_event === true,
    }))
  },

  async createKiosk(data) {
    const row = kioskToRow(data)
    const columns = Object.keys(row)
    const created = await queryRequired(
      `insert into kiosks (${columns.join(', ')}) values (${columns
        .map((_, i) => `$${i + 1}`)
        .join(', ')}) returning *`,
      Object.values(row)
    )
    return mapKiosk(created)
  },

  async updateKiosk(id, data) {
    const statement = buildUpdate('kiosks', kioskToRow(data), id)
    if (!statement) return (await this.getKioskById(id)) as Kiosk
    return mapKiosk(await queryRequired(statement.text, statement.params))
  },

  async deleteKiosk(id) {
    await this.updateKiosk(id, { isActive: false })
  },

  async updateEventKiosks(eventId, kioskIds, openIds) {
    // In één transactie: anders kan een halve koppeling achterblijven waardoor
    // kiosken onterecht als gesloten gelden.
    const openSet = new Set(openIds)
    await transaction(async (client) => {
      await client.query('delete from event_kiosks where event_id = $1', [eventId])
      for (const kioskId of kioskIds) {
        await client.query(
          'insert into event_kiosks (event_id, kiosk_id, is_open) values ($1, $2, $3)',
          [eventId, kioskId, openSet.has(kioskId)]
        )
      }
    })
  },
}

/** Alleen voor de seed: kiosk opzoeken op ring en nummer. */
export async function findKioskByNumber(ringId: string, number: number): Promise<Row | null> {
  return queryOne('select * from kiosks where ring_id = $1 and number = $2', [ringId, number])
}
