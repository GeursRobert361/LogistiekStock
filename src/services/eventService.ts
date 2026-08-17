import { repositories } from '@/repositories'
import { findPreviousEventId } from './consumptionService'
import { EventStatus } from '@/types'
import type { AgendaEntry, Event } from '@/types'

/**
 * Maakt van een agendaregel het evenement waar geteld en gevuld kan worden.
 *
 * De kalender staat er al; er hoeft alleen nog achter dat de hele ArenA
 * meedoet. Dat is ook wat het aanmaakscherm voorstelt: alle ringen aan, alle
 * actieve kiosken open. Wie een kiosk dicht wil hebben doet dat daarna bij het
 * evenement, en dat is zeldzamer dan de gewone gang van zaken — die hoort geen
 * formulier te kosten.
 *
 * De ketting naar het vorige evenement gaat mee: zonder die verwijzing is
 * achteraf niet te berekenen hoeveel er tijdens dat evenement doorheen is
 * gegaan.
 */
export async function createEventFromAgenda(
  entry: AgendaEntry,
  createdById: string
): Promise<Event> {
  const [rings, kiosks, events] = await Promise.all([
    repositories.kiosk().getRings(),
    repositories.kiosk().getKiosks(),
    repositories.event().getEvents(),
  ])

  // Twee tabbladen, of iemand anders die net hetzelfde deed: dan is het
  // evenement er al en hoort er geen tweede naast te komen.
  const existing = events.find((event) => event.date === entry.date)
  if (existing) return existing

  const ringIds = rings.map((ring) => ring.id)
  const kioskIds = kiosks
    .filter((kiosk) => ringIds.includes(kiosk.ringId))
    .map((kiosk) => kiosk.id)

  if (kioskIds.length === 0) {
    throw new Error('Er zijn geen actieve kiosken om te tellen.')
  }

  return repositories.event().createEvent({
    name: entry.name,
    date: entry.date,
    eventType: entry.eventType,
    status: EventStatus.READY_FOR_COUNTING,
    previousEventId: findPreviousEventId(events, entry.date),
    notes: entry.notes,
    activeRingIds: ringIds,
    activeKioskIds: kioskIds,
    assignedUserIds: [],
    createdById,
  })
}
