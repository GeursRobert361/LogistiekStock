import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { AgendaEntry, Event, Kiosk, Ring } from '@/types'

let rings: Ring[] = []
let kiosks: Kiosk[] = []
let events: Event[] = []
const created: Array<Omit<Event, 'id' | 'createdAt' | 'updatedAt'>> = []

vi.mock('@/repositories', () => ({
  repositories: {
    kiosk: () => ({
      getRings: async () => rings,
      getKiosks: async () => kiosks,
    }),
    event: () => ({
      getEvents: async () => events,
      createEvent: async (data: Omit<Event, 'id' | 'createdAt' | 'updatedAt'>) => {
        created.push(data)
        return { ...data, id: 'nieuw', createdAt: '', updatedAt: '' } as Event
      },
    }),
  },
}))

const { createEventFromAgenda } = await import('../eventService')
const { EventStatus, EventType } = await import('@/types')

function ring(id: string, sortOrder: number): Ring {
  return { id, name: id, isActive: true, sortOrder, createdAt: '', updatedAt: '' }
}

function kiosk(id: string, ringId: string): Kiosk {
  return {
    id,
    ringId,
    number: 1,
    sortOrder: 1,
    isActive: true,
    createdAt: '',
    updatedAt: '',
  } as Kiosk
}

const ENTRY: AgendaEntry = {
  id: 'agenda-1',
  name: 'Ajax – FC Sion',
  date: '2026-08-27',
  eventType: EventType.VOETBAL,
  createdAt: '',
  updatedAt: '',
}

describe('createEventFromAgenda', () => {
  beforeEach(() => {
    rings = [ring('ring-1', 1), ring('ring-2', 2)]
    kiosks = [kiosk('k-101', 'ring-1'), kiosk('k-401', 'ring-2')]
    events = []
    created.length = 0
  })

  it('zet alle ringen aan en alle actieve kiosken open', async () => {
    await createEventFromAgenda(ENTRY, 'gebruiker-1')

    expect(created).toHaveLength(1)
    expect(created[0]).toMatchObject({
      name: 'Ajax – FC Sion',
      date: '2026-08-27',
      status: EventStatus.READY_FOR_COUNTING,
      activeRingIds: ['ring-1', 'ring-2'],
      activeKioskIds: ['k-101', 'k-401'],
      createdById: 'gebruiker-1',
    })
  })

  it('legt de ketting naar het vorige evenement', async () => {
    events = [
      { id: 'oud', date: '2026-08-01' } as Event,
      { id: 'vorige', date: '2026-08-16' } as Event,
    ]
    await createEventFromAgenda(ENTRY, 'gebruiker-1')
    expect(created[0]?.previousEventId).toBe('vorige')
  })

  it('maakt niets nieuws als er al een evenement op die dag staat', async () => {
    const bestaand = { id: 'bestaat-al', date: '2026-08-27' } as Event
    events = [bestaand]

    const result = await createEventFromAgenda(ENTRY, 'gebruiker-1')

    expect(result).toBe(bestaand)
    expect(created).toHaveLength(0)
  })

  it('weigert zonder kiosken, want er valt dan niets te tellen', async () => {
    kiosks = []
    await expect(createEventFromAgenda(ENTRY, 'gebruiker-1')).rejects.toThrow('kiosken')
  })
})
