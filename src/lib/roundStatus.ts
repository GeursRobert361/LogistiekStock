import { RestockRoundStatus } from '@/types'

export const ROUND_STATUS_LABEL: Record<RestockRoundStatus, string> = {
  [RestockRoundStatus.DRAFT]: 'Concept',
  [RestockRoundStatus.PICKING]: 'Laden',
  [RestockRoundStatus.READY]: 'Klaar om te rijden',
  [RestockRoundStatus.CLAIMED]: 'Aangenomen',
  [RestockRoundStatus.IN_PROGRESS]: 'Bezig',
  [RestockRoundStatus.PARTIALLY_COMPLETED]: 'Deels geleverd',
  [RestockRoundStatus.COMPLETED]: 'Afgerond',
  [RestockRoundStatus.CANCELLED]: 'Geannuleerd',
}

/** Rondes die een vuller kan oppakken. */
export const CLAIMABLE_STATUSES: RestockRoundStatus[] = [RestockRoundStatus.READY]

/** Rondes die nog onderweg zijn. */
export const RUNNING_STATUSES: RestockRoundStatus[] = [
  RestockRoundStatus.CLAIMED,
  RestockRoundStatus.IN_PROGRESS,
]

export const FINISHED_STATUSES: RestockRoundStatus[] = [
  RestockRoundStatus.COMPLETED,
  RestockRoundStatus.PARTIALLY_COMPLETED,
  RestockRoundStatus.CANCELLED,
]
