import type { IIncidentRepository } from '@/repositories/interfaces/IIncidentRepository'
import { IncidentStatus } from '@/types'
import { query, queryOne, queryRequired, buildUpdate } from '@/server/db/pool'
import { mapIncident, incidentToRow } from '@/server/db/rowMappers'

export const incidentRepository: IIncidentRepository = {
  async getIncidents(filter) {
    const conditions: string[] = []
    const params: unknown[] = []

    if (filter?.eventId) {
      params.push(filter.eventId)
      conditions.push(`event_id = $${params.length}`)
    }
    if (filter?.kioskId) {
      params.push(filter.kioskId)
      conditions.push(`kiosk_id = $${params.length}`)
    }
    if (filter?.status) {
      params.push(filter.status)
      conditions.push(`status = $${params.length}`)
    }
    if (filter?.openOnly) {
      params.push([IncidentStatus.RESOLVED, IncidentStatus.CLOSED])
      conditions.push(`status <> all($${params.length}::text[])`)
    }

    const where = conditions.length > 0 ? `where ${conditions.join(' and ')}` : ''
    const rows = await query(
      `select * from incidents ${where} order by reported_at desc`,
      params
    )
    return rows.map(mapIncident)
  },

  async getIncidentById(id) {
    const row = await queryOne('select * from incidents where id = $1', [id])
    return row ? mapIncident(row) : null
  },

  async createIncident(data) {
    const row = incidentToRow(data)
    const columns = Object.keys(row)
    return mapIncident(
      await queryRequired(
        `insert into incidents (${columns.join(', ')}) values (${columns
          .map((_, i) => `$${i + 1}`)
          .join(', ')}) returning *`,
        Object.values(row)
      )
    )
  },

  async updateIncident(id, data) {
    const statement = buildUpdate('incidents', incidentToRow(data), id)
    if (!statement) {
      return mapIncident(await queryRequired('select * from incidents where id = $1', [id]))
    }
    return mapIncident(await queryRequired(statement.text, statement.params))
  },
}
