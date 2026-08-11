import { CountSessionStatus } from '@/types'
import type { CountSession } from '@/types'

/**
 * Wanneer een telronde weggegooid mag worden.
 *
 * Weggooien is definitief, dus de regel is smal: alleen wat nog niet is
 * goedgekeurd. Een goedgekeurde ronde is afgehandeld — daar hangen
 * bijvulrondes en verbruikscijfers aan, en die zou je stilzwijgend ongeldig
 * maken. Voor een correctie op afgerond werk bestaat REOPENED, en die weg laat
 * de geschiedenis heel.
 */

export class ResetNotAllowedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ResetNotAllowedError'
  }
}

export function mayDiscardSession(session: Pick<CountSession, 'status'>): boolean {
  return session.status !== CountSessionStatus.APPROVED
}

export function assertMayDiscardSession(session: Pick<CountSession, 'status'>): void {
  if (!mayDiscardSession(session)) {
    throw new ResetNotAllowedError(
      'Deze telronde is al goedgekeurd. Heropen hem als er iets gecorrigeerd moet worden.'
    )
  }
}

export function assertMayResetKiosk(session: Pick<CountSession, 'status'>): void {
  if (!mayDiscardSession(session)) {
    throw new ResetNotAllowedError(
      'Deze telronde is al goedgekeurd. Heropen de kiosk in plaats van hem opnieuw te tellen.'
    )
  }
}

export interface DiscardSummary {
  kioskCount: number
  entryCount: number
}

/**
 * Wat er verdwijnt, in gewone taal.
 *
 * "Weet je het zeker?" zegt niets; een telling wel. Wie leest dat er 58
 * telregels verdwijnen weet of hij de goede ronde te pakken heeft.
 */
export function describeDiscard(summary: DiscardSummary): string {
  if (summary.kioskCount === 0 && summary.entryCount === 0) {
    return 'Er is in deze ronde nog niets geteld.'
  }

  const kiosken =
    summary.kioskCount === 1 ? '1 getelde kiosk' : `${summary.kioskCount} getelde kiosken`
  const regels = summary.entryCount === 1 ? '1 telregel' : `${summary.entryCount} telregels`

  return `Hiermee verdwijnen ${kiosken} en ${regels}. Dit is niet terug te draaien.`
}
