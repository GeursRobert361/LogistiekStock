import type { IIncidentRepository, IncidentFilter } from '../interfaces/IIncidentRepository'
import type { Incident } from '@/types'
import { IncidentStatus } from '@/types'
import { getSupabaseClient } from '@/lib/supabase/client'
import { mapIncident, incidentToRow } from '@/server/db/rowMappers'
import { unwrap, unwrapList, unwrapMaybe } from './supabaseHelpers'

type Row = Record<string, unknown>

export class SupabaseIncidentRepository implements IIncidentRepository {
  private get db() {
    return getSupabaseClient()
  }

  async getIncidents(filter?: IncidentFilter): Promise<Incident[]> {
    let query = this.db.from('incidents').select('*')
    if (filter?.eventId) query = query.eq('event_id', filter.eventId)
    if (filter?.kioskId) query = query.eq('kiosk_id', filter.kioskId)
    if (filter?.status) query = query.eq('status', filter.status)
    if (filter?.openOnly) {
      query = query.not(
        'status',
        'in',
        `(${IncidentStatus.RESOLVED},${IncidentStatus.CLOSED})`
      )
    }
    const rows = unwrapList<Row>(await query.order('reported_at', { ascending: false }))
    return rows.map(mapIncident)
  }

  async getIncidentById(id: string): Promise<Incident | null> {
    const row = unwrapMaybe<Row>(
      await this.db.from('incidents').select('*').eq('id', id).maybeSingle()
    )
    return row ? mapIncident(row) : null
  }

  async createIncident(data: Omit<Incident, 'id' | 'createdAt' | 'updatedAt'>): Promise<Incident> {
    const row = unwrap<Row>(
      await this.db.from('incidents').insert(incidentToRow(data)).select().single()
    )
    return mapIncident(row)
  }

  async updateIncident(id: string, data: Partial<Incident>): Promise<Incident> {
    const row = unwrap<Row>(
      await this.db.from('incidents').update(incidentToRow(data)).eq('id', id).select().single()
    )
    return mapIncident(row)
  }
}
