import type { ICountRepository } from '../interfaces/ICountRepository'
import type { CountSession, KioskCount, CountEntry } from '@/types'
import { CountSessionStatus } from '@/types'
import { demoTables } from './demoTables'
import { countEntryId } from '@/lib/ids'

export class DemoCountRepository implements ICountRepository {
  async getSessions(eventId: string): Promise<CountSession[]> {
    return demoTables.countSessions.filter((s) => s.eventId === eventId)
  }

  async getSessionById(id: string): Promise<CountSession | null> {
    return demoTables.countSessions.getById(id)
  }

  async createSession(data: Omit<CountSession, 'createdAt' | 'updatedAt'>): Promise<CountSession> {
    const now = new Date().toISOString()
    // Idempotent: hetzelfde id twee keer aanmaken (bijv. door een retry uit de
    // outbox) mag geen tweede sessie opleveren.
    const existing = demoTables.countSessions.getById(data.id)
    const session: CountSession = {
      ...data,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    }
    demoTables.countSessions.put(session)
    return session
  }

  async updateSession(id: string, data: Partial<CountSession>): Promise<CountSession> {
    return demoTables.countSessions.update(id, { ...data, updatedAt: new Date().toISOString() })
  }

  async updateSessionStatus(id: string, status: CountSessionStatus): Promise<CountSession> {
    return this.updateSession(id, { status })
  }

  async getKioskCountsForSession(sessionId: string): Promise<KioskCount[]> {
    return demoTables.kioskCounts.filter((kc) => kc.countSessionId === sessionId)
  }

  async upsertKioskCount(data: Omit<KioskCount, 'createdAt' | 'updatedAt'>): Promise<KioskCount> {
    const now = new Date().toISOString()
    // Natuurlijke sleutel is (sessie, kiosk) — zie unique(count_session_id, kiosk_id)
    const existing = demoTables.kioskCounts.find(
      (kc) => kc.countSessionId === data.countSessionId && kc.kioskId === data.kioskId
    )
    const kioskCount: KioskCount = {
      ...existing,
      ...data,
      id: existing?.id ?? data.id,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    }
    if (existing && existing.id !== data.id) {
      // Een ander id voor dezelfde natuurlijke sleutel: houd het bestaande
      // record aan zodat er geen duplicaat ontstaat.
      demoTables.kioskCounts.remove(data.id)
    }
    demoTables.kioskCounts.put(kioskCount)
    return kioskCount
  }

  async getEntriesForKioskCount(id: string): Promise<CountEntry[]> {
    return demoTables.countEntries.filter((e) => e.kioskCountId === id)
  }

  async getEntriesForSession(sessionId: string): Promise<CountEntry[]> {
    const kioskCountIds = new Set(
      demoTables.kioskCounts.filter((c) => c.countSessionId === sessionId).map((c) => c.id)
    )
    return demoTables.countEntries.filter((e) => kioskCountIds.has(e.kioskCountId))
  }

  async upsertCountEntry(data: Omit<CountEntry, 'lastModifiedAt'>): Promise<CountEntry> {
    const entry: CountEntry = {
      ...data,
      // Het id is afgeleid van (kioskCount, product): een upsert kan daardoor
      // nooit een tweede regel voor hetzelfde product opleveren.
      id: countEntryId(data.kioskCountId, data.productId),
      lastModifiedAt: new Date().toISOString(),
    }
    demoTables.countEntries.put(entry)
    return entry
  }

  async bulkUpsertCountEntries(entries: Array<Omit<CountEntry, 'lastModifiedAt'>>): Promise<void> {
    const now = new Date().toISOString()
    demoTables.countEntries.putMany(
      entries.map((data) => ({
        ...data,
        id: countEntryId(data.kioskCountId, data.productId),
        lastModifiedAt: now,
      }))
    )
  }

  async deleteCountEntry(kioskCountId: string, productId: string): Promise<void> {
    demoTables.countEntries.remove(countEntryId(kioskCountId, productId))
  }
}
