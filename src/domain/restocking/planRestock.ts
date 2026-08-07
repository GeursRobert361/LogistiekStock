import { RoundType, RestockRoundType } from '@/types/enums'
import type { Product, RestockRequirement } from '@/types/domain'
import { unplannedPackages } from './buildRequirements'

export interface RestockPlanItem {
  product: Product
  /** Nog te plannen verpakkingen (openstaand min gereserveerd). */
  totalRequiredPackages: number
  affectedKioskIds: string[]
  proposedRoundType: RestockRoundType
  estimatedPalletLoad: number
  priority: number
  /** Waarom dit een eigen ronde wordt. Handig om in de UI te tonen. */
  ownRoundReason?: 'PRODUCT_INSTELLING' | 'AANTAL' | 'PALLETBELASTING'
}

/** Boven deze geschatte palletbelasting krijgt een AUTO-product een eigen ronde. */
export const OWN_ROUND_PALLET_THRESHOLD = 80

/**
 * Zet openstaande behoeften om in een voorstel voor vulrondes.
 *
 * Producten met roundType PRODUCT_ROUND krijgen altijd een eigen ronde.
 * AUTO-producten krijgen er een zodra het aantal de ingestelde drempel haalt
 * of de geschatte palletbelasting te groot wordt — denk aan water en
 * bierbekers. De rest gaat op een gemengde pallet.
 */
export function planRestock(
  requirements: RestockRequirement[],
  products: Map<string, Product>
): {
  productRoundItems: RestockPlanItem[]
  mixedPalletItems: RestockPlanItem[]
} {
  const aggregated = new Map<string, { required: number; kiosks: string[] }>()

  for (const requirement of requirements) {
    const remaining = unplannedPackages(requirement)
    if (remaining <= 0) continue

    const existing = aggregated.get(requirement.productId) ?? { required: 0, kiosks: [] }
    aggregated.set(requirement.productId, {
      required: existing.required + remaining,
      kiosks: [...existing.kiosks, requirement.kioskId],
    })
  }

  const productRoundItems: RestockPlanItem[] = []
  const mixedPalletItems: RestockPlanItem[] = []

  for (const [productId, { required, kiosks }] of aggregated.entries()) {
    const product = products.get(productId)
    if (!product) continue

    const totalLoad = product.estimatedPalletLoad * required

    let proposedRoundType: RestockRoundType
    let ownRoundReason: RestockPlanItem['ownRoundReason']

    if (product.roundType === RoundType.PRODUCT_ROUND) {
      proposedRoundType = RestockRoundType.PRODUCT_ROUND
      ownRoundReason = 'PRODUCT_INSTELLING'
    } else if (product.roundType === RoundType.MIXED_PALLET) {
      proposedRoundType = RestockRoundType.MIXED_PALLET
    } else {
      // AUTO. Een drempel van 0 betekent "niet ingesteld" en telt dus niet mee.
      const reachesCountThreshold =
        product.ownRoundThreshold > 0 && required >= product.ownRoundThreshold
      const reachesPalletThreshold = totalLoad >= OWN_ROUND_PALLET_THRESHOLD

      if (reachesCountThreshold || reachesPalletThreshold) {
        proposedRoundType = RestockRoundType.PRODUCT_ROUND
        ownRoundReason = reachesCountThreshold ? 'AANTAL' : 'PALLETBELASTING'
      } else {
        proposedRoundType = RestockRoundType.MIXED_PALLET
      }
    }

    const item: RestockPlanItem = {
      product,
      totalRequiredPackages: required,
      affectedKioskIds: [...new Set(kiosks)],
      proposedRoundType,
      estimatedPalletLoad: totalLoad,
      priority: product.priority,
      ownRoundReason,
    }

    if (proposedRoundType === RestockRoundType.PRODUCT_ROUND) {
      productRoundItems.push(item)
    } else {
      mixedPalletItems.push(item)
    }
  }

  const byPriority = (a: RestockPlanItem, b: RestockPlanItem) =>
    b.priority - a.priority || b.totalRequiredPackages - a.totalRequiredPackages

  return {
    productRoundItems: productRoundItems.sort(byPriority),
    mixedPalletItems: mixedPalletItems.sort(byPriority),
  }
}
