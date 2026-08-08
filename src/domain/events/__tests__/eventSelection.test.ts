import { describe, it, expect } from 'vitest'
import {
  getOperationalEvent,
  getUpcomingEvents,
  getHistoricalEvents,
  orderEventsByRelevance,
  todayLocalDate,
} from '../eventSelection'
import { EventStatus, EventType } from '@/types'
import type { Event } from '@/types'

const TODAY = '2026-08-08'

function event(name: string, date: string, status: EventStatus): Event {
  return {
    id: name,
    name,
    date,
    eventType: EventType.VOETBAL,
    status,
    activeRingIds: [],
    activeKioskIds: [],
    assignedUserIds: [],
    createdById: 'planner-1',
    createdAt: '',
    updatedAt: '',
  }
}

/** Het seizoen uit de opdracht: twee gespeeld, twee te gaan. */
const SEASON = [
  event('1 juli', '2026-07-01', EventStatus.COMPLETED),
  event('1 augustus', '2026-08-01', EventStatus.COMPLETED),
  event('12 augustus', '2026-08-12', EventStatus.READY_FOR_COUNTING),
  event('20 augustus', '2026-08-20', EventStatus.DRAFT),
]

describe('getOperationalEvent', () => {
  it('kiest het eerstvolgende evenement, niet het oudste', () => {
    // De lijst komt oplopend op datum binnen; `events[0]` was 1 juli.
    expect(getOperationalEvent(SEASON, { today: TODAY })?.name).toBe('12 augustus')
  })

  it('laat een afgerond evenement nooit winnen van een komende wedstrijd', () => {
    const events = [
      event('gisteren', '2026-08-07', EventStatus.COMPLETED),
      event('volgende week', '2026-08-15', EventStatus.DRAFT),
    ]
    expect(getOperationalEvent(events, { today: TODAY })?.name).toBe('volgende week')
  })

  it('geeft voorrang aan een evenement waar op dit moment aan gewerkt wordt', () => {
    const events = [
      ...SEASON,
      event('vandaag', '2026-08-08', EventStatus.COUNTING),
    ]
    expect(getOperationalEvent(events, { today: TODAY })?.name).toBe('vandaag')
  })

  it('houdt een gisteren gestarte vulronde vast', () => {
    // Nog niet afgerond werk vraagt aandacht, ook als de wedstrijd geweest is.
    const events = [
      event('gisteren', '2026-08-07', EventStatus.RESTOCKING),
      event('volgende week', '2026-08-15', EventStatus.DRAFT),
    ]
    expect(getOperationalEvent(events, { today: TODAY })?.name).toBe('gisteren')
  })

  it('kiest bij meerdere lopende evenementen het eerstvolgende', () => {
    const events = [
      event('vorige week', '2026-08-01', EventStatus.READY_FOR_RESTOCK),
      event('morgen', '2026-08-09', EventStatus.COUNTING),
      event('later', '2026-08-20', EventStatus.COUNT_REVIEW),
    ]
    expect(getOperationalEvent(events, { today: TODAY })?.name).toBe('morgen')
  })

  it('valt terug op het meest recente evenement als alles geweest is', () => {
    const events = [
      event('1 juli', '2026-07-01', EventStatus.COMPLETED),
      event('1 augustus', '2026-08-01', EventStatus.COMPLETED),
    ]
    expect(getOperationalEvent(events, { today: TODAY })?.name).toBe('1 augustus')
  })

  it('negeert gearchiveerde evenementen', () => {
    const events = [
      event('gearchiveerd', '2026-09-01', EventStatus.ARCHIVED),
      event('12 augustus', '2026-08-12', EventStatus.READY_FOR_COUNTING),
    ]
    expect(getOperationalEvent(events, { today: TODAY })?.name).toBe('12 augustus')
  })

  it('geeft null zonder evenementen', () => {
    expect(getOperationalEvent([], { today: TODAY })).toBeNull()
  })

  it('telt een evenement van vandaag als aankomend', () => {
    const events = [event('vandaag', TODAY, EventStatus.READY_FOR_COUNTING)]
    expect(getOperationalEvent(events, { today: TODAY })?.name).toBe('vandaag')
  })
})

describe('lijsten', () => {
  it('zet aankomende evenementen op volgorde van datum', () => {
    expect(getUpcomingEvents(SEASON, { today: TODAY }).map((e) => e.name)).toEqual([
      '12 augustus',
      '20 augustus',
    ])
  })

  it('zet de historie met de meest recente bovenaan', () => {
    expect(getHistoricalEvents(SEASON, { today: TODAY }).map((e) => e.name)).toEqual([
      '1 augustus',
      '1 juli',
    ])
  })

  it('zet het operationele evenement vooraan bij sorteren op relevantie', () => {
    const events = [...SEASON, event('bezig', '2026-08-05', EventStatus.RESTOCKING)]
    expect(orderEventsByRelevance(events, { today: TODAY }).map((e) => e.name)).toEqual([
      'bezig',
      '12 augustus',
      '20 augustus',
      '1 augustus',
      '1 juli',
    ])
  })
})

describe('todayLocalDate', () => {
  it('gebruikt de lokale dag, niet de UTC-dag', () => {
    // 8 augustus 23:30 lokaal is in UTC al de 9e zodra we vóór UTC lopen.
    const evening = new Date(2026, 7, 8, 23, 30)
    expect(todayLocalDate(evening)).toBe('2026-08-08')
  })
})
