import { describe, it, expect } from 'vitest'
import { findNextEvent, findPreviousEventId } from '../consumptionService'
import { EventStatus, EventType } from '@/types'
import type { Event } from '@/types'

/**
 * De ketting tussen evenementen. Verbruik van een evenement blijkt pas uit de
 * telling vóór het volgende, dus die volgorde moet kloppen — ook als iemand een
 * evenement achteraf invoert.
 */
function event(id: string, date: string, previousEventId?: string): Event {
  return {
    id,
    name: id,
    date,
    eventType: EventType.VOETBAL,
    status: EventStatus.READY_FOR_COUNTING,
    previousEventId,
    activeRingIds: [],
    activeKioskIds: [],
    assignedUserIds: [],
    createdById: 'user-1',
    createdAt: '',
    updatedAt: '',
  }
}

describe('findPreviousEventId', () => {
  it('kiest het laatste evenement vóór deze datum', () => {
    const events = [event('a', '2026-08-06'), event('b', '2026-08-16')]

    expect(findPreviousEventId(events, '2026-09-05')).toBe('b')
  })

  it('slaat evenementen van later over', () => {
    const events = [event('a', '2026-08-06'), event('c', '2026-10-01')]

    expect(findPreviousEventId(events, '2026-09-05')).toBe('a')
  })

  it('geeft niets terug voor het allereerste evenement', () => {
    expect(findPreviousEventId([event('a', '2026-08-06')], '2026-08-01')).toBeUndefined()
  })
})

describe('findNextEvent', () => {
  it('volgt de vastgelegde koppeling', () => {
    const events = [event('a', '2026-08-06'), event('b', '2026-08-16', 'a')]

    expect(findNextEvent(events, 'a')?.id).toBe('b')
  })

  it('valt terug op de datum als de koppeling ontbreekt', () => {
    // Evenementen van vóór deze functie hebben geen voorganger vastgelegd.
    const events = [event('a', '2026-08-06'), event('b', '2026-08-16')]

    expect(findNextEvent(events, 'a')?.id).toBe('b')
  })

  it('pakt bij die terugval het eerstvolgende, niet zomaar een later evenement', () => {
    const events = [
      event('a', '2026-08-06'),
      event('c', '2026-10-01'),
      event('b', '2026-08-16'),
    ]

    expect(findNextEvent(events, 'a')?.id).toBe('b')
  })

  it('geeft niets terug voor het laatste evenement', () => {
    const events = [event('a', '2026-08-06'), event('b', '2026-08-16', 'a')]

    expect(findNextEvent(events, 'b')).toBeNull()
  })
})
