import type { IEventRepository } from '../interfaces/IEventRepository'
import type { Event } from '@/types'
import { EventStatus } from '@/types'
import { getSupabaseClient } from '@/lib/supabase/client'
import { mapEvent, eventToRow } from '@/server/db/rowMappers'
import { unwrap, unwrapList, unwrapMaybe } from './supabaseHelpers'

type Row = Record<string, unknown>

export class SupabaseEventRepository implements IEventRepository {
  private get db() {
    return getSupabaseClient()
  }

  async getEvents(options?: { status?: EventStatus }): Promise<Event[]> {
    let query = this.db.from('events').select('*')
    if (options?.status) query = query.eq('status', options.status)
    const rows = unwrapList<Row>(await query.order('date'))
    if (rows.length === 0) return []

    const eventIds = rows.map((row) => String(row.id))
    const relations = await this.loadRelations(eventIds)
    return rows.map((row) =>
      mapEvent(row, relations.get(String(row.id)) ?? { ringIds: [], kioskIds: [], userIds: [] })
    )
  }

  async getEventById(id: string): Promise<Event | null> {
    const row = unwrapMaybe<Row>(await this.db.from('events').select('*').eq('id', id).maybeSingle())
    if (!row) return null
    const relations = await this.loadRelations([id])
    return mapEvent(row, relations.get(id) ?? { ringIds: [], kioskIds: [], userIds: [] })
  }

  async createEvent(data: Omit<Event, 'id' | 'createdAt' | 'updatedAt'>): Promise<Event> {
    const row = unwrap<Row>(await this.db.from('events').insert(eventToRow(data)).select().single())
    const eventId = String(row.id)
    await this.writeRelations(eventId, data)
    const created = await this.getEventById(eventId)
    if (!created) throw new Error('Evenement aangemaakt maar niet terug te lezen.')
    return created
  }

  async updateEvent(id: string, data: Partial<Event>): Promise<Event> {
    const row = eventToRow(data)
    if (Object.keys(row).length > 0) {
      const { error } = await this.db.from('events').update(row).eq('id', id)
      if (error) throw new Error(`[supabase] ${error.message}`)
    }
    await this.writeRelations(id, data)
    const updated = await this.getEventById(id)
    if (!updated) throw new Error(`Evenement niet gevonden: ${id}`)
    return updated
  }

  async updateEventStatus(id: string, status: EventStatus): Promise<Event> {
    return this.updateEvent(id, { status })
  }

  async deleteEvent(id: string): Promise<void> {
    const { error } = await this.db.from('events').delete().eq('id', id)
    if (error) throw new Error(`[supabase] ${error.message}`)
  }

  private async loadRelations(
    eventIds: string[]
  ): Promise<Map<string, { ringIds: string[]; kioskIds: string[]; userIds: string[] }>> {
    const [ringRows, kioskRows, userRows] = await Promise.all([
      unwrapList<Row>(
        await this.db.from('event_rings').select('event_id, ring_id').in('event_id', eventIds)
      ),
      unwrapList<Row>(
        await this.db
          .from('event_kiosks')
          .select('event_id, kiosk_id')
          .in('event_id', eventIds)
          .eq('is_open', true)
      ),
      unwrapList<Row>(
        await this.db.from('event_users').select('event_id, profile_id').in('event_id', eventIds)
      ),
    ])

    const result = new Map<string, { ringIds: string[]; kioskIds: string[]; userIds: string[] }>()
    for (const eventId of eventIds) {
      result.set(eventId, { ringIds: [], kioskIds: [], userIds: [] })
    }
    for (const row of ringRows) {
      result.get(String(row.event_id))?.ringIds.push(String(row.ring_id))
    }
    for (const row of kioskRows) {
      result.get(String(row.event_id))?.kioskIds.push(String(row.kiosk_id))
    }
    for (const row of userRows) {
      result.get(String(row.event_id))?.userIds.push(String(row.profile_id))
    }
    return result
  }

  private async writeRelations(eventId: string, data: Partial<Event>): Promise<void> {
    if (data.activeRingIds) {
      await this.replaceRelation('event_rings', 'ring_id', eventId, data.activeRingIds)
    }
    if (data.activeKioskIds) {
      const { error: deleteError } = await this.db
        .from('event_kiosks')
        .delete()
        .eq('event_id', eventId)
      if (deleteError) throw new Error(`[supabase] ${deleteError.message}`)

      if (data.activeKioskIds.length > 0) {
        const { error } = await this.db.from('event_kiosks').insert(
          data.activeKioskIds.map((kioskId) => ({
            event_id: eventId,
            kiosk_id: kioskId,
            is_open: true,
          }))
        )
        if (error) throw new Error(`[supabase] ${error.message}`)
      }
    }
    if (data.assignedUserIds) {
      await this.replaceRelation('event_users', 'profile_id', eventId, data.assignedUserIds)
    }
  }

  private async replaceRelation(
    table: string,
    column: string,
    eventId: string,
    ids: string[]
  ): Promise<void> {
    const { error: deleteError } = await this.db.from(table).delete().eq('event_id', eventId)
    if (deleteError) throw new Error(`[supabase] ${deleteError.message}`)
    if (ids.length === 0) return
    const { error } = await this.db
      .from(table)
      .insert(ids.map((id) => ({ event_id: eventId, [column]: id })))
    if (error) throw new Error(`[supabase] ${error.message}`)
  }
}
