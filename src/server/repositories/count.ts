import type { ICountRepository } from '@/repositories/interfaces/ICountRepository'
import { query, queryOne, queryRequired, buildUpdate, buildUpsert, transaction } from '@/server/db/pool'
import { ACTIVE_SESSION_STATUSES, blocksSessionWrite } from '@/domain/counting/sessionStatus'
import { BusinessRuleError, ValidationError } from '@/server/api/errors'
import {
  mapCountSession,
  mapKioskCount,
  mapCountEntry,
  countSessionToRow,
  kioskCountToRow,
  countEntryToRow,
} from '@/server/db/rowMappers'

/**
 * Weigert werk dat hoort bij een telronde die is weggegooid.
 *
 * Een telefoon die offline stond kan nog regels in de wachtrij hebben staan
 * voor een ronde die inmiddels verdwenen is. Zonder deze controle loopt zo'n
 * regel stuk op een sleutelfout — een 500 — en dat leest de outbox als een
 * storing: hij blijft het eeuwig opnieuw proberen. Erger nog, als de rij wél
 * doorkwam zou de ronde half herrijzen zonder dat iemand hem geteld heeft.
 *
 * Een 400 stopt de poging definitief en laat de rest van de wachtrij door.
 */
async function assertParentExists(
  table: 'count_sessions' | 'kiosk_counts',
  id: string,
  melding: string
): Promise<void> {
  const row = await queryOne<{ id: string }>(`select id from ${table} where id = $1`, [id])
  if (!row) throw new ValidationError(melding)
}

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

      // Bestaat de ronde al, dan is dit een bijwerking en geen nieuwe. De
      // outbox schrijft elke wijziging weg met deze zelfde aanroep; die
      // tegenhouden zou een lopende telling van de server afsnijden.
      const [existing, conflicting] = await Promise.all([
        client.query('select 1 from count_sessions where id = $1', [data.id]),
        client.query(
          `select id from count_sessions
            where event_id = $1 and ring_id = $2 and id <> $3 and status = any($4::text[])
            limit 1`,
          [data.eventId, data.ringId, data.id, [...ACTIVE_SESSION_STATUSES]]
        ),
      ])

      if (
        blocksSessionWrite({
          isExisting: existing.rows.length > 0,
          hasConflictingActiveSession: conflicting.rows.length > 0,
        })
      ) {
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
    await assertParentExists(
      'count_sessions',
      data.countSessionId,
      'Deze telronde bestaat niet meer.'
    )

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
    await assertParentExists(
      'kiosk_counts',
      data.kioskCountId,
      'Deze kiosktelling bestaat niet meer.'
    )

    const { text, params } = buildUpsert('count_entries', countEntryToRow(data), [
      'kiosk_count_id',
      'product_id',
    ])
    return mapCountEntry(await queryRequired(text, params))
  },

  async bulkUpsertCountEntries(entries) {
    if (entries.length === 0) return

    // Eén controle per kiosktelling, niet per regel: een lijst van vijftien
    // producten hoort dezelfde ouder te hebben.
    for (const kioskCountId of new Set(entries.map((entry) => entry.kioskCountId))) {
      await assertParentExists('kiosk_counts', kioskCountId, 'Deze kiosktelling bestaat niet meer.')
    }

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

  // Kiosktellingen en telregels hangen met on delete cascade aan de ronde, dus
  // één regel volstaat. De bijvulbehoeften niet: die hangen aan het evenement
  // en worden door de service opgeruimd, waar ook bekend is welke er al
  // gereserveerd zijn.
  async deleteSession(id) {
    await query('delete from count_sessions where id = $1', [id])
  },

  async deleteKioskCount(kioskCountId) {
    await query('delete from kiosk_counts where id = $1', [kioskCountId])
  },
}
