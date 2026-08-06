import { describe, it, expect } from 'vitest'
import {
  toQuarterUnits,
  fromQuarterUnits,
  formatQuantity,
  parseQuantity,
  getFractionQuarters,
  isValidQuantity,
} from '../quarterUnits'

describe('toQuarterUnits', () => {
  it('converts whole numbers', () => {
    expect(toQuarterUnits(0)).toBe(0)
    expect(toQuarterUnits(1)).toBe(4)
    expect(toQuarterUnits(5)).toBe(20)
    expect(toQuarterUnits(15)).toBe(60)
  })

  it('converts quarter steps', () => {
    expect(toQuarterUnits(0.25)).toBe(1)
    expect(toQuarterUnits(0.5)).toBe(2)
    expect(toQuarterUnits(0.75)).toBe(3)
    expect(toQuarterUnits(4.25)).toBe(17)
    expect(toQuarterUnits(4.5)).toBe(18)
    expect(toQuarterUnits(4.75)).toBe(19)
    expect(toQuarterUnits(12.5)).toBe(50)
    expect(toQuarterUnits(13.5)).toBe(54)
    expect(toQuarterUnits(14.5)).toBe(58)
    expect(toQuarterUnits(14.75)).toBe(59)
  })

  it('throws for non-quarter values', () => {
    expect(() => toQuarterUnits(0.1)).toThrow()
    expect(() => toQuarterUnits(0.3)).toThrow()
    expect(() => toQuarterUnits(1.1)).toThrow()
    expect(() => toQuarterUnits(3.33)).toThrow()
  })

  it('throws for Infinity and NaN', () => {
    expect(() => toQuarterUnits(Infinity)).toThrow()
    expect(() => toQuarterUnits(NaN)).toThrow()
    expect(() => toQuarterUnits(-Infinity)).toThrow()
  })
})

describe('fromQuarterUnits', () => {
  it('converts back to package quantities', () => {
    expect(fromQuarterUnits(0)).toBe(0)
    expect(fromQuarterUnits(4)).toBe(1)
    expect(fromQuarterUnits(1)).toBe(0.25)
    expect(fromQuarterUnits(2)).toBe(0.5)
    expect(fromQuarterUnits(3)).toBe(0.75)
    expect(fromQuarterUnits(17)).toBe(4.25)
    expect(fromQuarterUnits(60)).toBe(15)
  })
})

describe('formatQuantity', () => {
  it('formats with Dutch comma separator', () => {
    expect(formatQuantity(4.5)).toBe('4,5')
    expect(formatQuantity(4.25)).toBe('4,25')
    expect(formatQuantity(4.75)).toBe('4,75')
  })

  it('omits trailing zeros', () => {
    expect(formatQuantity(4)).toBe('4')
    expect(formatQuantity(15)).toBe('15')
    expect(formatQuantity(0)).toBe('0')
  })

  it('formats mixed values', () => {
    expect(formatQuantity(12.5)).toBe('12,5')
    expect(formatQuantity(13.25)).toBe('13,25')
  })
})

describe('parseQuantity', () => {
  it('parses comma-separated Dutch input', () => {
    expect(parseQuantity('4,5')).toBe(4.5)
    expect(parseQuantity('4,25')).toBe(4.25)
    expect(parseQuantity('15')).toBe(15)
  })

  it('parses dot-separated input', () => {
    expect(parseQuantity('4.5')).toBe(4.5)
    expect(parseQuantity('12.75')).toBe(12.75)
  })

  it('trims whitespace', () => {
    expect(parseQuantity('  4,5  ')).toBe(4.5)
  })

  it('throws for non-numeric input', () => {
    expect(() => parseQuantity('abc')).toThrow()
    expect(() => parseQuantity('')).toThrow()
  })
})

describe('getFractionQuarters', () => {
  it('returns 0 for whole packages', () => {
    expect(getFractionQuarters(0)).toBe(0)
    expect(getFractionQuarters(4)).toBe(0)
    expect(getFractionQuarters(20)).toBe(0)
    expect(getFractionQuarters(60)).toBe(0)
  })

  it('returns 1 for .25 fraction', () => {
    expect(getFractionQuarters(1)).toBe(1)
    expect(getFractionQuarters(17)).toBe(1)
  })

  it('returns 2 for .50 fraction', () => {
    expect(getFractionQuarters(2)).toBe(2)
    expect(getFractionQuarters(18)).toBe(2)
    expect(getFractionQuarters(50)).toBe(2)
  })

  it('returns 3 for .75 fraction', () => {
    expect(getFractionQuarters(3)).toBe(3)
    expect(getFractionQuarters(19)).toBe(3)
    expect(getFractionQuarters(59)).toBe(3)
  })
})

describe('isValidQuantity', () => {
  it('accepts valid quarter multiples', () => {
    expect(isValidQuantity(0)).toBe(true)
    expect(isValidQuantity(0.25)).toBe(true)
    expect(isValidQuantity(0.5)).toBe(true)
    expect(isValidQuantity(0.75)).toBe(true)
    expect(isValidQuantity(1)).toBe(true)
    expect(isValidQuantity(15)).toBe(true)
    expect(isValidQuantity(4.75)).toBe(true)
  })

  it('rejects non-quarter multiples', () => {
    expect(isValidQuantity(0.1)).toBe(false)
    expect(isValidQuantity(0.3)).toBe(false)
    expect(isValidQuantity(1.1)).toBe(false)
  })

  it('rejects negative values', () => {
    expect(isValidQuantity(-1)).toBe(false)
    expect(isValidQuantity(-0.25)).toBe(false)
  })

  it('rejects infinite and NaN', () => {
    expect(isValidQuantity(Infinity)).toBe(false)
    expect(isValidQuantity(NaN)).toBe(false)
  })
})
