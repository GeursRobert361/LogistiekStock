import { describe, it, expect } from 'vitest'
import {
  canTransitionSession,
  assertSessionTransition,
  eventStatusForSession,
  blocksSessionWrite,
} from '../sessionStatus'
import { CountSessionStatus, EventStatus } from '@/types'

describe('statusovergangen van een telronde', () => {
  it('loopt de normale weg naar goedgekeurd', () => {
    expect(
      canTransitionSession(CountSessionStatus.IN_PROGRESS, CountSessionStatus.SUBMITTED)
    ).toBe(true)
    expect(
      canTransitionSession(CountSessionStatus.SUBMITTED, CountSessionStatus.APPROVED)
    ).toBe(true)
  })

  it('laat een goedgekeurde ronde alleen via heropenen terug', () => {
    expect(
      canTransitionSession(CountSessionStatus.APPROVED, CountSessionStatus.REOPENED)
    ).toBe(true)
    expect(
      canTransitionSession(CountSessionStatus.APPROVED, CountSessionStatus.IN_PROGRESS)
    ).toBe(false)
    expect(
      canTransitionSession(CountSessionStatus.APPROVED, CountSessionStatus.SUBMITTED)
    ).toBe(false)
  })

  it('loopt na heropenen opnieuw via ingediend naar goedgekeurd', () => {
    expect(
      canTransitionSession(CountSessionStatus.REOPENED, CountSessionStatus.SUBMITTED)
    ).toBe(true)
    expect(
      canTransitionSession(CountSessionStatus.REOPENED, CountSessionStatus.APPROVED)
    ).toBe(false)
  })

  it('staat dezelfde stand opnieuw zetten toe', () => {
    expect(
      canTransitionSession(CountSessionStatus.APPROVED, CountSessionStatus.APPROVED)
    ).toBe(true)
  })

  it('noemt in de foutmelding waar het misgaat', () => {
    expect(() =>
      assertSessionTransition(CountSessionStatus.APPROVED, CountSessionStatus.IN_PROGRESS)
    ).toThrow(/"Goedgekeurd" naar "Bezig"/)
  })
})

describe('een bezette ring', () => {
  it('weigert een nieuwe ronde naast een lopende', () => {
    expect(blocksSessionWrite({ isExisting: false, hasConflictingActiveSession: true })).toBe(true)
  })

  it('laat een nieuwe ronde toe als de ring vrij is', () => {
    expect(blocksSessionWrite({ isExisting: false, hasConflictingActiveSession: false })).toBe(
      false
    )
  })

  it('blijft een bestaande ronde bijwerken, ook naast een andere actieve ronde', () => {
    // Zo ontstond de storing: de outbox schrijft elke wijziging weg met
    // dezelfde upsert als het aanmaken. Ging die door de nieuwe-rondecontrole,
    // dan kwam er van een telling die al liep niets meer op de server — en met
    // gegevens van vóór deze regel staan er soms twee actieve rondes.
    expect(blocksSessionWrite({ isExisting: true, hasConflictingActiveSession: true })).toBe(false)
  })

  it('laat een bestaande ronde sowieso met rust', () => {
    expect(blocksSessionWrite({ isExisting: true, hasConflictingActiveSession: false })).toBe(false)
  })
})

describe('evenementstatus bij een telrondestatus', () => {
  it('zet het evenement klaar om te vullen zodra de telling is goedgekeurd', () => {
    expect(eventStatusForSession(CountSessionStatus.APPROVED)).toBe(
      EventStatus.READY_FOR_RESTOCK
    )
  })

  it('houdt een heropende ronde weg bij READY_FOR_RESTOCK', () => {
    // Anders zou de planner blijven vullen op cijfers die net herzien worden.
    expect(eventStatusForSession(CountSessionStatus.REOPENED)).toBe(EventStatus.COUNTING)
  })

  it('zet een ingediende ronde op controleren', () => {
    expect(eventStatusForSession(CountSessionStatus.SUBMITTED)).toBe(
      EventStatus.COUNT_REVIEW
    )
  })
})
