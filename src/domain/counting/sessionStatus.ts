import { CountSessionStatus, EventStatus } from '@/types/enums'

/**
 * Statusovergangen van een telronde.
 *
 * De normale weg is IN_PROGRESS → SUBMITTED → APPROVED. Blijkt er achteraf
 * iets niet te kloppen, dan gaat een goedgekeurde ronde terug via REOPENED en
 * loopt hij dezelfde weg opnieuw:
 *
 *     APPROVED → REOPENED → SUBMITTED → APPROVED
 *
 * Zonder die expliciete lijst kan een ronde van elke stand naar elke andere
 * springen, en dan is achteraf niet meer te zeggen of een goedkeuring op de
 * cijfers van vóór of ná een correctie sloeg.
 */
const ALLOWED_TRANSITIONS: Record<CountSessionStatus, readonly CountSessionStatus[]> = {
  [CountSessionStatus.NOT_STARTED]: [CountSessionStatus.IN_PROGRESS, CountSessionStatus.PAUSED],
  [CountSessionStatus.IN_PROGRESS]: [CountSessionStatus.PAUSED, CountSessionStatus.SUBMITTED],
  [CountSessionStatus.PAUSED]: [CountSessionStatus.IN_PROGRESS, CountSessionStatus.SUBMITTED],
  // Een ingediende ronde kan alsnog worden goedgekeurd of teruggestuurd.
  [CountSessionStatus.SUBMITTED]: [
    CountSessionStatus.APPROVED,
    CountSessionStatus.REOPENED,
    CountSessionStatus.IN_PROGRESS,
  ],
  // Goedgekeurd is eindstation, tenzij er wordt heropend.
  [CountSessionStatus.APPROVED]: [CountSessionStatus.REOPENED],
  [CountSessionStatus.REOPENED]: [
    CountSessionStatus.IN_PROGRESS,
    CountSessionStatus.PAUSED,
    CountSessionStatus.SUBMITTED,
  ],
}

export const SESSION_STATUS_LABEL: Record<CountSessionStatus, string> = {
  [CountSessionStatus.NOT_STARTED]: 'Niet gestart',
  [CountSessionStatus.IN_PROGRESS]: 'Bezig',
  [CountSessionStatus.PAUSED]: 'Gepauzeerd',
  [CountSessionStatus.SUBMITTED]: 'Ingediend',
  [CountSessionStatus.APPROVED]: 'Goedgekeurd',
  [CountSessionStatus.REOPENED]: 'Heropend',
}

/** Dezelfde stand opnieuw zetten mag altijd: dat verandert niets. */
export function canTransitionSession(
  from: CountSessionStatus,
  to: CountSessionStatus
): boolean {
  return from === to || ALLOWED_TRANSITIONS[from].includes(to)
}

export function assertSessionTransition(
  from: CountSessionStatus,
  to: CountSessionStatus
): void {
  if (!canTransitionSession(from, to)) {
    throw new Error(
      `Een telronde kan niet van "${SESSION_STATUS_LABEL[from]}" naar ` +
        `"${SESSION_STATUS_LABEL[to]}".`
    )
  }
}

/**
 * De evenementstatus die bij deze telrondestatus hoort.
 *
 * Belangrijk bij heropenen: het evenement mag dan niet op READY_FOR_RESTOCK
 * blijven staan, want de vulbehoefte klopt op dat moment niet meer.
 */
export function eventStatusForSession(status: CountSessionStatus): EventStatus {
  switch (status) {
    case CountSessionStatus.NOT_STARTED:
      return EventStatus.READY_FOR_COUNTING
    case CountSessionStatus.SUBMITTED:
      return EventStatus.COUNT_REVIEW
    case CountSessionStatus.APPROVED:
      return EventStatus.READY_FOR_RESTOCK
    default:
      // IN_PROGRESS, PAUSED en REOPENED: er wordt (weer) geteld.
      return EventStatus.COUNTING
  }
}
