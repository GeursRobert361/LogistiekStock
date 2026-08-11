import { describe, it, expect } from 'vitest'
import {
  mayDiscardSession,
  assertMayDiscardSession,
  assertMayResetKiosk,
  describeDiscard,
  ResetNotAllowedError,
} from '../reset'
import { CountSessionStatus } from '@/types'

describe('mayDiscardSession', () => {
  const teWeigeren = [CountSessionStatus.APPROVED]
  const teVerwachten = [
    CountSessionStatus.NOT_STARTED,
    CountSessionStatus.IN_PROGRESS,
    CountSessionStatus.PAUSED,
    CountSessionStatus.SUBMITTED,
    CountSessionStatus.REOPENED,
  ]

  it.each(teVerwachten)('staat weggooien toe bij %s', (status) => {
    expect(mayDiscardSession({ status })).toBe(true)
  })

  it.each(teWeigeren)('weigert weggooien bij %s', (status) => {
    expect(mayDiscardSession({ status })).toBe(false)
  })
})

describe('assertMayDiscardSession', () => {
  it('wijst naar heropenen bij een goedgekeurde ronde', () => {
    expect(() => assertMayDiscardSession({ status: CountSessionStatus.APPROVED })).toThrow(
      /heropen/i
    )
  })

  it('gooit een herkenbare fout', () => {
    expect(() => assertMayDiscardSession({ status: CountSessionStatus.APPROVED })).toThrow(
      ResetNotAllowedError
    )
  })

  it('laat een lopende ronde door', () => {
    expect(() =>
      assertMayDiscardSession({ status: CountSessionStatus.IN_PROGRESS })
    ).not.toThrow()
  })
})

describe('assertMayResetKiosk', () => {
  it('weigert in een goedgekeurde ronde', () => {
    expect(() => assertMayResetKiosk({ status: CountSessionStatus.APPROVED })).toThrow(
      ResetNotAllowedError
    )
  })

  it('laat een ingediende ronde door, die is nog niet afgehandeld', () => {
    expect(() => assertMayResetKiosk({ status: CountSessionStatus.SUBMITTED })).not.toThrow()
  })
})

describe('describeDiscard', () => {
  it('telt op wat er verdwijnt', () => {
    expect(describeDiscard({ kioskCount: 3, entryCount: 58 })).toBe(
      'Hiermee verdwijnen 3 getelde kiosken en 58 telregels. Dit is niet terug te draaien.'
    )
  })

  it('gebruikt enkelvoud waar dat hoort', () => {
    expect(describeDiscard({ kioskCount: 1, entryCount: 1 })).toContain(
      '1 getelde kiosk en 1 telregel.'
    )
  })

  it('zegt het gewoon wanneer er niets in zit', () => {
    expect(describeDiscard({ kioskCount: 0, entryCount: 0 })).toBe(
      'Er is in deze ronde nog niets geteld.'
    )
  })
})
