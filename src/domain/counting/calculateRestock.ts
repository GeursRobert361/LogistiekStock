import { FractionRule } from '@/types/enums'
import type { RestockCalculationInput, RestockCalculationResult } from '@/types/domain'
import { toQuarterUnits, fromQuarterUnits, getFractionQuarters, isValidQuantity } from '@/lib/quarterUnits'

/**
 * Calculates how many whole packages must be restocked.
 *
 * Fraction rules (applied to the counted quantity):
 *  .00 → no adjustment (NONE)
 *  .25 → always round down to whole (QUARTER_DOWN)
 *  .75 → always round up to whole (THREE_QUARTER_UP)
 *  .50 → 80%-rule:
 *    - floor(counted) <= threshold → round down (HALF_DOWN)
 *    - floor(counted) >  threshold → round up   (HALF_UP)
 *
 * Threshold defaults to 80% of targetQuantity.
 * Quantities are stored as integer quarter units to avoid floating-point issues.
 */
export function calculateRestockQuantity(
  input: RestockCalculationInput
): RestockCalculationResult {
  const { targetQuantity, countedQuantity, halfPackageThresholdPercentage = 80 } = input

  // ── Validation ──────────────────────────────────────────────────────────
  if (!isValidQuantity(targetQuantity)) {
    throw new RangeError(
      `Ongeldige normwaarde: ${targetQuantity}. Moet een niet-negatief veelvoud van 0,25 zijn.`
    )
  }
  if (!isValidQuantity(countedQuantity)) {
    throw new RangeError(
      `Ongeldig geteld aantal: ${countedQuantity}. Moet een niet-negatief veelvoud van 0,25 zijn.`
    )
  }
  if (
    halfPackageThresholdPercentage < 0 ||
    halfPackageThresholdPercentage > 100 ||
    !isFinite(halfPackageThresholdPercentage)
  ) {
    throw new RangeError(
      `Ongeldig drempelpercentage: ${halfPackageThresholdPercentage}. Moet tussen 0 en 100 liggen.`
    )
  }

  // ── Quarter-unit representation ──────────────────────────────────────────
  const targetQU = toQuarterUnits(targetQuantity)
  const countedQU = toQuarterUnits(countedQuantity)
  const fraction = getFractionQuarters(countedQU) // 0 | 1 | 2 | 3

  // ── Fraction rule ────────────────────────────────────────────────────────
  let effectiveQU: number
  let appliedFractionRule: FractionRule

  if (fraction === 0) {
    effectiveQU = countedQU
    appliedFractionRule = FractionRule.NONE
  } else if (fraction === 1) {
    // .25 → round down: strip the quarter
    effectiveQU = countedQU - 1
    appliedFractionRule = FractionRule.QUARTER_DOWN
  } else if (fraction === 3) {
    // .75 → round up: add a quarter to reach the next whole
    effectiveQU = countedQU + 1
    appliedFractionRule = FractionRule.THREE_QUARTER_UP
  } else {
    // .50 → 80%-rule based on the whole-package count
    const wholePackages = Math.floor(countedQuantity)
    const threshold = (halfPackageThresholdPercentage / 100) * targetQuantity

    if (wholePackages <= threshold) {
      // Round down: the half does not count
      effectiveQU = countedQU - 2
      appliedFractionRule = FractionRule.HALF_DOWN
    } else {
      // Round up: the half counts as a full package
      effectiveQU = countedQU + 2
      appliedFractionRule = FractionRule.HALF_UP
    }
  }

  // ── Restock quantity (whole packages, clamped at 0) ──────────────────────
  const restockQU = Math.max(0, targetQU - effectiveQU)

  // restockQU is always a multiple of 4 because both targetQU and effectiveQU
  // are adjusted to whole-package boundaries by the fraction rules above.
  const restockQuantity = restockQU / 4

  return {
    targetQuantity,
    countedQuantity,
    effectiveQuantity: fromQuarterUnits(effectiveQU),
    restockQuantity,
    appliedFractionRule,
  }
}
