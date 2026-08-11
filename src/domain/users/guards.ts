import { UserRole } from '@/types'

/**
 * De regels die voorkomen dat beheer zichzelf onmogelijk maakt.
 *
 * Pure functies, zonder database: dit is precies de logica die stil kapotgaat
 * en die je zonder opgetuigde omgeving wilt kunnen testen. Ze horen op de
 * server aangeroepen te worden en niet alleen in het formulier — een knop
 * verbergen is geen regel.
 */

export class UserGuardError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UserGuardError'
  }
}

export interface GuardTarget {
  id: string
  roles: UserRole[]
  isActive: boolean
}

export interface GuardContext {
  /** Het profiel waar de bewerking op slaat. */
  target: GuardTarget
  /** Wie de bewerking uitvoert. */
  currentUserId: string
  /**
   * Aantal actieve profielen met de rol ADMIN, het doelprofiel meegerekend.
   * Inactieve beheerders tellen niet mee: die kunnen niet inloggen en zijn dus
   * geen vervanger.
   */
  activeAdminCount: number
}

function isLastActiveAdmin(context: GuardContext): boolean {
  const { target, activeAdminCount } = context
  return target.isActive && target.roles.includes(UserRole.ADMIN) && activeAdminCount <= 1
}

/** Mag dit profiel op non-actief? */
export function assertMayDeactivate(context: GuardContext): void {
  if (context.target.id === context.currentUserId) {
    throw new UserGuardError(
      'Je kunt je eigen account niet deactiveren. Gebruik uitloggen als je wilt afsluiten.'
    )
  }
  if (isLastActiveAdmin(context)) {
    throw new UserGuardError(
      'Dit is de laatste actieve beheerder. Maak eerst iemand anders beheerder.'
    )
  }
}

/**
 * Mag dit profiel deze rollen krijgen?
 *
 * De laatste beheerder zijn rol afnemen komt op hetzelfde neer als hem
 * deactiveren: er is daarna niemand meer die gebruikers kan beheren.
 */
export function assertMaySetRoles(context: GuardContext, nextRoles: UserRole[]): void {
  if (nextRoles.length === 0) {
    throw new UserGuardError('Een account heeft minstens één rol nodig.')
  }
  if (!nextRoles.includes(UserRole.ADMIN) && isLastActiveAdmin(context)) {
    throw new UserGuardError(
      'Dit is de laatste actieve beheerder. Maak eerst iemand anders beheerder.'
    )
  }
}

/**
 * Is dit e-mailadres nog vrij?
 *
 * Zonder deze controle komt de unieke index bovendrijven als een databasefout,
 * en die is voor de gebruiker onleesbaar.
 */
export function assertEmailAvailable(params: {
  email: string
  existingEmails: string[]
  /** Bij bewerken: het eigen adres mag natuurlijk blijven staan. */
  ownEmail?: string
}): void {
  const genormaliseerd = normalizeEmail(params.email)

  if (genormaliseerd === '') {
    throw new UserGuardError('Vul een e-mailadres in.')
  }
  if (params.ownEmail && normalizeEmail(params.ownEmail) === genormaliseerd) return

  if (params.existingEmails.some((email) => normalizeEmail(email) === genormaliseerd)) {
    throw new UserGuardError('Er bestaat al een account met dit e-mailadres.')
  }
}

/** Hoofdletters en spaties mogen geen tweede account opleveren. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}
