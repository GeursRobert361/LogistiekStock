import type { KioskCount, CountEntry, RestockRequirement } from '@/types/domain'
import type { DrinkStorageType } from '@/types/enums'
import { buildRestockRequirements, type RequirementDraft } from './buildRequirements'

/**
 * Bijvulbehoeften gelijktrekken met een (opnieuw) goedgekeurde telling.
 *
 * `buildRestockRequirements` levert alleen regels op waar iets nodig is. Dat is
 * genoeg voor een eerste goedkeuring, maar niet voor een tweede: een behoefte
 * van 6 die na correctie 0 wordt, zou anders gewoon blijven staan en later
 * alsnog gevuld worden. Daarom wordt hier de volledige gewenste set vergeleken
 * met wat er al ligt.
 *
 * De vergelijking blijft binnen de kiosken van de betreffende telronde. Een
 * telronde gaat over één ring; het goedkeuren van de eerste ring mag de
 * behoeften van de tweede niet aanraken.
 */

export interface ReconcileRequirementsInput {
  eventId: string
  /** Kiosktellingen van de goedgekeurde telronde. */
  kioskCounts: KioskCount[]
  /** Telregels per kioskCount-id. */
  entriesByKioskCount: Map<string, CountEntry[]>
  /** Alle bestaande behoeften van het evenement. */
  existing: RestockRequirement[]
  /** Kiosken waar deze telronde over gaat; daarbuiten wordt niets gewijzigd. */
  scopeKioskIds: Iterable<string>
  /** Zie `buildRestockRequirements`: nodig voor de satellietuitzondering. */
  kioskStorage?: Map<string, DrinkStorageType>
  satelliteSuppliedProductIds?: ReadonlySet<string>
}

export interface RequirementReconciliation {
  /** Nieuw of gewijzigd — wegschrijven. */
  toUpsert: RequirementDraft[]
  /** Niet langer nodig — op nul zetten. De rij blijft bestaan voor de historie. */
  toClear: RequirementDraft[]
  /**
   * Zou wijzigen, maar er is al voorraad voor gereserveerd of geleverd.
   * Stil overschrijven zou een vulronde onderuithalen of leverhistorie
   * onverklaarbaar maken.
   */
  blocked: RestockRequirement[]
  /** De volledige gewenste set binnen de scope, na reconciliatie. */
  active: RequirementDraft[]
}

function compositeKey(kioskId: string, productId: string): string {
  return `${kioskId}:${productId}`
}

/** Een behoefte ligt vast zodra er voorraad voor gereserveerd of geleverd is. */
export function isRequirementInUse(requirement: RestockRequirement): boolean {
  return requirement.reservedPackages > 0 || requirement.deliveredPackages > 0
}

export function reconcileRestockRequirements(
  input: ReconcileRequirementsInput
): RequirementReconciliation {
  const {
    eventId,
    kioskCounts,
    entriesByKioskCount,
    existing,
    scopeKioskIds,
    kioskStorage,
    satelliteSuppliedProductIds,
  } = input
  const scope = new Set(scopeKioskIds)

  const desired = buildRestockRequirements({
    eventId,
    kioskCounts,
    entriesByKioskCount,
    existing,
    kioskStorage,
    satelliteSuppliedProductIds,
  }).filter((draft) => scope.has(draft.kioskId))

  const desiredByKey = new Map(
    desired.map((draft) => [compositeKey(draft.kioskId, draft.productId), draft])
  )

  const toUpsert: RequirementDraft[] = []
  const toClear: RequirementDraft[] = []
  const blocked: RestockRequirement[] = []
  const seen = new Set<string>()

  for (const requirement of existing) {
    if (!scope.has(requirement.kioskId)) continue

    const key = compositeKey(requirement.kioskId, requirement.productId)
    seen.add(key)

    const wanted = desiredByKey.get(key)
    const wantedPackages = wanted?.requiredPackages ?? 0
    if (wantedPackages === requirement.requiredPackages) continue

    if (isRequirementInUse(requirement)) {
      blocked.push(requirement)
      continue
    }

    if (wanted) {
      toUpsert.push(wanted)
    } else {
      toClear.push({
        eventId,
        kioskId: requirement.kioskId,
        productId: requirement.productId,
        requiredPackages: 0,
        reservedPackages: 0,
        deliveredPackages: 0,
      })
    }
  }

  for (const draft of desired) {
    if (seen.has(compositeKey(draft.kioskId, draft.productId))) continue
    toUpsert.push(draft)
  }

  return { toUpsert, toClear, blocked, active: desired }
}
