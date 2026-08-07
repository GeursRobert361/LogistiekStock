import { repositories } from '@/repositories'
import { isValidQuantity, isWholePackages, toQuarterUnits } from '@/lib/quarterUnits'
import type { KioskProductStandard, Product } from '@/types'

/**
 * Beheer van voorraadnormen.
 *
 * Normen horen hele verpakkingen te zijn: de bijvulregels ronden een telling
 * altijd af naar hele verpakkingen, dus een norm van 4,5 is nooit precies te
 * bereiken. Alleen producten waarvoor deelverpakkingen zijn toegestaan mogen
 * kwartwaarden krijgen.
 */

export const DEFAULT_HALF_PACKAGE_THRESHOLD = 80

export interface StandardValidationResult {
  quarterUnits: number
  error?: string
}

/** Controleert een ingevoerde norm en zet hem om in kwarteenheden. */
export function validateStandardValue(
  rawValue: string,
  product: Pick<Product, 'allowPartialPackage'>
): StandardValidationResult {
  const trimmed = rawValue.trim()
  if (trimmed === '') return { quarterUnits: 0 }

  const parsed = Number.parseFloat(trimmed.replace(',', '.'))
  if (!Number.isFinite(parsed) || parsed < 0) {
    return { quarterUnits: 0, error: 'Vul een getal van 0 of hoger in.' }
  }
  if (!isValidQuantity(parsed)) {
    return { quarterUnits: 0, error: 'Gebruik stappen van 0,25.' }
  }

  const quarterUnits = toQuarterUnits(parsed)
  if (!product.allowPartialPackage && !isWholePackages(quarterUnits)) {
    return {
      quarterUnits,
      error: 'Dit product staat alleen hele verpakkingen toe.',
    }
  }

  return { quarterUnits }
}

export async function saveStandard(params: {
  kioskId: string
  productId: string
  targetQuantityQuarters: number
  halfPackageThresholdPercentage?: number
}): Promise<KioskProductStandard> {
  return repositories.product().upsertStandard({
    kioskId: params.kioskId,
    productId: params.productId,
    targetQuantityQuarters: params.targetQuantityQuarters,
    halfPackageThresholdPercentage:
      params.halfPackageThresholdPercentage ?? DEFAULT_HALF_PACKAGE_THRESHOLD,
    // Een norm van 0 betekent "dit product hoort niet in deze kiosk".
    isActive: params.targetQuantityQuarters > 0,
  })
}

/**
 * Kopieert alle normen van één kiosk naar andere kiosken.
 * Geeft terug hoeveel normen zijn overgenomen.
 */
export async function copyStandards(
  fromKioskId: string,
  toKioskIds: string[]
): Promise<number> {
  const targets = toKioskIds.filter((id) => id !== fromKioskId)
  if (targets.length === 0) return 0

  const source = await repositories.product().getStandards(fromKioskId)
  if (source.length === 0) {
    throw new Error('De bronkiosk heeft nog geen normen om te kopiëren.')
  }

  await repositories.product().bulkUpsertStandards(
    targets.flatMap((kioskId) =>
      source.map((standard) => ({
        kioskId,
        productId: standard.productId,
        targetQuantityQuarters: standard.targetQuantityQuarters,
        halfPackageThresholdPercentage: standard.halfPackageThresholdPercentage,
        isActive: standard.isActive,
      }))
    )
  )

  return source.length * targets.length
}

/** Zet één product op dezelfde norm bij meerdere kiosken. */
export async function applyStandardToKiosks(params: {
  kioskIds: string[]
  productId: string
  targetQuantityQuarters: number
  halfPackageThresholdPercentage?: number
}): Promise<number> {
  if (params.kioskIds.length === 0) return 0

  await repositories.product().bulkUpsertStandards(
    params.kioskIds.map((kioskId) => ({
      kioskId,
      productId: params.productId,
      targetQuantityQuarters: params.targetQuantityQuarters,
      halfPackageThresholdPercentage:
        params.halfPackageThresholdPercentage ?? DEFAULT_HALF_PACKAGE_THRESHOLD,
      isActive: params.targetQuantityQuarters > 0,
    }))
  )

  return params.kioskIds.length
}
