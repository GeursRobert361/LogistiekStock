import type { Kiosk } from '@/types'

/**
 * Hoe een kiosk op het scherm heet.
 *
 * Meestal gewoon het nummer, maar niet elk telpunt heeft er een: de cubes
 * tegenover 120 heten op de vloer "120 Cubes". Wat de vloer zegt wint, want
 * daar wordt naar gezocht.
 */
export function kioskLabel(kiosk: Pick<Kiosk, 'number' | 'label'> | undefined | null): string {
  if (!kiosk) return ''
  return kiosk.label?.trim() || String(kiosk.number)
}

/** Zelfde, maar met "Kiosk" ervoor — voor lijsten en keuzelijsten. */
export function kioskTitle(kiosk: Pick<Kiosk, 'number' | 'label'> | undefined | null): string {
  if (!kiosk) return ''
  const label = kiosk.label?.trim()
  return label ? label : `Kiosk ${kiosk.number}`
}
