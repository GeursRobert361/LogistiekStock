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
  /**
   * Kiosken die volgens een eigen stocklijst wél echte drankvoorraad houden,
   * ook zonder grote koeling. Hun tekorten gaan gewoon naar het magazijn.
   *
   * Leeg laten is de oude situatie, niet een risico: dan geldt overal de
   * generieke regel op het opslagtype.
   */
  localDrinkStockKioskIds?: ReadonlySet<string>
  /**
   * Normen die zonder telling volledig geleverd worden.
   *
   * Voor producten die na elk evenement worden opgehaald — de GFT-bakken. Die
   * staan niet op de tellijst, dus er is geen telregel om een tekort uit af te
   * leiden; de kiosk begint met niets en de behoefte is per definitie de hele
   * norm.
   *
   * Alleen voor kiosken die werkelijk geteld zijn: een overgeslagen kiosk is
   * niet bezocht en levert ook hier geen opdracht op.
   */
  alwaysRestockedStandards?: ReadonlyArray<{
    kioskId: string
    productId: string
    packages: number
  }>
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
    localDrinkStockKioskIds,
    alwaysRestockedStandards = [],
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
          keepsOwnDrinkStock: localDrinkStockKioskIds?.has(kioskCount.kioskId) ?? false,
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

  // Wat na elk evenement wordt opgehaald, gaat er elke ronde weer heen. Geen
  // telling, geen tekortberekening: de kiosk staat leeg, dus de hele norm moet
  // mee. Alleen bij de kiosken die deze ronde ook werkelijk geteld zijn.
  const alDrafts = new Set(drafts.map((draft) => `${draft.kioskId}:${draft.productId}`))
  for (const standard of alwaysRestockedStandards) {
    if (!newestByKiosk.has(standard.kioskId)) continue
    if (standard.packages <= 0) continue

    const key = `${standard.kioskId}:${standard.productId}`
    // Mocht er ooit tóch een telregel voor zijn — bijvoorbeeld uit een oudere
    // telling van voordat dit product van de tellijst ging — dan telt die en
    // komt er geen tweede regel bij.
    if (alDrafts.has(key)) continue

    const previous = existingByKey.get(key)
    drafts.push({
      eventId,
      kioskId: standard.kioskId,
      productId: standard.productId,
      requiredPackages: standard.packages,
      reservedPackages: previous?.reservedPackages ?? 0,
      deliveredPackages: previous?.deliveredPackages ?? 0,
    })
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
