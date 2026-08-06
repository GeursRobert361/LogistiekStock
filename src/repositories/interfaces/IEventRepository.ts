import type { Event, EventStatus } from '@/types'

export interface IEventRepository {
  getEvents(options?: { status?: EventStatus }): Promise<Event[]>
  getEventById(id: string): Promise<Event | null>
  createEvent(data: Omit<Event, 'id' | 'createdAt' | 'updatedAt'>): Promise<Event>
  updateEvent(id: string, data: Partial<Event>): Promise<Event>
  updateEventStatus(id: string, status: EventStatus): Promise<Event>
  deleteEvent(id: string): Promise<void>
}
