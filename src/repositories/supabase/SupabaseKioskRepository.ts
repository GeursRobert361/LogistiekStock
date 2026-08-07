import type { IKioskRepository } from '../interfaces/IKioskRepository'
import type { Kiosk, Ring } from '@/types'
import { getSupabaseClient } from '@/lib/supabase/client'
import { mapKiosk, mapRing, kioskToRow } from './mappers'
import { unwrap, unwrapList, unwrapMaybe } from './supabaseHelpers'

type Row = Record<string, unknown>

export class SupabaseKioskRepository implements IKioskRepository {
  private get db() {
    return getSupabaseClient()
  }

  async getRings(): Promise<Ring[]> {
    const rows = unwrapList<Row>(
      await this.db.from('rings').select('*').eq('is_active', true).order('sort_order')
    )
    return rows.map(mapRing)
  }

  async getRingById(id: string): Promise<Ring | null> {
    const row = unwrapMaybe<Row>(await this.db.from('rings').select('*').eq('id', id).maybeSingle())
    return row ? mapRing(row) : null
  }

  async getKiosks(ringId?: string): Promise<Kiosk[]> {
    let query = this.db.from('kiosks').select('*').eq('is_active', true)
    if (ringId) query = query.eq('ring_id', ringId)
    const rows = unwrapList<Row>(await query.order('sort_order'))
    return rows.map(mapKiosk)
  }

  async getKioskById(id: string): Promise<Kiosk | null> {
    const row = unwrapMaybe<Row>(await this.db.from('kiosks').select('*').eq('id', id).maybeSingle())
    return row ? mapKiosk(row) : null
  }

  async getKiosksByEvent(eventId: string): Promise<Array<Kiosk & { isOpenForEvent: boolean }>> {
    const [kioskRows, eventKioskRows] = await Promise.all([
      unwrapList<Row>(
        await this.db.from('kiosks').select('*').eq('is_active', true).order('sort_order')
      ),
      unwrapList<Row>(
        await this.db.from('event_kiosks').select('kiosk_id, is_open').eq('event_id', eventId)
      ),
    ])

    const openByKiosk = new Map(
      eventKioskRows.map((row) => [String(row.kiosk_id), row.is_open === true])
    )

    return kioskRows.map((row) => {
      const kiosk = mapKiosk(row)
      return { ...kiosk, isOpenForEvent: openByKiosk.get(kiosk.id) ?? false }
    })
  }

  async createKiosk(data: Omit<Kiosk, 'id' | 'createdAt' | 'updatedAt'>): Promise<Kiosk> {
    const row = unwrap<Row>(
      await this.db.from('kiosks').insert(kioskToRow(data)).select().single()
    )
    return mapKiosk(row)
  }

  async updateKiosk(id: string, data: Partial<Kiosk>): Promise<Kiosk> {
    const row = unwrap<Row>(
      await this.db.from('kiosks').update(kioskToRow(data)).eq('id', id).select().single()
    )
    return mapKiosk(row)
  }

  async deleteKiosk(id: string): Promise<void> {
    await this.updateKiosk(id, { isActive: false })
  }

  async updateEventKiosks(eventId: string, kioskIds: string[], openIds: string[]): Promise<void> {
    const openSet = new Set(openIds)
    const rows = kioskIds.map((kioskId) => ({
      event_id: eventId,
      kiosk_id: kioskId,
      is_open: openSet.has(kioskId),
    }))

    // Kiosken die niet meer bij het evenement horen, verdwijnen uit de koppeltabel.
    const removal = await this.db
      .from('event_kiosks')
      .delete()
      .eq('event_id', eventId)
      .not('kiosk_id', 'in', `(${kioskIds.join(',')})`)
    if (removal.error && kioskIds.length > 0) {
      throw new Error(`[supabase] ${removal.error.message}`)
    }

    if (rows.length === 0) return
    const upsert = await this.db
      .from('event_kiosks')
      .upsert(rows, { onConflict: 'event_id,kiosk_id' })
    if (upsert.error) throw new Error(`[supabase] ${upsert.error.message}`)
  }
}
