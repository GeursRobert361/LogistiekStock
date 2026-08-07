import type { AgendaEntry, Event, EventStatus } from '@/types'

export interface IEventRepository {
  getEvents(options?: { status?: EventStatus }): Promise<Event[]>
  getEventById(id: string): Promise<Event | null>
  createEvent(data: Omit<Event, 'id' | 'createdAt' | 'updatedAt'>): Promise<Event>
  updateEvent(id: string, data: Partial<Event>): Promise<Event>
  updateEventStatus(id: string, status: EventStatus): Promise<Event>
  deleteEvent(id: string): Promise<void>

  /** De agenda, op datum gesorteerd. */
  getAgenda(): Promise<AgendaEntry[]>
  /** Zonder id een nieuwe regel, met id een bestaande bijwerken. */
  upsertAgendaEntry(
    data: Omit<AgendaEntry, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
  ): Promise<AgendaEntry>
  deleteAgendaEntry(id: string): Promise<void>
}
