import type { ICountRepository } from '../interfaces/ICountRepository'
import type { CountSession, KioskCount, CountEntry } from '@/types'
import { CountSessionStatus } from '@/types'
import { getSupabaseClient } from '@/lib/supabase/client'
import {
  mapCountSession,
  mapKioskCount,
  mapCountEntry,
  countSessionToRow,
  kioskCountToRow,
  countEntryToRow,
} from '@/server/db/rowMappers'
import { unwrap, unwrapList, unwrapMaybe } from './supabaseHelpers'

type Row = Record<string, unknown>

export class SupabaseCountRepository implements ICountRepository {
  private get db() {
    return getSupabaseClient()
  }

  async getSessions(eventId: string): Promise<CountSession[]> {
    const rows = unwrapList<Row>(
      await this.db
        .from('count_sessions')
        .select('*')
        .eq('event_id', eventId)
        .order('started_at', { ascending: false })
    )
    return rows.map(mapCountSession)
  }

  async getSessionById(id: string): Promise<CountSession | null> {
    const row = unwrapMaybe<Row>(
      await this.db.from('count_sessions').select('*').eq('id', id).maybeSingle()
    )
    return row ? mapCountSession(row) : null
  }

  async createSession(data: Omit<CountSession, 'createdAt' | 'updatedAt'>): Promise<CountSession> {
    // Upsert op id: een herhaalde poging vanuit de outbox mag geen tweede
    // sessie opleveren.
    const row = unwrap<Row>(
      await this.db
        .from('count_sessions')
        .upsert(countSessionToRow(data), { onConflict: 'id' })
        .select()
        .single()
    )
    return mapCountSession(row)
  }

  async updateSession(id: string, data: Partial<CountSession>): Promise<CountSession> {
    const row = unwrap<Row>(
      await this.db
        .from('count_sessions')
        .update(countSessionToRow(data))
        .eq('id', id)
        .select()
        .single()
    )
    return mapCountSession(row)
  }

  async updateSessionStatus(id: string, status: CountSessionStatus): Promise<CountSession> {
    return this.updateSession(id, { status })
  }

  async getKioskCountsForSession(sessionId: string): Promise<KioskCount[]> {
    const rows = unwrapList<Row>(
      await this.db.from('kiosk_counts').select('*').eq('count_session_id', sessionId)
    )
    return rows.map(mapKioskCount)
  }

  async upsertKioskCount(data: Omit<KioskCount, 'createdAt' | 'updatedAt'>): Promise<KioskCount> {
    const row = unwrap<Row>(
      await this.db
        .from('kiosk_counts')
        .upsert(kioskCountToRow(data), { onConflict: 'count_session_id,kiosk_id' })
        .select()
        .single()
    )
    return mapKioskCount(row)
  }

  async getEntriesForKioskCount(kioskCountId: string): Promise<CountEntry[]> {
    const rows = unwrapList<Row>(
      await this.db.from('count_entries').select('*').eq('kiosk_count_id', kioskCountId)
    )
    return rows.map(mapCountEntry)
  }

  async upsertCountEntry(data: Omit<CountEntry, 'lastModifiedAt'>): Promise<CountEntry> {
    const row = unwrap<Row>(
      await this.db
        .from('count_entries')
        .upsert(countEntryToRow(data), { onConflict: 'kiosk_count_id,product_id' })
        .select()
        .single()
    )
    return mapCountEntry(row)
  }

  async bulkUpsertCountEntries(entries: Array<Omit<CountEntry, 'lastModifiedAt'>>): Promise<void> {
    if (entries.length === 0) return
    const { error } = await this.db
      .from('count_entries')
      .upsert(entries.map(countEntryToRow), { onConflict: 'kiosk_count_id,product_id' })
    if (error) throw new Error(`[supabase] ${error.message}`)
  }

  async deleteCountEntry(kioskCountId: string, productId: string): Promise<void> {
    const { error } = await this.db
      .from('count_entries')
      .delete()
      .eq('kiosk_count_id', kioskCountId)
      .eq('product_id', productId)
    if (error) throw new Error(`[supabase] ${error.message}`)
  }
}
