import type { CountSession, KioskCount, CountEntry, CountSessionStatus } from '@/types'

export interface ICountRepository {
  getSessions(eventId: string): Promise<CountSession[]>
  getSessionById(id: string): Promise<CountSession | null>
  createSession(data: Omit<CountSession, 'createdAt' | 'updatedAt'>): Promise<CountSession>
  updateSession(id: string, data: Partial<CountSession>): Promise<CountSession>
  updateSessionStatus(id: string, status: CountSessionStatus): Promise<CountSession>

  getKioskCountsForSession(sessionId: string): Promise<KioskCount[]>
  upsertKioskCount(data: Omit<KioskCount, 'createdAt' | 'updatedAt'>): Promise<KioskCount>

  getEntriesForKioskCount(kioskCountId: string): Promise<CountEntry[]>
  upsertCountEntry(data: Omit<CountEntry, 'lastModifiedAt'>): Promise<CountEntry>
  bulkUpsertCountEntries(entries: Array<Omit<CountEntry, 'lastModifiedAt'>>): Promise<void>
  /** Verwijdert een telregel — gebruikt wanneer een telling wordt teruggezet naar "nog niet geteld". */
  deleteCountEntry(kioskCountId: string, productId: string): Promise<void>
}
