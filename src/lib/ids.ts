import { v4, v5 } from 'uuid'

/**
 * Vaste namespace voor afgeleide (deterministische) id's.
 * Mag nooit wijzigen: dan zouden bestaande records een ander id krijgen.
 */
const LOGISTIEK_STOCK_NAMESPACE = '7c9e9d1e-2b3a-4f6d-9c1a-0d2f4b6a8c31'

export function newId(): string {
  return v4()
}

/**
 * Deterministisch id voor een telregel.
 *
 * Eén telregel is logisch uniek per (kioskCount, product). Door het id af te
 * leiden in plaats van te genereren kan herhaald bewerken van hetzelfde product
 * nooit meerdere records opleveren — lokaal niet en op de server niet.
 * Komt overeen met de Postgres-constraint `unique(kiosk_count_id, product_id)`.
 */
export function countEntryId(kioskCountId: string, productId: string): string {
  return v5(`count-entry:${kioskCountId}:${productId}`, LOGISTIEK_STOCK_NAMESPACE)
}

/**
 * Deterministisch id voor een bijvulbehoefte.
 * Uniek per (event, kiosk, product) — zie `unique(event_id, kiosk_id, product_id)`.
 * Maakt het genereren van bijvullijsten idempotent.
 */
export function restockRequirementId(
  eventId: string,
  kioskId: string,
  productId: string
): string {
  return v5(`restock-requirement:${eventId}:${kioskId}:${productId}`, LOGISTIEK_STOCK_NAMESPACE)
}

/** Deterministisch id voor een kiosktelling — uniek per (sessie, kiosk). */
export function kioskCountId(countSessionId: string, kioskId: string): string {
  return v5(`kiosk-count:${countSessionId}:${kioskId}`, LOGISTIEK_STOCK_NAMESPACE)
}
