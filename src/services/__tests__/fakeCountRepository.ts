import type { ICountRepository } from '@/repositories/interfaces/ICountRepository'
import type { CountSession, KioskCount, CountEntry, CountSessionStatus } from '@/types'
import { countEntryId } from '@/lib/ids'

/**
 * Server-dubbel voor tests. Gedraagt zich als de echte repositories: upserts
 * op de natuurlijke sleutel, en `offline` laat elke aanroep falen zoals een
 * onbereikbare server dat zou doen.
 */
export class FakeCountRepository implements ICountRepository {
  sessions: CountSession[] = []
  kioskCounts: KioskCount[] = []
  entries: CountEntry[] = []
  offline = false

  private guard() {
    if (this.offline) throw new Error('Netwerkfout: server niet bereikbaar')
  }

  async getSessions(eventId: string): Promise<CountSession[]> {
    this.guard()
    return this.sessions.filter((s) => s.eventId === eventId)
  }

  async getSessionById(id: string): Promise<CountSession | null> {
    this.guard()
    return this.sessions.find((s) => s.id === id) ?? null
  }

  async createSession(data: Omit<CountSession, 'createdAt' | 'updatedAt'>): Promise<CountSession> {
    this.guard()
    const now = new Date().toISOString()
    const existing = this.sessions.find((s) => s.id === data.id)
    const session: CountSession = { ...data, createdAt: existing?.createdAt ?? now, updatedAt: now }
    if (existing) {
      this.sessions[this.sessions.indexOf(existing)] = session
    } else {
      this.sessions.push(session)
    }
    return session
  }

  async updateSession(id: string, data: Partial<CountSession>): Promise<CountSession> {
    this.guard()
    const index = this.sessions.findIndex((s) => s.id === id)
    if (index === -1) throw new Error(`Sessie niet gevonden: ${id}`)
    const updated = { ...this.sessions[index]!, ...data, updatedAt: new Date().toISOString() }
    this.sessions[index] = updated
    return updated
  }

  async updateSessionStatus(id: string, status: CountSessionStatus): Promise<CountSession> {
    return this.updateSession(id, { status })
  }

  async getKioskCountsForSession(sessionId: string): Promise<KioskCount[]> {
    this.guard()
    return this.kioskCounts.filter((kc) => kc.countSessionId === sessionId)
  }

  async upsertKioskCount(data: Omit<KioskCount, 'createdAt' | 'updatedAt'>): Promise<KioskCount> {
    this.guard()
    const now = new Date().toISOString()
    const existing = this.kioskCounts.find(
      (kc) => kc.countSessionId === data.countSessionId && kc.kioskId === data.kioskId
    )
    const kioskCount: KioskCount = {
      ...data,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    }
    if (existing) {
      this.kioskCounts[this.kioskCounts.indexOf(existing)] = kioskCount
    } else {
      this.kioskCounts.push(kioskCount)
    }
    return kioskCount
  }

  async getEntriesForKioskCount(kioskCountId: string): Promise<CountEntry[]> {
    this.guard()
    return this.entries.filter((e) => e.kioskCountId === kioskCountId)
  }

  async upsertCountEntry(data: Omit<CountEntry, 'lastModifiedAt'>): Promise<CountEntry> {
    this.guard()
    const entry: CountEntry = {
      ...data,
      id: countEntryId(data.kioskCountId, data.productId),
      lastModifiedAt: new Date().toISOString(),
    }
    const existing = this.entries.find(
      (e) => e.kioskCountId === data.kioskCountId && e.productId === data.productId
    )
    if (existing) {
      this.entries[this.entries.indexOf(existing)] = entry
    } else {
      this.entries.push(entry)
    }
    return entry
  }

  async bulkUpsertCountEntries(entries: Array<Omit<CountEntry, 'lastModifiedAt'>>): Promise<void> {
    for (const entry of entries) await this.upsertCountEntry(entry)
  }

  async deleteCountEntry(kioskCountId: string, productId: string): Promise<void> {
    this.guard()
    this.entries = this.entries.filter(
      (e) => !(e.kioskCountId === kioskCountId && e.productId === productId)
    )
  }

  reset(): void {
    this.sessions = []
    this.kioskCounts = []
    this.entries = []
    this.offline = false
  }
}
