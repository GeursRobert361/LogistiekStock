import type { ICountRepository } from '../interfaces/ICountRepository'
import type { CountSession, KioskCount, CountEntry } from '@/types'
import { CountSessionStatus } from '@/types'

export class DemoCountRepository implements ICountRepository {
  private sessions: CountSession[] = []
  private kioskCounts: KioskCount[] = []
  private entries: CountEntry[] = []

  async getSessions(eventId: string): Promise<CountSession[]> {
    return this.sessions.filter((s) => s.eventId === eventId)
  }

  async getSessionById(id: string): Promise<CountSession | null> {
    return this.sessions.find((s) => s.id === id) ?? null
  }

  async createSession(data: Omit<CountSession, 'createdAt' | 'updatedAt'>): Promise<CountSession> {
    const session: CountSession = {
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    this.sessions.push(session)
    return session
  }

  async updateSession(id: string, data: Partial<CountSession>): Promise<CountSession> {
    const idx = this.sessions.findIndex((s) => s.id === id)
    if (idx === -1) throw new Error(`Sessie niet gevonden: ${id}`)
    const updated = { ...this.sessions[idx]!, ...data, updatedAt: new Date().toISOString() }
    this.sessions[idx] = updated
    return updated
  }

  async updateSessionStatus(id: string, status: CountSessionStatus): Promise<CountSession> {
    return this.updateSession(id, { status })
  }

  async getKioskCountsForSession(sessionId: string): Promise<KioskCount[]> {
    return this.kioskCounts.filter((kc) => kc.countSessionId === sessionId)
  }

  async upsertKioskCount(data: Omit<KioskCount, 'createdAt' | 'updatedAt'>): Promise<KioskCount> {
    const existing = this.kioskCounts.find(
      (kc) => kc.countSessionId === data.countSessionId && kc.kioskId === data.kioskId
    )
    if (existing) {
      const idx = this.kioskCounts.indexOf(existing)
      const updated = { ...existing, ...data, updatedAt: new Date().toISOString() }
      this.kioskCounts[idx] = updated
      return updated
    }
    const kc: KioskCount = {
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    this.kioskCounts.push(kc)
    return kc
  }

  async getEntriesForKioskCount(kioskCountId: string): Promise<CountEntry[]> {
    return this.entries.filter((e) => e.kioskCountId === kioskCountId)
  }

  async upsertCountEntry(data: Omit<CountEntry, 'lastModifiedAt'>): Promise<CountEntry> {
    const existing = this.entries.find(
      (e) => e.kioskCountId === data.kioskCountId && e.productId === data.productId
    )
    const entry: CountEntry = { ...data, lastModifiedAt: new Date().toISOString() }
    if (existing) {
      const idx = this.entries.indexOf(existing)
      this.entries[idx] = entry
      return entry
    }
    this.entries.push(entry)
    return entry
  }

  async bulkUpsertCountEntries(
    entries: Array<Omit<CountEntry, 'lastModifiedAt'>>
  ): Promise<void> {
    await Promise.all(entries.map((e) => this.upsertCountEntry(e)))
  }
}
