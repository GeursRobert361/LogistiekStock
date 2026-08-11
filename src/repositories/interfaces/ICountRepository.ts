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
  /**
   * Alle telregels van een hele telronde in één keer.
   *
   * Voor het verbruiksoverzicht: per kiosk apart ophalen zou tientallen
   * verzoeken kosten voor één scherm.
   */
  getEntriesForSession(sessionId: string): Promise<CountEntry[]>
  upsertCountEntry(data: Omit<CountEntry, 'lastModifiedAt'>): Promise<CountEntry>
  bulkUpsertCountEntries(entries: Array<Omit<CountEntry, 'lastModifiedAt'>>): Promise<void>
  /** Verwijdert een telregel — gebruikt wanneer een telling wordt teruggezet naar "nog niet geteld". */
  deleteCountEntry(kioskCountId: string, productId: string): Promise<void>

  /**
   * Gooit een telronde weg, met de kiosktellingen en telregels eraan.
   *
   * Alleen voor een ronde die nog niet is goedgekeurd; de controle daarop
   * staat op de server. Voor een correctie op afgerond werk is er REOPENED.
   */
  deleteSession(id: string): Promise<void>

  /**
   * Haalt het telwerk van één kiosk uit een ronde, zodat die kiosk opnieuw
   * geteld kan worden. De rest van de ronde blijft staan.
   */
  deleteKioskCount(kioskCountId: string): Promise<void>
}
