import { EventStatus } from '@/types/enums'
import type { AgendaEntry, Event } from '@/types/domain'

/**
 * Welk evenement bedoelt iemand die de app opent?
 *
 * Elk scherm beantwoordde die vraag zelf, meestal met `events[0]` op een lijst
 * die oplopend op datum staat — het oudste evenement dus, vaak een wedstrijd
 * van maanden geleden. Die keuze hoort op één plek te staan, en hij hoort te
 * gaan over waar op dit moment aan gewerkt wordt.
 */

/** Statussen waarin er op de vloer daadwerkelijk iets loopt. */
export const OPERATIONAL_STATUSES: readonly EventStatus[] = [
  EventStatus.COUNTING,
  EventStatus.COUNT_REVIEW,
  EventStatus.READY_FOR_RESTOCK,
  EventStatus.RESTOCKING,
]

/** Statussen waarbij er niets meer te doen valt. */
const FINISHED_STATUSES: readonly EventStatus[] = [EventStatus.COMPLETED, EventStatus.ARCHIVED]

export interface EventSelectionContext {
  /** Vandaag als yyyy-mm-dd. Standaard de lokale datum van dit apparaat. */
  today?: string
}

/**
 * Vandaag als yyyy-mm-dd, in lokale tijd.
 *
 * Bewust niet `toISOString().slice(0, 10)`: die zet een avond in Amsterdam om
 * naar de volgende dag in UTC, waardoor de wedstrijd van vanavond ineens
 * "gisteren" is.
 */
export function todayLocalDate(now: Date = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

export function isOperational(event: Event): boolean {
  return OPERATIONAL_STATUSES.includes(event.status)
}

export function isFinished(event: Event): boolean {
  return FINISHED_STATUSES.includes(event.status)
}

interface Dated {
  date: string
}

const byDateAscending = (a: Dated, b: Dated) => a.date.localeCompare(b.date)
const byDateDescending = (a: Dated, b: Dated) => b.date.localeCompare(a.date)

/**
 * Het evenement waar de app standaard over gaat.
 *
 * De volgorde:
 *
 *   1. Er loopt iets — geteld, gecontroleerd of gevuld wordt. Dat gaat voor,
 *      ook als het gisteren was: een ronde die nog niet af is vraagt aandacht.
 *   2. Anders het eerstvolgende evenement dat nog moet gebeuren.
 *   3. Anders het meest recente evenement dat nog iets voorstelt.
 *
 * Een afgerond of gearchiveerd evenement wint dus nooit van een wedstrijd die
 * er nog aan komt.
 */
export function getOperationalEvent(
  events: Event[],
  context: EventSelectionContext = {}
): Event | null {
  const today = context.today ?? todayLocalDate()
  const relevant = events.filter((event) => event.status !== EventStatus.ARCHIVED)

  const running = relevant.filter(isOperational)
  if (running.length > 0) {
    // Eerst het eerstvolgende dat loopt; is alles al geweest, dan het laatste.
    const ahead = running.filter((event) => event.date >= today).sort(byDateAscending)
    return ahead[0] ?? [...running].sort(byDateDescending)[0] ?? null
  }

  const upcoming = relevant
    .filter((event) => event.date >= today && !isFinished(event))
    .sort(byDateAscending)
  if (upcoming[0]) return upcoming[0]

  return [...relevant].sort(byDateDescending)[0] ?? null
}

/**
 * Waar de app op dit moment over gaat, agenda meegerekend.
 *
 * `getOperationalEvent` kan alleen kiezen uit evenementen die al bestaan. Zodra
 * de laatste wedstrijd gespeeld en afgerond is, is dat er geen enkele meer, en
 * viel de app terug op het meest recente — een wedstrijd van gisteren, onder
 * het kopje "eerstvolgende". De kalender wist toen allang beter.
 *
 * Een agendaregel is nog geen evenement: er hangen geen ringen, kiosken of
 * telrondes aan. Hij mag hier wel de plaats innemen van het evenement dat er
 * nog van gemaakt moet worden, zodat de app uit zichzelf doorloopt naar de
 * volgende wedstrijd in plaats van naar de vorige te blijven wijzen.
 *
 * De volgorde:
 *
 *   RUNNING   er wordt geteld of gevuld — dat gaat voor, ook als het gisteren was
 *   UPCOMING  het eerstvolgende evenement dat al bestaat
 *   PLANNED   de eerstvolgende agendaregel waar nog geen evenement voor is
 *   PAST      niets meer te gaan; het laatste dat geweest is
 *   NONE      een lege agenda en geen enkel evenement
 *
 * Valt een agendaregel eerder dan het eerstvolgende evenement, dan wint de
 * agendaregel: die wedstrijd is als eerste aan de beurt.
 */
export type EventFocusKind = 'RUNNING' | 'UPCOMING' | 'PLANNED' | 'PAST' | 'NONE'

export interface EventFocus {
  kind: EventFocusKind
  /** Het evenement waar het om gaat. `null` bij PLANNED en NONE. */
  event: Event | null
  /** De agendaregel die nog een evenement moet worden. Alleen bij PLANNED. */
  agendaEntry: AgendaEntry | null
}

export function getEventFocus(input: {
  events: Event[]
  agenda?: AgendaEntry[]
  today?: string
}): EventFocus {
  const today = input.today ?? todayLocalDate()
  const relevant = input.events.filter((event) => event.status !== EventStatus.ARCHIVED)

  const running = relevant.filter(isOperational)
  if (running.length > 0) {
    const ahead = running.filter((event) => event.date >= today).sort(byDateAscending)
    const chosen = ahead[0] ?? [...running].sort(byDateDescending)[0]!
    return { kind: 'RUNNING', event: chosen, agendaEntry: null }
  }

  const upcomingEvent = relevant
    .filter((event) => event.date >= today && !isFinished(event))
    .sort(byDateAscending)[0]

  // Een agendaregel waarvoor al een evenement bestaat is afgehandeld, ook als
  // dat evenement afgerond of gearchiveerd is. Vandaar de volledige lijst en
  // niet `relevant`: anders zou een gearchiveerde wedstrijd via de agenda
  // terugkomen.
  const datesWithEvent = new Set(input.events.map((event) => event.date))
  const plannedEntry = (input.agenda ?? [])
    .filter((entry) => entry.date >= today && !datesWithEvent.has(entry.date))
    .sort(byDateAscending)[0]

  if (upcomingEvent && (!plannedEntry || upcomingEvent.date <= plannedEntry.date)) {
    return { kind: 'UPCOMING', event: upcomingEvent, agendaEntry: null }
  }
  if (plannedEntry) {
    return { kind: 'PLANNED', event: null, agendaEntry: plannedEntry }
  }

  const last = [...relevant].sort(byDateDescending)[0]
  return last
    ? { kind: 'PAST', event: last, agendaEntry: null }
    : { kind: 'NONE', event: null, agendaEntry: null }
}

/** Wat er nog aankomt, eerstvolgende eerst. */
export function getUpcomingEvents(
  events: Event[],
  context: EventSelectionContext = {}
): Event[] {
  const today = context.today ?? todayLocalDate()
  return events
    .filter((event) => event.status !== EventStatus.ARCHIVED && event.date >= today)
    .sort(byDateAscending)
}

/** Wat geweest is, meest recente eerst. */
export function getHistoricalEvents(
  events: Event[],
  context: EventSelectionContext = {}
): Event[] {
  const today = context.today ?? todayLocalDate()
  return events.filter((event) => event.date < today).sort(byDateDescending)
}

/**
 * Alle evenementen in de volgorde waarin iemand ze waarschijnlijk zoekt: eerst
 * waar aan gewerkt wordt, dan wat eraan komt, dan de historie.
 *
 * Voor keuzelijsten en om te bepalen welk evenement als eerste geprobeerd
 * wordt wanneer een scherm zelf moet uitzoeken waar nog werk ligt.
 */
export function orderEventsByRelevance(
  events: Event[],
  context: EventSelectionContext = {}
): Event[] {
  const operational = getOperationalEvent(events, context)
  const rest = events.filter((event) => event.id !== operational?.id)

  return [
    ...(operational ? [operational] : []),
    ...getUpcomingEvents(rest, context),
    ...getHistoricalEvents(rest, context),
  ]
}
