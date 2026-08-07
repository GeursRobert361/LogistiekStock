import type { IEventRepository } from '@/repositories/interfaces/IEventRepository'
import type { Event } from '@/types'
import { query, queryOne, queryRequired, buildUpdate, transaction } from '@/server/db/pool'
import { mapEvent, eventToRow } from '@/server/db/rowMappers'

interface Relations {
  ringIds: string[]
  kioskIds: string[]
  userIds: string[]
}

const EMPTY: Relations = { ringIds: [], kioskIds: [], userIds: [] }

async function loadRelations(eventIds: string[]): Promise<Map<string, Relations>> {
  const result = new Map<string, Relations>(
    eventIds.map((id) => [id, { ringIds: [], kioskIds: [], userIds: [] }])
  )
  if (eventIds.length === 0) return result

  const [ringRows, kioskRows, userRows] = await Promise.all([
    query('select event_id, ring_id from event_rings where event_id = any($1::uuid[])', [eventIds]),
    query(
      'select event_id, kiosk_id from event_kiosks where event_id = any($1::uuid[]) and is_open = true',
      [eventIds]
    ),
    query('select event_id, profile_id from event_users where event_id = any($1::uuid[])', [
      eventIds,
    ]),
  ])

  for (const row of ringRows) result.get(String(row.event_id))?.ringIds.push(String(row.ring_id))
  for (const row of kioskRows) result.get(String(row.event_id))?.kioskIds.push(String(row.kiosk_id))
  for (const row of userRows) result.get(String(row.event_id))?.userIds.push(String(row.profile_id))

  return result
}

/** Vervangt de koppelrijen van één evenement binnen de lopende transactie. */
async function replaceRelations(
  client: { query: (text: string, params?: unknown[]) => Promise<unknown> },
  eventId: string,
  data: Partial<Event>
): Promise<void> {
  if (data.activeRingIds) {
    await client.query('delete from event_rings where event_id = $1', [eventId])
    for (const ringId of data.activeRingIds) {
      await client.query('insert into event_rings (event_id, ring_id) values ($1, $2)', [
        eventId,
        ringId,
      ])
    }
  }

  if (data.activeKioskIds) {
    await client.query('delete from event_kiosks where event_id = $1', [eventId])
    for (const kioskId of data.activeKioskIds) {
      await client.query(
        'insert into event_kiosks (event_id, kiosk_id, is_open) values ($1, $2, true)',
        [eventId, kioskId]
      )
    }
  }

  if (data.assignedUserIds) {
    await client.query('delete from event_users where event_id = $1', [eventId])
    for (const profileId of data.assignedUserIds) {
      await client.query('insert into event_users (event_id, profile_id) values ($1, $2)', [
        eventId,
        profileId,
      ])
    }
  }
}

export const eventRepository: IEventRepository = {
  async getEvents(options) {
    const rows = options?.status
      ? await query('select * from events where status = $1 order by date', [options.status])
      : await query('select * from events order by date')

    const relations = await loadRelations(rows.map((row) => String(row.id)))
    return rows.map((row) => mapEvent(row, relations.get(String(row.id)) ?? EMPTY))
  },

  async getEventById(id) {
    const row = await queryOne('select * from events where id = $1', [id])
    if (!row) return null
    const relations = await loadRelations([id])
    return mapEvent(row, relations.get(id) ?? EMPTY)
  },

  async createEvent(data) {
    const row = eventToRow(data)
    const columns = Object.keys(row)

    const eventId = await transaction(async (client) => {
      const inserted = await client.query<{ id: string }>(
        `insert into events (${columns.join(', ')}) values (${columns
          .map((_, i) => `$${i + 1}`)
          .join(', ')}) returning id`,
        Object.values(row)
      )
      const id = inserted.rows[0]!.id
      await replaceRelations(client, id, data)
      return id
    })

    const created = await this.getEventById(eventId)
    if (!created) throw new Error('Evenement aangemaakt maar niet terug te lezen.')
    return created
  },

  async updateEvent(id, data) {
    await transaction(async (client) => {
      const statement = buildUpdate('events', eventToRow(data), id)
      if (statement) await client.query(statement.text, statement.params)
      await replaceRelations(client, id, data)
    })

    const updated = await this.getEventById(id)
    if (!updated) throw new Error(`Evenement niet gevonden: ${id}`)
    return updated
  },

  async updateEventStatus(id, status) {
    return this.updateEvent(id, { status })
  },

  async deleteEvent(id) {
    await queryRequired('delete from events where id = $1 returning id', [id])
  },
}
