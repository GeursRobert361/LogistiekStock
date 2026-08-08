import type { ICountRepository } from '@/repositories/interfaces/ICountRepository'
import { query, queryOne, queryRequired, buildUpdate, buildUpsert, transaction } from '@/server/db/pool'
import { ACTIVE_SESSION_STATUSES } from '@/domain/counting/sessionStatus'
import { BusinessRuleError } from '@/server/api/errors'
import {
  mapCountSession,
  mapKioskCount,
  mapCountEntry,
  countSessionToRow,
  kioskCountToRow,
  countEntryToRow,
} from '@/server/db/rowMappers'

export const countRepository: ICountRepository = {
  async getSessions(eventId) {
    const rows = await query(
      'select * from count_sessions where event_id = $1 order by started_at desc',
      [eventId]
    )
    return rows.map(mapCountSession)
  },

  async getSessionById(id) {
    const row = await queryOne('select * from count_sessions where id = $1', [id])
    return row ? mapCountSession(row) : null
  },

  async createSession(data) {
    return transaction(async (client) => {
      // Serialiseert het aanmaken per (evenement, ring). Twee tellers die op
      // hetzelfde moment op "starten" drukken komen hier achter elkaar langs,
      // zodat de tweede de eerste ziet staan.
      //
      // Een advisory lock in plaats van een unieke index: bestaande databases
      // kunnen al twee actieve rondes voor dezelfde ring bevatten, en zo'n
      // index zou dan niet aan te maken zijn zonder die gegevens te verbouwen.
      await client.query('select pg_advisory_xact_lock(hashtext($1))', [
        `count-session:${data.eventId}:${data.ringId}`,
      ])

      const conflicting = await client.query(
        `select id from count_sessions
          where event_id = $1 and ring_id = $2 and id <> $3 and status = any($4::text[])
          limit 1`,
        [data.eventId, data.ringId, data.id, [...ACTIVE_SESSION_STATUSES]]
      )
      if (conflicting.rows.length > 0) {
        throw new BusinessRuleError('Voor deze ring loopt al een telronde.')
      }

      // Upsert op id: een herhaalde poging vanuit de outbox mag geen tweede
      // telronde opleveren.
      const { text, params } = buildUpsert('count_sessions', countSessionToRow(data), ['id'])
      return mapCountSession((await client.query(text, params)).rows[0] as Record<string, unknown>)
    })
  },

  async updateSession(id, data) {
    const statement = buildUpdate('count_sessions', countSessionToRow(data), id)
    if (!statement) {
      return mapCountSession(await queryRequired('select * from count_sessions where id = $1', [id]))
    }
    return mapCountSession(await queryRequired(statement.text, statement.params))
  },

  async updateSessionStatus(id, status) {
    return this.updateSession(id, { status })
  },

  async getKioskCountsForSession(sessionId) {
    const rows = await query('select * from kiosk_counts where count_session_id = $1', [sessionId])
    return rows.map(mapKioskCount)
  },

  async upsertKioskCount(data) {
    const { text, params } = buildUpsert('kiosk_counts', kioskCountToRow(data), [
      'count_session_id',
      'kiosk_id',
    ])
    return mapKioskCount(await queryRequired(text, params))
  },

  async getEntriesForKioskCount(kioskCountId) {
    const rows = await query('select * from count_entries where kiosk_count_id = $1', [kioskCountId])
    return rows.map(mapCountEntry)
  },

  async getEntriesForSession(sessionId) {
    const rows = await query(
      `select e.* from count_entries e
       join kiosk_counts k on k.id = e.kiosk_count_id
       where k.count_session_id = $1`,
      [sessionId]
    )
    return rows.map(mapCountEntry)
  },

  async upsertCountEntry(data) {
    const { text, params } = buildUpsert('count_entries', countEntryToRow(data), [
      'kiosk_count_id',
      'product_id',
    ])
    return mapCountEntry(await queryRequired(text, params))
  },

  async bulkUpsertCountEntries(entries) {
    if (entries.length === 0) return
    await transaction(async (client) => {
      for (const entry of entries) {
        const { text, params } = buildUpsert('count_entries', countEntryToRow(entry), [
          'kiosk_count_id',
          'product_id',
        ])
        await client.query(text, params)
      }
    })
  },

  async deleteCountEntry(kioskCountId, productId) {
    await query('delete from count_entries where kiosk_count_id = $1 and product_id = $2', [
      kioskCountId,
      productId,
    ])
  },
}
