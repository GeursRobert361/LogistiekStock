import { DeliveryReason } from '@/types'

/** Redenen om een kiosk tijdens het tellen over te slaan. */
export const SKIP_REASONS = [
  'Kiosk gesloten',
  'Kiosk niet bereikbaar',
  'Telling niet mogelijk',
  'Andere reden',
] as const

export type SkipReasonOption = (typeof SKIP_REASONS)[number]

export const OTHER_SKIP_REASON: SkipReasonOption = 'Andere reden'

/** Redenen waarom een levering afwijkt van wat gepland stond. */
export const DELIVERY_REASON_LABELS: Record<DeliveryReason, string> = {
  [DeliveryReason.ONVOLDOENDE_VOORRAAD]: 'Onvoldoende magazijnvoorraad',
  [DeliveryReason.NIET_OP_PALLET]: 'Niet op pallet',
  [DeliveryReason.KIOSK_ONBEREIKBAAR]: 'Kiosk niet bereikbaar',
  [DeliveryReason.VERKEERDE_TELLING]: 'Verkeerde telling',
  [DeliveryReason.AL_AANWEZIG]: 'Product al aanwezig',
  [DeliveryReason.BESCHADIGD]: 'Beschadigd product',
  [DeliveryReason.ANDERE_REDEN]: 'Andere reden',
}

export const DELIVERY_REASON_OPTIONS = Object.entries(DELIVERY_REASON_LABELS).map(
  ([value, label]) => ({ value: value as DeliveryReason, label })
)
