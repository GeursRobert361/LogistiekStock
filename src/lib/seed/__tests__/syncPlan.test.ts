import { describe, it, expect } from 'vitest'
import {
  buildSyncPlan,
  planKioskChanges,
  planStandardChanges,
  EXPECTED_CHIP_MATRIX,
  EXPECTED_CUP_MATRIX,
  EXPECTED_DRINK_MATRIX,
  EXPECTED_KOOLZUUR,
  EXPECTED_POSTMIX_MATRIX,
  EXPECTED_STORAGE_TYPES,
  type CurrentKiosk,
  type CurrentStandard,
} from '../syncPlan'
import { demoKiosks, demoStandards } from '../demoData'
import {
  authoritativeKioskKeys,
  CHIP_PRODUCT_IDS,
  POSTMIX_PACKAGE_PRODUCT_IDS,
} from '../secondRingStandards'
import { DrinkStorageType } from '@/types'

/**
 * Het plan dat de productiesync uitvoert.
 *
 * Puur berekend, dus hier te testen zonder database. Dat is precies de reden
 * dat die berekening apart staat: een proefdraai en een echte uitvoering horen
 * hetzelfde plan te gebruiken, anders liegt de proefdraai over wat er gebeurt.
 */

const KIOSK_402 = { kioskKey: 'kiosk-402', number: 402, label: undefined }

describe('planKioskChanges', () => {
  it('meldt een kiosk die nog niet bestaat', () => {
    const changes = planKioskChanges(
      [{ ...KIOSK_402, drinkStorageType: DrinkStorageType.SATELLITE }],
      new Map()
    )
    expect(changes).toHaveLength(1)
    expect(changes[0]!.kind).toBe('nieuw')
  })

  it('meldt een gewijzigd opslagtype', () => {
    const current = new Map<number, CurrentKiosk>([
      [402, { number: 402, label: null, drinkStorageType: DrinkStorageType.NONE }],
    ])
    const changes = planKioskChanges(
      [{ ...KIOSK_402, drinkStorageType: DrinkStorageType.SATELLITE }],
      current
    )
    expect(changes[0]!.details[0]).toMatch(/drankopslag NONE → SATELLITE/)
  })

  it('zwijgt wanneer alles al klopt', () => {
    const current = new Map<number, CurrentKiosk>([
      [402, { number: 402, label: null, drinkStorageType: DrinkStorageType.SATELLITE }],
    ])
    expect(
      planKioskChanges([{ ...KIOSK_402, drinkStorageType: DrinkStorageType.SATELLITE }], current)
    ).toEqual([])
  })

  it('meldt een gewijzigd opschrift', () => {
    const current = new Map<number, CurrentKiosk>([
      [406, { number: 406, label: null, drinkStorageType: DrinkStorageType.SATELLITE }],
    ])
    const changes = planKioskChanges(
      [
        {
          kioskKey: 'kiosk-406',
          number: 406,
          label: '406 Oud',
          drinkStorageType: DrinkStorageType.SATELLITE,
        },
      ],
      current
    )
    expect(changes[0]!.details[0]).toMatch(/406 Oud/)
  })
})

describe('planStandardChanges', () => {
  const gewenst = [
    { kioskKey: 'kiosk-401', productId: 'fuze-tea', targetQuantityQuarters: 100 },
  ]

  it('meldt een nieuwe norm', () => {
    expect(planStandardChanges(gewenst, [])).toEqual([
      { kioskKey: 'kiosk-401', productId: 'fuze-tea', kind: 'nieuw', to: 100 },
    ])
  })

  it('meldt een gewijzigde norm', () => {
    const huidig: CurrentStandard[] = [
      { kioskKey: 'kiosk-401', productId: 'fuze-tea', targetQuantityQuarters: 60, isActive: true },
    ]
    expect(planStandardChanges(gewenst, huidig)[0]).toMatchObject({
      kind: 'gewijzigd',
      from: 60,
      to: 100,
    })
  })

  it('zwijgt wanneer de norm al klopt', () => {
    const huidig: CurrentStandard[] = [
      { kioskKey: 'kiosk-401', productId: 'fuze-tea', targetQuantityQuarters: 100, isActive: true },
    ]
    expect(planStandardChanges(gewenst, huidig)).toEqual([])
  })

  it('zet een norm die niet meer hoort op uitgeschakeld', () => {
    const huidig: CurrentStandard[] = [
      { kioskKey: 'kiosk-401', productId: 'fuze-tea', targetQuantityQuarters: 100, isActive: true },
      { kioskKey: 'kiosk-401', productId: 'witte-wijn', targetQuantityQuarters: 12, isActive: true },
    ]
    const changes = planStandardChanges(gewenst, huidig)
    expect(changes).toEqual([
      { kioskKey: 'kiosk-401', productId: 'witte-wijn', kind: 'uitgeschakeld', from: 12 },
    ])
  })

  it('activeert een norm die uit stond weer', () => {
    const huidig: CurrentStandard[] = [
      { kioskKey: 'kiosk-401', productId: 'fuze-tea', targetQuantityQuarters: 100, isActive: false },
    ]
    expect(planStandardChanges(gewenst, huidig)[0]!.kind).toBe('nieuw')
  })
})

describe('scope van de sync', () => {
  it('raakt geen enkele kiosk buiten de authoritative locaties', () => {
    // De eerste ring hoort er niet in te zitten, ook niet als er iets afwijkt.
    const gewenstKiosken = demoKiosks
      .filter((k) => authoritativeKioskKeys.has(k.id))
      .map((k) => ({
        kioskKey: k.id,
        number: k.number,
        label: k.label,
        drinkStorageType: k.drinkStorageType,
      }))

    expect(gewenstKiosken.some((k) => k.kioskKey === 'kiosk-110')).toBe(false)
    expect(gewenstKiosken.some((k) => k.number === 110)).toBe(false)

    const plan = buildSyncPlan({
      desiredKiosks: gewenstKiosken,
      currentKiosks: new Map(),
      desiredStandards: demoStandards
        .filter((s) => authoritativeKioskKeys.has(s.kioskId))
        .map((s) => ({
          kioskKey: s.kioskId,
          productId: s.productId,
          targetQuantityQuarters: s.targetQuantityQuarters,
        })),
      currentStandards: [],
    })

    expect(plan.kiosks.every((k) => authoritativeKioskKeys.has(k.kioskKey))).toBe(true)
    expect(plan.standards.every((s) => authoritativeKioskKeys.has(s.kioskKey))).toBe(true)
  })

  it('laat een norm van de eerste ring ongemoeid, ook als hij actief is', () => {
    // Zo'n norm hoort niet in currentStandards te belanden; komt hij er toch
    // in, dan zou hij ten onrechte uitgeschakeld worden.
    const huidig: CurrentStandard[] = [
      { kioskKey: 'kiosk-110', productId: 'fuze-tea', targetQuantityQuarters: 40, isActive: true },
    ]
    const changes = planStandardChanges([], huidig)

    // De planner kent geen scope; die wordt bij het inlezen begrensd. Deze test
    // legt vast dat een regel buiten scope wél zou worden uitgeschakeld, en
    // dus dat het inlezen de begrenzing moet doen.
    expect(changes[0]!.kind).toBe('uitgeschakeld')
  })

  it('sluit een plan zonder wijzigingen kort', () => {
    const plan = buildSyncPlan({
      desiredKiosks: [],
      currentKiosks: new Map(),
      desiredStandards: [],
      currentStandards: [],
    })
    expect(plan.isEmpty).toBe(true)
  })
})

describe('verwachtingen voor de verificatie na afloop', () => {
  it('dekt alle negen grote koelingen', () => {
    expect(Object.keys(EXPECTED_DRINK_MATRIX)).toHaveLength(9)
  })

  it('komt overeen met de stamdata', () => {
    const VOLGORDE = [
      'chaudfontaine-blauw',
      'chaudfontaine-rood',
      'fuze-tea',
      'heineken-00',
      'radler',
      'stelz-icetea',
      'bacardi-lemon',
      'jack-daniels',
      'redbull',
      'bacardi-cola',
    ]

    for (const [kioskKey, verwacht] of Object.entries(EXPECTED_DRINK_MATRIX)) {
      const werkelijk = VOLGORDE.map((productId) => {
        const standard = demoStandards.find(
          (s) => s.kioskId === kioskKey && s.productId === productId
        )
        return standard ? standard.targetQuantityQuarters / 4 : undefined
      })
      expect(werkelijk, kioskKey).toEqual(verwacht)
    }
  })

  it('komt overeen met de bekers in de stamdata', () => {
    const VOLGORDE = ['bierbeker-05', 'bierbeker-04', 'bierbeker-03']

    for (const [kioskKey, verwacht] of Object.entries(EXPECTED_CUP_MATRIX)) {
      const werkelijk = VOLGORDE.map((productId) => {
        const standard = demoStandards.find(
          (s) => s.kioskId === kioskKey && s.productId === productId
        )
        // null in de matrix betekent "geen actieve norm"; in de stamdata is dat
        // een ontbrekende regel.
        return standard ? standard.targetQuantityQuarters / 4 : null
      })
      expect(werkelijk, kioskKey).toEqual(verwacht)
    }
  })

  it('controleert de bekers van alle locaties op de handmatige lijst', () => {
    // 422 en Ziggo Platform staan er bewust niet op en worden dus niet
    // gecontroleerd; de andere eenentwintig wel.
    expect(Object.keys(EXPECTED_CUP_MATRIX)).toHaveLength(21)
    expect(EXPECTED_CUP_MATRIX['kiosk-422']).toBeUndefined()
    expect(EXPECTED_CUP_MATRIX['kiosk-ziggo-platform']).toBeUndefined()
  })

  it('komt overeen met de chips in de stamdata', () => {
    for (const [kioskKey, verwacht] of Object.entries(EXPECTED_CHIP_MATRIX)) {
      const werkelijk = CHIP_PRODUCT_IDS.map((productId) => {
        const standard = demoStandards.find(
          (s) => s.kioskId === kioskKey && s.productId === productId
        )
        return standard ? standard.targetQuantityQuarters / 4 : undefined
      })
      expect(werkelijk, kioskKey).toEqual(verwacht)
    }
  })

  it('controleert alle eenentwintig chipslocaties', () => {
    // 422 en Ziggo Platform staan niet op de chipslijst; de rest wel, inclusief
    // 403 sinds bevestigd is dat het tweede "402"-blok van die kiosk was.
    expect(Object.keys(EXPECTED_CHIP_MATRIX)).toHaveLength(21)
    expect(EXPECTED_CHIP_MATRIX['kiosk-403']).toEqual([8, 8, 6])
    expect(EXPECTED_CHIP_MATRIX['kiosk-422']).toBeUndefined()
    expect(EXPECTED_CHIP_MATRIX['kiosk-ziggo-platform']).toBeUndefined()
  })

  it('komt overeen met de Post-mix in de stamdata', () => {
    for (const [kioskKey, verwacht] of Object.entries(EXPECTED_POSTMIX_MATRIX)) {
      const werkelijk = POSTMIX_PACKAGE_PRODUCT_IDS.map((productId) => {
        const standard = demoStandards.find(
          (s) => s.kioskId === kioskKey && s.productId === productId
        )
        // null in de matrix betekent "geen actieve norm"; in de stamdata is dat
        // een ontbrekende regel.
        return standard ? standard.targetQuantityQuarters / 4 : null
      })
      expect(werkelijk, kioskKey).toEqual(verwacht)
    }
  })

  it('komt overeen met het koolzuur in de stamdata', () => {
    for (const [kioskKey, verwacht] of Object.entries(EXPECTED_KOOLZUUR)) {
      const standard = demoStandards.find(
        (s) => s.kioskId === kioskKey && s.productId === 'koolzuur'
      )
      expect(standard?.targetQuantityQuarters, kioskKey).toBe(verwacht * 4)
    }
  })

  it('komt overeen met de opslagtypes in de stamdata', () => {
    for (const [kioskKey, verwacht] of Object.entries(EXPECTED_STORAGE_TYPES)) {
      const kiosk = demoKiosks.find((k) => k.id === kioskKey)
      expect(kiosk?.drinkStorageType, kioskKey).toBe(verwacht)
    }
  })

  it('dekt elke authoritative locatie', () => {
    for (const key of authoritativeKioskKeys) {
      expect(EXPECTED_STORAGE_TYPES[key], key).toBeDefined()
    }
  })
})
