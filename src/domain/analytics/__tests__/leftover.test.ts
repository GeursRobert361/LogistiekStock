import { describe, it, expect } from 'vitest'
import {
  judgeLeftover,
  collectLeftoverSignals,
  MIN_LEFTOVER_QUARTERS,
  MIN_NORM_QUARTERS,
  type LeftoverInput,
} from '../leftover'

/** Norm 30 verpakkingen, geteld, actief, en er was een vorige wedstrijd. */
function invoer(overrides: Partial<LeftoverInput> = {}): LeftoverInput {
  return {
    targetQuantityQuarters: 30 * 4,
    countedQuantityQuarters: 0,
    isStandardActive: true,
    hasPreviousEvent: true,
    ...overrides,
  }
}

describe('judgeLeftover', () => {
  it('meldt een lege kiosk bij een grote norm', () => {
    expect(judgeLeftover(invoer({ countedQuantityQuarters: 0 }))).toBe('TOO_LOW')
  })

  it('telt kwarten mee: net onder de drie is nog te krap', () => {
    expect(judgeLeftover(invoer({ countedQuantityQuarters: MIN_LEFTOVER_QUARTERS - 1 }))).toBe(
      'TOO_LOW'
    )
  })

  it('vindt precies drie over goed genoeg', () => {
    expect(judgeLeftover(invoer({ countedQuantityQuarters: MIN_LEFTOVER_QUARTERS }))).toBe('OK')
  })

  it('zwijgt onder de normgrens, ook bij een lege kiosk', () => {
    expect(
      judgeLeftover(invoer({ targetQuantityQuarters: MIN_NORM_QUARTERS - 1 }))
    ).toBe('NOT_APPLICABLE')
  })

  it('geldt vanaf de normgrens zelf', () => {
    expect(judgeLeftover(invoer({ targetQuantityQuarters: MIN_NORM_QUARTERS }))).toBe('TOO_LOW')
  })

  it('zwijgt wanneer er niet geteld is', () => {
    // Een ontbrekende telling is geen nul: die kiosk is misschien overgeslagen.
    expect(judgeLeftover(invoer({ countedQuantityQuarters: null }))).toBe('NOT_APPLICABLE')
  })

  it('zwijgt over een product dat niet meer in het assortiment zit', () => {
    expect(judgeLeftover(invoer({ isStandardActive: false }))).toBe('NOT_APPLICABLE')
  })

  it('zwijgt zonder vorig evenement', () => {
    // Bij de eerste telling staat er niets omdat er nog nooit iets stond.
    expect(judgeLeftover(invoer({ hasPreviousEvent: false }))).toBe('NOT_APPLICABLE')
  })
})

describe('collectLeftoverSignals', () => {
  const bron = (kioskId: string, productId: string, norm: number, restant: number | null) => ({
    kioskId,
    productId,
    targetQuantityQuarters: norm * 4,
    countedQuantityQuarters: restant === null ? null : restant * 4,
    isStandardActive: true,
  })

  it('houdt alleen de te krappe over', () => {
    const signalen = collectLeftoverSignals(
      [
        bron('kiosk-401', 'stelz', 30, 0),
        bron('kiosk-401', 'water', 25, 12),
        bron('kiosk-403', 'koffie', 1, 0),
      ],
      { hasPreviousEvent: true }
    )

    expect(signalen.map((s) => s.productId)).toEqual(['stelz'])
  })

  it('zet het krapste bovenaan', () => {
    const signalen = collectLeftoverSignals(
      [
        bron('kiosk-401', 'water', 25, 2),
        bron('kiosk-401', 'stelz', 30, 0),
        bron('kiosk-403', 'cola', 20, 1),
      ],
      { hasPreviousEvent: true }
    )

    expect(signalen.map((s) => s.productId)).toEqual(['stelz', 'cola', 'water'])
  })

  it('geeft niets zonder vorig evenement', () => {
    const signalen = collectLeftoverSignals([bron('kiosk-401', 'stelz', 30, 0)], {
      hasPreviousEvent: false,
    })

    expect(signalen).toEqual([])
  })

  it('slaat niet-getelde regels over', () => {
    const signalen = collectLeftoverSignals([bron('kiosk-401', 'stelz', 30, null)], {
      hasPreviousEvent: true,
    })

    expect(signalen).toEqual([])
  })
})
