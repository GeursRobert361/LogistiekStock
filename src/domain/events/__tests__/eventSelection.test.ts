import { describe, it, expect } from 'vitest'
import {
  getEventFocus,
  getOperationalEvent,
  getUpcomingEvents,
  getHistoricalEvents,
  orderEventsByRelevance,
  todayLocalDate,
} from '../eventSelection'
import { EventStatus, EventType } from '@/types'
import type { AgendaEntry, Event } from '@/types'

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

describe('getEventFocus', () => {
  function agenda(name: string, date: string): AgendaEntry {
    return {
      id: `agenda-${name}`,
      name,
      date,
      eventType: EventType.VOETBAL,
      createdAt: '',
      updatedAt: '',
    }
  }

  /** De seizoenskalender loopt door waar de evenementen ophouden. */
  const KALENDER = [
    agenda('1 augustus', '2026-08-01'),
    agenda('12 augustus', '2026-08-12'),
    agenda('20 augustus', '2026-08-20'),
    agenda('27 augustus', '2026-08-27'),
  ]

  it('valt terug op de agenda zodra er geen evenement meer te gaan is', () => {
    // De situatie die dit alles aanleiding gaf: de wedstrijd van gisteren is
    // geteld en afgerond, en er is nog geen evenement voor de volgende.
    const focus = getEventFocus({
      events: [event('gisteren', '2026-08-07', EventStatus.COMPLETED)],
      agenda: KALENDER,
      today: TODAY,
    })
    expect(focus.kind).toBe('PLANNED')
    expect(focus.agendaEntry?.name).toBe('12 augustus')
    expect(focus.event).toBeNull()
  })

  it('slaat agendaregels over waar al een evenement voor bestaat', () => {
    const focus = getEventFocus({
      events: [event('12 augustus', '2026-08-12', EventStatus.COMPLETED)],
      agenda: KALENDER,
      today: TODAY,
    })
    // 12 augustus is al een evenement en afgerond; dan is 20 augustus aan de beurt.
    expect(focus.kind).toBe('PLANNED')
    expect(focus.agendaEntry?.name).toBe('20 augustus')
  })

  it('kiest een echt evenement boven een agendaregel van later', () => {
    const focus = getEventFocus({
      events: [event('12 augustus', '2026-08-12', EventStatus.READY_FOR_COUNTING)],
      agenda: KALENDER,
      today: TODAY,
    })
    expect(focus.kind).toBe('UPCOMING')
    expect(focus.event?.name).toBe('12 augustus')
  })

  it('kiest de agendaregel wanneer die eerder valt dan het eerstvolgende evenement', () => {
    const focus = getEventFocus({
      events: [event('27 augustus', '2026-08-27', EventStatus.DRAFT)],
      agenda: KALENDER,
      today: TODAY,
    })
    expect(focus.kind).toBe('PLANNED')
    expect(focus.agendaEntry?.name).toBe('12 augustus')
  })

  it('houdt lopend werk vast, ook als de agenda al verder staat', () => {
    // Een telronde die nog niet af is vraagt aandacht; de kalender kan wachten.
    const focus = getEventFocus({
      events: [event('gisteren', '2026-08-07', EventStatus.COUNTING)],
      agenda: KALENDER,
      today: TODAY,
    })
    expect(focus.kind).toBe('RUNNING')
    expect(focus.event?.name).toBe('gisteren')
  })

  it('noemt een afgelopen evenement het laatste en niet het eerstvolgende', () => {
    // Zonder agenda en zonder wat er nog komt blijft alleen de historie over.
    // Die mag geen "eerstvolgende" heten — dat was precies de rare regel.
    const focus = getEventFocus({
      events: [event('gisteren', '2026-08-07', EventStatus.COMPLETED)],
      agenda: [],
      today: TODAY,
    })
    expect(focus.kind).toBe('PAST')
    expect(focus.event?.name).toBe('gisteren')
  })

  it('laat een agendaregel van vandaag meetellen', () => {
    const focus = getEventFocus({
      events: [],
      agenda: [agenda('vandaag', TODAY)],
      today: TODAY,
    })
    expect(focus.kind).toBe('PLANNED')
    expect(focus.agendaEntry?.name).toBe('vandaag')
  })

  it('negeert agendaregels die geweest zijn', () => {
    const focus = getEventFocus({
      events: [],
      agenda: [agenda('vorige week', '2026-08-01')],
      today: TODAY,
    })
    expect(focus.kind).toBe('NONE')
  })

  it('geeft NONE wanneer er niets is', () => {
    const focus = getEventFocus({ events: [], agenda: [], today: TODAY })
    expect(focus).toEqual({ kind: 'NONE', event: null, agendaEntry: null })
  })

  it('werkt zonder agenda', () => {
    const focus = getEventFocus({ events: SEASON, today: TODAY })
    expect(focus.kind).toBe('UPCOMING')
    expect(focus.event?.name).toBe('12 augustus')
  })
})

describe('todayLocalDate', () => {
  it('gebruikt de lokale dag, niet de UTC-dag', () => {
    // 8 augustus 23:30 lokaal is in UTC al de 9e zodra we vóór UTC lopen.
    const evening = new Date(2026, 7, 8, 23, 30)
    expect(todayLocalDate(evening)).toBe('2026-08-08')
  })
})
