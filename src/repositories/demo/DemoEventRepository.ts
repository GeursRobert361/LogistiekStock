import type { IEventRepository } from '../interfaces/IEventRepository'
import type { Event } from '@/types'
import { EventStatus } from '@/types'
import { demoTables } from './demoTables'
import { newId } from '@/lib/ids'

export class DemoEventRepository implements IEventRepository {
  async getEvents(options?: { status?: EventStatus }): Promise<Event[]> {
    return demoTables.events
      .filter((e) => options?.status == null || e.status === options.status)
      .sort((a, b) => a.date.localeCompare(b.date))
  }

  async getEventById(id: string): Promise<Event | null> {
    return demoTables.events.getById(id)
  }

  async createEvent(data: Omit<Event, 'id' | 'createdAt' | 'updatedAt'>): Promise<Event> {
    const now = new Date().toISOString()
    const event: Event = { ...data, id: `event-${newId()}`, createdAt: now, updatedAt: now }
    demoTables.events.insert(event)
    return event
  }

  async updateEvent(id: string, data: Partial<Event>): Promise<Event> {
    return demoTables.events.update(id, { ...data, updatedAt: new Date().toISOString() })
  }

  async updateEventStatus(id: string, status: EventStatus): Promise<Event> {
    return this.updateEvent(id, { status })
  }

  async deleteEvent(id: string): Promise<void> {
    demoTables.events.remove(id)
  }
}
