import { describe, it, expect } from 'vitest'
import {
  assertMayDeactivate,
  assertMaySetRoles,
  assertEmailAvailable,
  normalizeEmail,
  UserGuardError,
  type GuardContext,
} from '../guards'
import { UserRole } from '@/types'

const beheerder: GuardContext['target'] = {
  id: 'profiel-beheerder',
  roles: [UserRole.ADMIN],
  isActive: true,
}

const teller: GuardContext['target'] = {
  id: 'profiel-teller',
  roles: [UserRole.TELLER],
  isActive: true,
}

/** Iemand anders voert de bewerking uit, tenzij een test dat omdraait. */
const doorEenAnder = 'profiel-iemand-anders'

describe('assertMayDeactivate', () => {
  it('weigert de laatste actieve beheerder', () => {
    expect(() =>
      assertMayDeactivate({
        target: beheerder,
        currentUserId: doorEenAnder,
        activeAdminCount: 1,
      })
    ).toThrow(UserGuardError)
  })

  it('staat het toe zodra er een tweede actieve beheerder is', () => {
    expect(() =>
      assertMayDeactivate({
        target: beheerder,
        currentUserId: doorEenAnder,
        activeAdminCount: 2,
      })
    ).not.toThrow()
  })

  it('weigert je eigen account, ook met andere beheerders erbij', () => {
    expect(() =>
      assertMayDeactivate({
        target: beheerder,
        currentUserId: beheerder.id,
        activeAdminCount: 5,
      })
    ).toThrow(/eigen account/i)
  })

  it('laat een teller gewoon deactiveren', () => {
    expect(() =>
      assertMayDeactivate({
        target: teller,
        currentUserId: doorEenAnder,
        activeAdminCount: 1,
      })
    ).not.toThrow()
  })

  it('bemoeit zich niet met een beheerder die al inactief is', () => {
    expect(() =>
      assertMayDeactivate({
        target: { ...beheerder, isActive: false },
        currentUserId: doorEenAnder,
        activeAdminCount: 1,
      })
    ).not.toThrow()
  })
})

describe('assertMaySetRoles', () => {
  it('weigert de laatste beheerder zijn beheerdersrol af te nemen', () => {
    expect(() =>
      assertMaySetRoles(
        { target: beheerder, currentUserId: doorEenAnder, activeAdminCount: 1 },
        [UserRole.TELLER]
      )
    ).toThrow(/laatste actieve beheerder/i)
  })

  it('staat het toe wanneer er nog een beheerder overblijft', () => {
    expect(() =>
      assertMaySetRoles(
        { target: beheerder, currentUserId: doorEenAnder, activeAdminCount: 2 },
        [UserRole.TELLER]
      )
    ).not.toThrow()
  })

  it('staat toe dat de laatste beheerder er een rol bij krijgt', () => {
    expect(() =>
      assertMaySetRoles({ target: beheerder, currentUserId: doorEenAnder, activeAdminCount: 1 }, [
        UserRole.ADMIN,
        UserRole.VULLER,
      ])
    ).not.toThrow()
  })

  it('weigert een account zonder rollen', () => {
    expect(() =>
      assertMaySetRoles({ target: teller, currentUserId: doorEenAnder, activeAdminCount: 2 }, [])
    ).toThrow(/minstens één rol/i)
  })
})

describe('assertEmailAvailable', () => {
  it('weigert een adres dat al bestaat', () => {
    expect(() =>
      assertEmailAvailable({ email: 'jan@arena.nl', existingEmails: ['jan@arena.nl'] })
    ).toThrow(/bestaat al/i)
  })

  it('ziet hoofdletters en spaties niet als een ander adres', () => {
    expect(() =>
      assertEmailAvailable({ email: '  JAN@Arena.nl ', existingEmails: ['jan@arena.nl'] })
    ).toThrow(/bestaat al/i)
  })

  it('laat het eigen adres staan bij bewerken', () => {
    expect(() =>
      assertEmailAvailable({
        email: 'jan@arena.nl',
        existingEmails: ['jan@arena.nl', 'sara@arena.nl'],
        ownEmail: 'jan@arena.nl',
      })
    ).not.toThrow()
  })

  it('weigert een leeg adres', () => {
    expect(() => assertEmailAvailable({ email: '   ', existingEmails: [] })).toThrow(/vul een/i)
  })

  it('laat een vrij adres door', () => {
    expect(() =>
      assertEmailAvailable({ email: 'nieuw@arena.nl', existingEmails: ['jan@arena.nl'] })
    ).not.toThrow()
  })
})

describe('normalizeEmail', () => {
  it('maakt kleine letters en haalt spaties weg', () => {
    expect(normalizeEmail('  Jan@Arena.NL  ')).toBe('jan@arena.nl')
  })
})
