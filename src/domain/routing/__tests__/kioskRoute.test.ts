import { describe, it, expect } from 'vitest'
import {
  generateCircularKioskRoute,
  getNextKioskInRoute,
  getPreviousKioskInRoute,
} from '../kioskRoute'
import { RouteDirection } from '@/types/enums'

// Build demo kiosks for ring 1 (101-128)
function buildKiosks(
  numbers: number[],
  overrides: Partial<Record<number, { isActive?: boolean; isOpenForEvent?: boolean }>> = {}
) {
  return numbers.map((n, i) => ({
    id: `kiosk-${n}`,
    sortOrder: i + 1, // 1-based sortOrder matching ring sequence
    isActive: overrides[n]?.isActive ?? true,
    isOpenForEvent: overrides[n]?.isOpenForEvent ?? true,
  }))
}

const ring1Numbers = Array.from({ length: 28 }, (_, i) => 101 + i) // 101..128
const ring1 = buildKiosks(ring1Numbers)

function kioskId(n: number) {
  return `kiosk-${n}`
}
function routeNumbers(kiosks: { id: string }[]) {
  return kiosks.map((k) => parseInt(k.id.replace('kiosk-', ''), 10))
}

describe('generateCircularKioskRoute — ascending', () => {
  it('starts from kiosk 123 and wraps to 101', () => {
    const route = generateCircularKioskRoute({
      kiosks: ring1,
      startKioskId: kioskId(123),
      direction: RouteDirection.ASCENDING,
    })
    const nums = routeNumbers(route)
    expect(nums[0]).toBe(123)
    expect(nums[1]).toBe(124)
    expect(nums[5]).toBe(128)
    expect(nums[6]).toBe(101)
    expect(nums[nums.length - 1]).toBe(122)
    expect(nums.length).toBe(28)
  })

  it('starts from first kiosk (101) — no wrap needed', () => {
    const route = generateCircularKioskRoute({
      kiosks: ring1,
      startKioskId: kioskId(101),
      direction: RouteDirection.ASCENDING,
    })
    const nums = routeNumbers(route)
    expect(nums[0]).toBe(101)
    expect(nums[nums.length - 1]).toBe(128)
  })

  it('starts from last kiosk (128)', () => {
    const route = generateCircularKioskRoute({
      kiosks: ring1,
      startKioskId: kioskId(128),
      direction: RouteDirection.ASCENDING,
    })
    const nums = routeNumbers(route)
    expect(nums[0]).toBe(128)
    expect(nums[1]).toBe(101)
    expect(nums[nums.length - 1]).toBe(127)
  })

  it('contains all 28 kiosks', () => {
    const route = generateCircularKioskRoute({
      kiosks: ring1,
      startKioskId: kioskId(115),
      direction: RouteDirection.ASCENDING,
    })
    expect(route.length).toBe(28)
    // Each kiosk appears exactly once
    const ids = new Set(route.map((k) => k.id))
    expect(ids.size).toBe(28)
  })
})

describe('generateCircularKioskRoute — descending', () => {
  it('starts from kiosk 123 and wraps: 123→122→...→101→128→127...', () => {
    const route = generateCircularKioskRoute({
      kiosks: ring1,
      startKioskId: kioskId(123),
      direction: RouteDirection.DESCENDING,
    })
    const nums = routeNumbers(route)
    expect(nums[0]).toBe(123)
    expect(nums[1]).toBe(122)
    expect(nums[22]).toBe(101)
    expect(nums[23]).toBe(128)
    expect(nums[24]).toBe(127)
    expect(nums[nums.length - 1]).toBe(124)
    expect(nums.length).toBe(28)
  })

  it('starts from first kiosk (101) descending: 101→128→127→...', () => {
    const route = generateCircularKioskRoute({
      kiosks: ring1,
      startKioskId: kioskId(101),
      direction: RouteDirection.DESCENDING,
    })
    const nums = routeNumbers(route)
    expect(nums[0]).toBe(101)
    expect(nums[1]).toBe(128)
    expect(nums[nums.length - 1]).toBe(102)
  })

  it('starts from last kiosk (128) descending: 128→127→...→101', () => {
    const route = generateCircularKioskRoute({
      kiosks: ring1,
      startKioskId: kioskId(128),
      direction: RouteDirection.DESCENDING,
    })
    const nums = routeNumbers(route)
    expect(nums[0]).toBe(128)
    expect(nums[1]).toBe(127)
    expect(nums[nums.length - 1]).toBe(101)
  })

  it('contains all 28 kiosks', () => {
    const route = generateCircularKioskRoute({
      kiosks: ring1,
      startKioskId: kioskId(115),
      direction: RouteDirection.DESCENDING,
    })
    expect(route.length).toBe(28)
    const ids = new Set(route.map((k) => k.id))
    expect(ids.size).toBe(28)
  })
})

describe('generateCircularKioskRoute — overslaan inactieve kiosken', () => {
  it('slaat inactieve kiosk over', () => {
    const kiosks = buildKiosks(ring1Numbers, {
      115: { isActive: false },
    })
    const route = generateCircularKioskRoute({
      kiosks,
      startKioskId: kioskId(110),
      direction: RouteDirection.ASCENDING,
    })
    expect(route.length).toBe(27)
    expect(route.find((k) => k.id === kioskId(115))).toBeUndefined()
  })

  it('slaat meerdere inactieve kiosken over', () => {
    const kiosks = buildKiosks(ring1Numbers, {
      110: { isActive: false },
      111: { isActive: false },
      112: { isActive: false },
    })
    const route = generateCircularKioskRoute({
      kiosks,
      startKioskId: kioskId(105),
      direction: RouteDirection.ASCENDING,
    })
    expect(route.length).toBe(25)
  })

  it('slaat gesloten (isOpenForEvent=false) kiosk over', () => {
    const kiosks = buildKiosks(ring1Numbers, {
      120: { isOpenForEvent: false },
    })
    const route = generateCircularKioskRoute({
      kiosks,
      startKioskId: kioskId(115),
      direction: RouteDirection.ASCENDING,
    })
    expect(route.length).toBe(27)
    expect(route.find((k) => k.id === kioskId(120))).toBeUndefined()
  })

  it('geeft lege array terug als alle kiosken inactief zijn', () => {
    const kiosks = buildKiosks(ring1Numbers, {}).map((k) => ({ ...k, isActive: false }))
    const route = generateCircularKioskRoute({
      kiosks,
      startKioskId: kioskId(101),
      direction: RouteDirection.ASCENDING,
    })
    expect(route).toEqual([])
  })
})

describe('generateCircularKioskRoute — start kiosk niet gevonden', () => {
  it('start van index 0 als startkiosk inactief is', () => {
    const kiosks = buildKiosks(ring1Numbers, {
      123: { isActive: false },
    })
    const route = generateCircularKioskRoute({
      kiosks,
      startKioskId: kioskId(123),
      direction: RouteDirection.ASCENDING,
    })
    // Falls back to first eligible kiosk
    expect(routeNumbers(route)[0]).toBe(101)
    expect(route.length).toBe(27)
  })

  it('start van index 0 als startkiosk niet bestaat', () => {
    const route = generateCircularKioskRoute({
      kiosks: ring1,
      startKioskId: 'onbekend-kiosk',
      direction: RouteDirection.ASCENDING,
    })
    expect(routeNumbers(route)[0]).toBe(101)
  })
})

describe('generateCircularKioskRoute — één kiosk', () => {
  it('route met één kiosk geeft die kiosk terug', () => {
    const kiosks = buildKiosks([101])
    const route = generateCircularKioskRoute({
      kiosks,
      startKioskId: kioskId(101),
      direction: RouteDirection.ASCENDING,
    })
    expect(route.length).toBe(1)
    expect(route[0]?.id).toBe(kioskId(101))
  })
})

describe('getNextKioskInRoute', () => {
  const route = generateCircularKioskRoute({
    kiosks: ring1,
    startKioskId: kioskId(101),
    direction: RouteDirection.ASCENDING,
  })

  it('geeft volgende kiosk in route', () => {
    const next = getNextKioskInRoute(route, kioskId(101))
    expect(next?.id).toBe(kioskId(102))
  })

  it('geeft undefined voor laatste kiosk', () => {
    const next = getNextKioskInRoute(route, kioskId(128))
    expect(next).toBeUndefined()
  })

  it('geeft undefined voor onbekend kiosk-id', () => {
    const next = getNextKioskInRoute(route, 'onbekend')
    expect(next).toBeUndefined()
  })
})

describe('getPreviousKioskInRoute', () => {
  const route = generateCircularKioskRoute({
    kiosks: ring1,
    startKioskId: kioskId(101),
    direction: RouteDirection.ASCENDING,
  })

  it('geeft vorige kiosk in route', () => {
    const prev = getPreviousKioskInRoute(route, kioskId(103))
    expect(prev?.id).toBe(kioskId(102))
  })

  it('geeft undefined voor eerste kiosk', () => {
    const prev = getPreviousKioskInRoute(route, kioskId(101))
    expect(prev).toBeUndefined()
  })
})
