import { KioskCountStatus, DrinkStorageType } from '@/types/enums'
import type { KioskCount, CountEntry, RestockRequirement } from '@/types/domain'
import { shouldGenerateCentralRestock } from './centralRestock'

export type RequirementDraft = Omit<RestockRequirement, 'id' | 'createdAt' | 'updatedAt'>

export interface BuildRequirementsInput {
  eventId: string
  /** Alle kiosktellingen van de goedgekeurde telronde(s). */
  kioskCounts: KioskCount[]
  /** Telregels per kioskCount-id. */
  entriesByKioskCount: Map<string, CountEntry[]>
  /** Bestaande behoeften — hun geleverde/gereserveerde aantallen blijven staan. */
  existing?: RestockRequirement[]
  /**
   * Opslagtype per kiosk-id, en of een product bij een satelliet uit een grote
   * koeling komt. Nodig voor de satellietuitzondering.
   *
   * Ontbreekt een kiosk of product in deze kaarten, dan gedraagt de regel zich
   * als vroeger en ontstaat er gewoon een behoefte. Dat is de veilige kant:
   * een behoefte te veel valt op de vloer op, een behoefte te weinig betekent
   * een lege kiosk.
   */
  kioskStorage?: Map<string, DrinkStorageType>
  satelliteSuppliedProductIds?: ReadonlySet<string>
}

/**
 * Zet een goedgekeurde telling om in bijvulbehoeften.
 *
 * Pure functie, en bewust idempotent: dezelfde telling twee keer verwerken
 * levert exact dezelfde lijst op. Reeds gereserveerde en geleverde aantallen
 * van bestaande behoeften blijven behouden, zodat opnieuw goedkeuren geen
 * geleverde voorraad "vergeet".
 *
 * Alleen kiosken met status COMPLETED tellen mee: een overgeslagen kiosk is
 * niet geteld en mag dus geen bijvulopdracht opleveren.
 */
export function buildRestockRequirements(input: BuildRequirementsInput): RequirementDraft[] {
  const {
    eventId,
    kioskCounts,
    entriesByKioskCount,
    existing = [],
    kioskStorage,
    satelliteSuppliedProductIds,
  } = input

  const existingByKey = new Map(
    existing.map((req) => [`${req.kioskId}:${req.productId}`, req])
  )

  // Bij meerdere tellingen van dezelfde kiosk telt de meest recente.
  const newestByKiosk = new Map<string, KioskCount>()
  for (const kioskCount of kioskCounts) {
    if (kioskCount.status !== KioskCountStatus.COMPLETED) continue
    const current = newestByKiosk.get(kioskCount.kioskId)
    if (!current || kioskCount.updatedAt > current.updatedAt) {
      newestByKiosk.set(kioskCount.kioskId, kioskCount)
    }
  }

  const drafts: RequirementDraft[] = []

  for (const kioskCount of newestByKiosk.values()) {
    const entries = entriesByKioskCount.get(kioskCount.id) ?? []
    for (const entry of entries) {
      if (entry.restockQuantityPackages <= 0) continue

      // Hier, en niet in een palletscherm verderop: wie de behoefte pas later
      // wegfiltert houdt hem als open tekort in de lijst staan.
      const mayRestock = shouldGenerateCentralRestock({
        kiosk: {
          drinkStorageType: kioskStorage?.get(kioskCount.kioskId) ?? DrinkStorageType.NONE,
        },
        product: {
          suppliedFromLargeCoolerForSatellite:
            satelliteSuppliedProductIds?.has(entry.productId) ?? false,
        },
      })
      if (!mayRestock) continue

      const previous = existingByKey.get(`${kioskCount.kioskId}:${entry.productId}`)
      drafts.push({
        eventId,
        kioskId: kioskCount.kioskId,
        productId: entry.productId,
        requiredPackages: entry.restockQuantityPackages,
        reservedPackages: previous?.reservedPackages ?? 0,
        deliveredPackages: previous?.deliveredPackages ?? 0,
      })
    }
  }

  // Stabiele volgorde maakt het resultaat vergelijkbaar tussen twee runs.
  return drafts.sort(
    (a, b) => a.kioskId.localeCompare(b.kioskId) || a.productId.localeCompare(b.productId)
  )
}

/** Nog openstaand: nodig min geleverd. Reserveringen tellen niet als geleverd. */
export function openPackages(requirement: RestockRequirement): number {
  return Math.max(0, requirement.requiredPackages - requirement.deliveredPackages)
}

/** Nog te plannen: openstaand min wat al op een actieve pallet is gereserveerd. */
export function unplannedPackages(requirement: RestockRequirement): number {
  return Math.max(0, openPackages(requirement) - requirement.reservedPackages)
}
