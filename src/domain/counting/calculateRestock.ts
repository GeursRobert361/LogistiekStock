import { FractionRule, FractionStrategy } from '@/types/enums'
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
 *
 * Eén product wijkt af van de halve-regel. `FractionStrategy` bepaalt dat, en
 * die komt van de aanroeper: welk product welke strategie heeft is stamdata en
 * geen rekenregel, dus daar hoort deze functie niets van te weten. Alleen de
 * beslissing bij .50 verandert; .00, .25 en .75 doen in beide strategieën
 * hetzelfde, en de algemene 80%-regel blijft ongewijzigd de standaard.
 */
export function calculateRestockQuantity(
  input: RestockCalculationInput
): RestockCalculationResult {
  const {
    targetQuantity,
    countedQuantity,
    halfPackageThresholdPercentage = 80,
    fractionStrategy = FractionStrategy.STANDARD,
  } = input

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
  } else if (fractionStrategy === FractionStrategy.BREAK_AT_THREE_QUARTER) {
    // .50 telt hier niet mee: een halve doos is tijdens een evenement zo weg,
    // dus wie hem meerekent staat halverwege met lege handen. Alleen deze tak
    // wijkt af; de 80%-regel hieronder blijft voor al het andere gelden.
    effectiveQU = countedQU - 2
    appliedFractionRule = FractionRule.HALF_DOWN
  } else {
    // .50 → 80%-rule based on the whole-package count.
    //
    // De vergelijking `wholePackages <= (pct/100) * target` wordt hier zonder
    // deling uitgevoerd, zodat er geen afrondingsverschil kan ontstaan precies
    // op de grens (bijv. 12 tegenover 80% van 15):
    //
    //   wholePackages          <= (pct / 100) * targetPackages
    //   wholePackages * 100    <= pct * targetPackages
    //   wholePackages * 100 * 4 <= pct * targetQU          (targetQU = target * 4)
    //
    // Alle factoren zijn gehele getallen, dus de vergelijking is exact.
    const wholePackages = Math.floor(countedQU / 4)

    if (wholePackages * 400 <= targetQU * halfPackageThresholdPercentage) {
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
