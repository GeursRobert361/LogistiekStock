import type { IEventRepository } from '../interfaces/IEventRepository'
import type { Event } from '@/types'
import { EventStatus } from '@/types'
import { demoEvent } from '@/lib/seed/demoData'

export class DemoEventRepository implements IEventRepository {
  private events: Event[] = [demoEvent]

  async getEvents(options?: { status?: EventStatus }): Promise<Event[]> {
    return this.events.filter(
      (e) => options?.status == null || e.status === options.status
    )
  }

  async getEventById(id: string): Promise<Event | null> {
    return this.events.find((e) => e.id === id) ?? null
  }

  async createEvent(data: Omit<Event, 'id' | 'createdAt' | 'updatedAt'>): Promise<Event> {
    const event: Event = {
      ...data,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    this.events.push(event)
    return event
  }

  async updateEvent(id: string, data: Partial<Event>): Promise<Event> {
    const idx = this.events.findIndex((e) => e.id === id)
    if (idx === -1) throw new Error(`Evenement niet gevonden: ${id}`)
    const updated = { ...this.events[idx]!, ...data, updatedAt: new Date().toISOString() }
    this.events[idx] = updated
    return updated
  }

  async updateEventStatus(id: string, status: EventStatus): Promise<Event> {
    return this.updateEvent(id, { status })
  }

  async deleteEvent(id: string): Promise<void> {
    this.events = this.events.filter((e) => e.id !== id)
  }
}
