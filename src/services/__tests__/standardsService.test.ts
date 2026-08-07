import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { KioskProductStandard } from '@/types'

const standards: KioskProductStandard[] = []

const productRepo = {
  getStandards: async (kioskId: string) => standards.filter((s) => s.kioskId === kioskId),
  upsertStandard: async (data: Omit<KioskProductStandard, 'id' | 'createdAt' | 'updatedAt'>) => {
    const existing = standards.find(
      (s) => s.kioskId === data.kioskId && s.productId === data.productId
    )
    const standard: KioskProductStandard = {
      ...data,
      id: existing?.id ?? `${data.kioskId}:${data.productId}`,
      createdAt: '',
      updatedAt: '',
    }
    if (existing) {
      standards[standards.indexOf(existing)] = standard
    } else {
      standards.push(standard)
    }
    return standard
  },
  bulkUpsertStandards: async (
    items: Array<Omit<KioskProductStandard, 'id' | 'createdAt' | 'updatedAt'>>
  ) => {
    for (const item of items) await productRepo.upsertStandard(item)
  },
}

vi.mock('@/repositories', () => ({
  repositories: { product: () => productRepo },
}))

const { validateStandardValue, saveStandard, copyStandards, applyStandardToKiosks } = await import(
  '../standardsService'
)

const wholeOnly = { allowPartialPackage: false }
const partialAllowed = { allowPartialPackage: true }

beforeEach(() => {
  standards.length = 0
})

describe('validateStandardValue', () => {
  it('accepteert hele verpakkingen', () => {
    expect(validateStandardValue('12', wholeOnly)).toEqual({ quarterUnits: 48 })
  })

  it('accepteert 0', () => {
    expect(validateStandardValue('0', wholeOnly)).toEqual({ quarterUnits: 0 })
  })

  it('behandelt een leeg veld als 0', () => {
    expect(validateStandardValue('', wholeOnly)).toEqual({ quarterUnits: 0 })
  })

  it('accepteert een komma als decimaalteken', () => {
    expect(validateStandardValue('4,5', partialAllowed)).toEqual({ quarterUnits: 18 })
  })

  it('weigert kwartwaarden bij producten met alleen hele verpakkingen', () => {
    const result = validateStandardValue('4,5', wholeOnly)
    expect(result.error).toMatch(/hele verpakkingen/)
  })

  it('weigert stappen die geen veelvoud van 0,25 zijn', () => {
    expect(validateStandardValue('4,3', partialAllowed).error).toMatch(/0,25/)
  })

  it('weigert negatieve waarden', () => {
    expect(validateStandardValue('-1', wholeOnly).error).toBeDefined()
  })

  it('weigert tekst', () => {
    expect(validateStandardValue('veel', wholeOnly).error).toBeDefined()
  })
})

describe('saveStandard', () => {
  it('zet een norm van 0 op inactief', async () => {
    const saved = await saveStandard({
      kioskId: 'kiosk-101',
      productId: 'water',
      targetQuantityQuarters: 0,
    })
    expect(saved.isActive).toBe(false)
  })

  it('zet een norm groter dan 0 op actief', async () => {
    const saved = await saveStandard({
      kioskId: 'kiosk-101',
      productId: 'water',
      targetQuantityQuarters: 48,
    })
    expect(saved.isActive).toBe(true)
    expect(saved.halfPackageThresholdPercentage).toBe(80)
  })
})

describe('bulkacties', () => {
  beforeEach(async () => {
    await saveStandard({ kioskId: 'kiosk-116', productId: 'water', targetQuantityQuarters: 48 })
    await saveStandard({ kioskId: 'kiosk-116', productId: 'chips', targetQuantityQuarters: 24 })
  })

  it('kopieert normen naar andere kiosken', async () => {
    const count = await copyStandards('kiosk-116', ['kiosk-117', 'kiosk-118'])

    expect(count).toBe(4)
    expect(await productRepo.getStandards('kiosk-117')).toHaveLength(2)
    expect(
      (await productRepo.getStandards('kiosk-118')).find((s) => s.productId === 'water')!
        .targetQuantityQuarters
    ).toBe(48)
  })

  it('kopieert nooit naar de bronkiosk zelf', async () => {
    const count = await copyStandards('kiosk-116', ['kiosk-116'])
    expect(count).toBe(0)
  })

  it('meldt het wanneer de bronkiosk geen normen heeft', async () => {
    await expect(copyStandards('kiosk-999', ['kiosk-117'])).rejects.toThrow('geen normen')
  })

  it('past één product bij meerdere kiosken aan', async () => {
    const count = await applyStandardToKiosks({
      kioskIds: ['kiosk-101', 'kiosk-102', 'kiosk-103'],
      productId: 'water',
      targetQuantityQuarters: 60,
    })

    expect(count).toBe(3)
    for (const kioskId of ['kiosk-101', 'kiosk-102', 'kiosk-103']) {
      const standard = (await productRepo.getStandards(kioskId)).find(
        (s) => s.productId === 'water'
      )!
      expect(standard.targetQuantityQuarters).toBe(60)
    }
  })

  it('doet niets zonder geselecteerde kiosken', async () => {
    const count = await applyStandardToKiosks({
      kioskIds: [],
      productId: 'water',
      targetQuantityQuarters: 60,
    })
    expect(count).toBe(0)
  })
})
