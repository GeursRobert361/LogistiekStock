/**
 * Quarter-unit helpers.
 *
 * Internal representation: 1 package = 4 quarter units (integer).
 * Avoids floating-point comparison errors when working with 0.25 steps.
 */

const QUARTERS_PER_PACKAGE = 4

/**
 * Converts a package quantity (0, 0.25, 0.5, 0.75, 1, …) to integer quarter units.
 * Throws when `value` is not a valid multiple of 0.25.
 */
export function toQuarterUnits(value: number): number {
  if (!isFinite(value)) {
    throw new RangeError(`Ongeldige waarde: ${value}`)
  }
  const rounded = Math.round(value * QUARTERS_PER_PACKAGE)
  // Guard against float drift: re-derive and compare
  if (Math.abs(rounded / QUARTERS_PER_PACKAGE - value) > 0.001) {
    throw new RangeError(
      `Waarde ${value} is geen geldig veelvoud van 0,25. Gebruik 0, 0,25, 0,5, 0,75, 1, …`
    )
  }
  return rounded
}

/**
 * Converts integer quarter units back to a package quantity.
 */
export function fromQuarterUnits(units: number): number {
  return units / QUARTERS_PER_PACKAGE
}

/**
 * Formats a package quantity for Dutch display (dot → comma).
 * Examples: 4.5 → "4,5"  |  4.0 → "4"  |  4.25 → "4,25"
 */
export function formatQuantity(value: number): string {
  // Remove trailing zeros after decimal
  const str = value.toFixed(2).replace(/\.?0+$/, '')
  return str.replace('.', ',')
}

/**
 * Parses a Dutch-formatted quantity string to a number.
 * Accepts both comma and dot as decimal separator.
 */
export function parseQuantity(input: string): number {
  const normalized = input.trim().replace(',', '.')
  const value = parseFloat(normalized)
  if (isNaN(value)) {
    throw new RangeError(`Ongeldige invoer: "${input}"`)
  }
  return value
}

/**
 * Returns the fractional part in quarter units (0, 1, 2, or 3).
 * Input must already be in quarter units.
 */
export function getFractionQuarters(quarterUnits: number): 0 | 1 | 2 | 3 {
  return (((quarterUnits % 4) + 4) % 4) as 0 | 1 | 2 | 3
}

/**
 * Returns true when `quarterUnits` represents whole packages.
 *
 * Voorraadnormen horen in deze workflow hele verpakkingen te zijn: de
 * bijvulregels ronden een telling altijd af naar hele verpakkingen, dus een
 * norm van 4,5 zou nooit exact bereikbaar zijn.
 */
export function isWholePackages(quarterUnits: number): boolean {
  return Number.isInteger(quarterUnits) && quarterUnits % QUARTERS_PER_PACKAGE === 0
}

/**
 * Returns true when `value` is a valid package quantity (multiple of 0.25, non-negative).
 */
export function isValidQuantity(value: number): boolean {
  if (!isFinite(value) || value < 0) return false
  const qu = Math.round(value * QUARTERS_PER_PACKAGE)
  return Math.abs(qu / QUARTERS_PER_PACKAGE - value) <= 0.001
}
