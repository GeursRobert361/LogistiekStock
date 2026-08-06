import { describe, it, expect } from 'vitest'
import { calculateRestockQuantity } from '../calculateRestock'
import { FractionRule } from '@/types/enums'

// Helper for concise assertions
function restock(
  targetQuantity: number,
  countedQuantity: number,
  halfPct?: number
) {
  return calculateRestockQuantity({ targetQuantity, countedQuantity, halfPackageThresholdPercentage: halfPct })
}

describe('calculateRestockQuantity — spec examples (norm 15)', () => {
  // From the spec: all these values with norm 15 and default 80%

  it('4.25 aanwezig → bijvullen 11', () => {
    const r = restock(15, 4.25)
    expect(r.effectiveQuantity).toBe(4)
    expect(r.restockQuantity).toBe(11)
    expect(r.appliedFractionRule).toBe(FractionRule.QUARTER_DOWN)
  })

  it('4.5 aanwezig → bijvullen 11 (HALF_DOWN: 4 <= 12)', () => {
    const r = restock(15, 4.5)
    expect(r.effectiveQuantity).toBe(4)
    expect(r.restockQuantity).toBe(11)
    expect(r.appliedFractionRule).toBe(FractionRule.HALF_DOWN)
  })

  it('4.75 aanwezig → bijvullen 10', () => {
    const r = restock(15, 4.75)
    expect(r.effectiveQuantity).toBe(5)
    expect(r.restockQuantity).toBe(10)
    expect(r.appliedFractionRule).toBe(FractionRule.THREE_QUARTER_UP)
  })

  it('12.25 aanwezig → bijvullen 3', () => {
    const r = restock(15, 12.25)
    expect(r.effectiveQuantity).toBe(12)
    expect(r.restockQuantity).toBe(3)
    expect(r.appliedFractionRule).toBe(FractionRule.QUARTER_DOWN)
  })

  it('12.5 aanwezig → bijvullen 3 (HALF_DOWN: 12 <= 12)', () => {
    // 80% of 15 = 12.0 — exactly at threshold → HALF_DOWN
    const r = restock(15, 12.5)
    expect(r.effectiveQuantity).toBe(12)
    expect(r.restockQuantity).toBe(3)
    expect(r.appliedFractionRule).toBe(FractionRule.HALF_DOWN)
  })

  it('12.75 aanwezig → bijvullen 2', () => {
    const r = restock(15, 12.75)
    expect(r.effectiveQuantity).toBe(13)
    expect(r.restockQuantity).toBe(2)
    expect(r.appliedFractionRule).toBe(FractionRule.THREE_QUARTER_UP)
  })

  it('13.25 aanwezig → bijvullen 2', () => {
    const r = restock(15, 13.25)
    expect(r.effectiveQuantity).toBe(13)
    expect(r.restockQuantity).toBe(2)
    expect(r.appliedFractionRule).toBe(FractionRule.QUARTER_DOWN)
  })

  it('13.5 aanwezig → bijvullen 1 (HALF_UP: 13 > 12)', () => {
    const r = restock(15, 13.5)
    expect(r.effectiveQuantity).toBe(14)
    expect(r.restockQuantity).toBe(1)
    expect(r.appliedFractionRule).toBe(FractionRule.HALF_UP)
  })

  it('13.75 aanwezig → bijvullen 1', () => {
    const r = restock(15, 13.75)
    expect(r.effectiveQuantity).toBe(14)
    expect(r.restockQuantity).toBe(1)
    expect(r.appliedFractionRule).toBe(FractionRule.THREE_QUARTER_UP)
  })

  it('14.25 aanwezig → bijvullen 1', () => {
    const r = restock(15, 14.25)
    expect(r.effectiveQuantity).toBe(14)
    expect(r.restockQuantity).toBe(1)
    expect(r.appliedFractionRule).toBe(FractionRule.QUARTER_DOWN)
  })

  it('14.5 aanwezig → bijvullen 0 (HALF_UP: 14 > 12)', () => {
    const r = restock(15, 14.5)
    expect(r.effectiveQuantity).toBe(15)
    expect(r.restockQuantity).toBe(0)
    expect(r.appliedFractionRule).toBe(FractionRule.HALF_UP)
  })

  it('14.75 aanwezig → bijvullen 0', () => {
    const r = restock(15, 14.75)
    expect(r.effectiveQuantity).toBe(15)
    expect(r.restockQuantity).toBe(0)
    expect(r.appliedFractionRule).toBe(FractionRule.THREE_QUARTER_UP)
  })

  it('15 aanwezig (exact norm) → bijvullen 0', () => {
    const r = restock(15, 15)
    expect(r.effectiveQuantity).toBe(15)
    expect(r.restockQuantity).toBe(0)
    expect(r.appliedFractionRule).toBe(FractionRule.NONE)
  })
})

describe('calculateRestockQuantity — exacte 80%-grens', () => {
  // Norm 10, threshold = 80% → 8
  it('8.5 bij norm 10 → HALF_DOWN (floor 8 <= 8)', () => {
    const r = restock(10, 8.5)
    expect(r.effectiveQuantity).toBe(8)
    expect(r.restockQuantity).toBe(2)
    expect(r.appliedFractionRule).toBe(FractionRule.HALF_DOWN)
  })

  it('9.5 bij norm 10 → HALF_UP (floor 9 > 8)', () => {
    const r = restock(10, 9.5)
    expect(r.effectiveQuantity).toBe(10)
    expect(r.restockQuantity).toBe(0)
    expect(r.appliedFractionRule).toBe(FractionRule.HALF_UP)
  })
})

describe('calculateRestockQuantity — aangepaste drempel', () => {
  it('50% drempel: 7.5 bij norm 10 (floor 7 > 5) → HALF_UP', () => {
    const r = restock(10, 7.5, 50)
    expect(r.appliedFractionRule).toBe(FractionRule.HALF_UP)
    expect(r.effectiveQuantity).toBe(8)
    expect(r.restockQuantity).toBe(2)
  })

  it('50% drempel: 5.5 bij norm 10 (floor 5 <= 5) → HALF_DOWN', () => {
    const r = restock(10, 5.5, 50)
    expect(r.appliedFractionRule).toBe(FractionRule.HALF_DOWN)
    expect(r.effectiveQuantity).toBe(5)
    expect(r.restockQuantity).toBe(5)
  })
})

describe('calculateRestockQuantity — bijzondere gevallen', () => {
  it('voorraad boven de norm → bijvullen 0', () => {
    const r = restock(10, 15)
    expect(r.restockQuantity).toBe(0)
    expect(r.effectiveQuantity).toBe(15)
  })

  it('norm 0 → bijvullen altijd 0', () => {
    const r = restock(0, 0)
    expect(r.restockQuantity).toBe(0)
  })

  it('geteld 0 bij norm 15 → bijvullen 15', () => {
    const r = restock(15, 0)
    expect(r.restockQuantity).toBe(15)
    expect(r.appliedFractionRule).toBe(FractionRule.NONE)
  })

  it('grote waarden werken correct (norm 1000, geteld 750.5)', () => {
    const r = restock(1000, 750.5)
    // 80% of 1000 = 800, floor(750.5)=750 <= 800 → HALF_DOWN
    expect(r.appliedFractionRule).toBe(FractionRule.HALF_DOWN)
    expect(r.effectiveQuantity).toBe(750)
    expect(r.restockQuantity).toBe(250)
  })

  it('heel getal → NONE', () => {
    const r = restock(8, 5)
    expect(r.appliedFractionRule).toBe(FractionRule.NONE)
    expect(r.restockQuantity).toBe(3)
  })

  it('passthrough van input-waarden in resultaat', () => {
    const r = restock(15, 4.5)
    expect(r.targetQuantity).toBe(15)
    expect(r.countedQuantity).toBe(4.5)
  })
})

describe('calculateRestockQuantity — validatiefouten', () => {
  it('gooit fout bij negatief geteld aantal', () => {
    expect(() => restock(10, -1)).toThrow(RangeError)
  })

  it('gooit fout bij negatieve norm', () => {
    expect(() => restock(-5, 0)).toThrow(RangeError)
  })

  it('gooit fout bij niet-kwartwaarde geteld', () => {
    expect(() => restock(10, 1.1)).toThrow(RangeError)
    expect(() => restock(10, 0.3)).toThrow(RangeError)
  })

  it('gooit fout bij niet-kwartwaarde norm', () => {
    expect(() => restock(10.1, 5)).toThrow(RangeError)
  })

  it('gooit fout bij NaN en Infinity', () => {
    expect(() => restock(10, NaN)).toThrow()
    expect(() => restock(10, Infinity)).toThrow()
    expect(() => restock(NaN, 5)).toThrow()
  })

  it('gooit fout bij ongeldig drempelpercentage', () => {
    expect(() => restock(10, 5, -10)).toThrow(RangeError)
    expect(() => restock(10, 5, 110)).toThrow(RangeError)
    expect(() => restock(10, 5, NaN)).toThrow(RangeError)
  })
})
