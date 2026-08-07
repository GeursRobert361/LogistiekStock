import { EventType } from '@/types'

/** Hoe een soort evenement op het scherm heet. */
export const EVENT_TYPE_LABEL: Record<EventType, string> = {
  [EventType.VOETBAL]: 'Voetbal',
  [EventType.CONCERT]: 'Concert',
  [EventType.OVERIG]: 'Overig',
}
