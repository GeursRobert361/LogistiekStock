import { RoundType } from '@/types/enums'
import type { Product, RestockRequirement } from '@/types/domain'

export interface RestockPlanItem {
  product: Product
  totalRequiredPackages: number
  affectedKioskIds: string[]
  proposedRoundType: 'PRODUCT_ROUND' | 'MIXED_PALLET'
  estimatedPalletLoad: number
  priority: number
}

const OWN_ROUND_PALLET_THRESHOLD = 80

/**
 * Generates a restock plan from open requirements.
 * Returns items sorted by priority (highest first), split into:
 * - productRoundItems: each gets its own round
 * - mixedPalletItems: combined on shared pallets
 */
export function planRestock(
  requirements: RestockRequirement[],
  products: Map<string, Product>
): {
  productRoundItems: RestockPlanItem[]
  mixedPalletItems: RestockPlanItem[]
} {
  // Aggregate requirements per product
  const aggregated = new Map<string, { required: number; kiosks: string[] }>()

  for (const req of requirements) {
    const remaining = req.requiredPackages - req.deliveredPackages - req.reservedPackages
    if (remaining <= 0) continue

    const existing = aggregated.get(req.productId) ?? { required: 0, kiosks: [] }
    aggregated.set(req.productId, {
      required: existing.required + remaining,
      kiosks: [...existing.kiosks, req.kioskId],
    })
  }

  const productRoundItems: RestockPlanItem[] = []
  const mixedPalletItems: RestockPlanItem[] = []

  for (const [productId, { required, kiosks }] of aggregated.entries()) {
    const product = products.get(productId)
    if (!product) continue

    const totalLoad = product.estimatedPalletLoad * required

    let proposedRoundType: 'PRODUCT_ROUND' | 'MIXED_PALLET'

    if (product.roundType === RoundType.PRODUCT_ROUND) {
      proposedRoundType = 'PRODUCT_ROUND'
    } else if (product.roundType === RoundType.MIXED_PALLET) {
      proposedRoundType = 'MIXED_PALLET'
    } else {
      // AUTO: own round when quantity exceeds threshold OR pallet load is high
      proposedRoundType =
        required >= product.ownRoundThreshold || totalLoad >= OWN_ROUND_PALLET_THRESHOLD
          ? 'PRODUCT_ROUND'
          : 'MIXED_PALLET'
    }

    const item: RestockPlanItem = {
      product,
      totalRequiredPackages: required,
      affectedKioskIds: [...new Set(kiosks)],
      proposedRoundType,
      estimatedPalletLoad: totalLoad,
      priority: product.priority,
    }

    if (proposedRoundType === 'PRODUCT_ROUND') {
      productRoundItems.push(item)
    } else {
      mixedPalletItems.push(item)
    }
  }

  // Sort by priority desc
  const byPriority = (a: RestockPlanItem, b: RestockPlanItem) => b.priority - a.priority
  return {
    productRoundItems: productRoundItems.sort(byPriority),
    mixedPalletItems: mixedPalletItems.sort(byPriority),
  }
}
