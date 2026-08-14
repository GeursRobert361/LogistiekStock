import { describe, it, expect } from 'vitest'
import {
  buildSyncPlan,
  planKioskChanges,
  planStandardChanges,
  EXPECTED_CHIP_MATRIX,
  EXPECTED_CUP_MATRIX,
  EXPECTED_DISPOSABLE_MATRIX,
  EXPECTED_DRINK_MATRIX,
  EXPECTED_GFT,
  EXPECTED_KOFFIE,
  EXPECTED_KOOLZUUR,
  EXPECTED_LOCAL_DRINK_STOCK,
  EXPECTED_OPSCHUIMMELK,
  EXPECTED_POSTMIX_MATRIX,
  EXPECTED_STORAGE_TYPES,
  EXPECTED_VUILNISZAKKEN,
  type CurrentKiosk,
  type CurrentStandard,
} from '../syncPlan'
import { demoKiosks, demoStandards } from '../demoData'
import {
  authoritativeKioskKeys,
  CHIP_PRODUCT_IDS,
  DISPOSABLE_PRODUCT_IDS,
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

const KIOSK_402 = {
  kioskKey: 'kiosk-402',
  number: 402,
  label: undefined,
  keepsOwnDrinkStock: false,
}

/** Een kiosk zoals hij nu in de database staat. */
function huidigeKiosk(
  number: number,
  drinkStorageType: DrinkStorageType,
  overrides: Partial<CurrentKiosk> = {}
): CurrentKiosk {
  return { number, label: null, drinkStorageType, keepsOwnDrinkStock: false, ...overrides }
}

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
      [402, huidigeKiosk(402, DrinkStorageType.NONE)],
    ])
    const changes = planKioskChanges(
      [{ ...KIOSK_402, drinkStorageType: DrinkStorageType.SATELLITE }],
      current
    )
    expect(changes[0]!.details[0]).toMatch(/drankopslag NONE → SATELLITE/)
  })

  it('zwijgt wanneer alles al klopt', () => {
    const current = new Map<number, CurrentKiosk>([
      [402, huidigeKiosk(402, DrinkStorageType.SATELLITE)],
    ])
    expect(
      planKioskChanges([{ ...KIOSK_402, drinkStorageType: DrinkStorageType.SATELLITE }], current)
    ).toEqual([])
  })

  it('meldt een gewijzigd opschrift', () => {
    const current = new Map<number, CurrentKiosk>([
      [406, huidigeKiosk(406, DrinkStorageType.SATELLITE)],
    ])
    const changes = planKioskChanges(
      [
        {
          kioskKey: 'kiosk-406',
          number: 406,
          label: '406 Oud',
          drinkStorageType: DrinkStorageType.SATELLITE,
          keepsOwnDrinkStock: false,
        },
      ],
      current
    )
    expect(changes[0]!.details[0]).toMatch(/406 Oud/)
  })

  it('meldt dat een telpunt eigen drankvoorraad krijgt', () => {
    // Ziggo Platform blijft een satelliet — er staat geen koeling — maar krijgt
    // wél echte dranknormen uit een eigen stocklijst. Zonder dit vinkje worden
    // die geteld en nooit aangevuld.
    const current = new Map<number, CurrentKiosk>([
      [4300, huidigeKiosk(4300, DrinkStorageType.SATELLITE)],
    ])
    const changes = planKioskChanges(
      [
        {
          kioskKey: 'kiosk-ziggo-platform',
          number: 4300,
          label: 'Ziggo Platform',
          drinkStorageType: DrinkStorageType.SATELLITE,
          keepsOwnDrinkStock: true,
        },
      ],
      current
    )
    expect(changes[0]!.details).toContain('eigen drankvoorraad nee → ja')
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
        keepsOwnDrinkStock: k.keepsOwnDrinkStock,
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
  it('dekt elke tweede-ringlocatie, met koeling of zonder', () => {
    // Niet alleen de negen grote koelingen: ook de locaties die géén enkele
    // dranknorm horen te hebben staan erin, met tien keer `null`. Juist dat is
    // wat na een sync mis kan gaan zonder dat het opvalt.
    for (const key of authoritativeKioskKeys) {
      expect(EXPECTED_DRINK_MATRIX[key], key).toBeDefined()
    }
    expect(Object.keys(EXPECTED_DRINK_MATRIX)).toHaveLength(authoritativeKioskKeys.size)
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
        // null in de matrix betekent "geen actieve norm"; in de stamdata is dat
        // een ontbrekende regel.
        return standard ? standard.targetQuantityQuarters / 4 : null
      })
      expect(werkelijk, kioskKey).toEqual(verwacht)
    }
  })

  it('geeft Ziggo Platform tien echte dranknormen en de rest geen', () => {
    expect(EXPECTED_DRINK_MATRIX['kiosk-ziggo-platform']).toEqual([1, 2, 2, 1, 1, 2, 1, 1, 1, 2])
    expect(EXPECTED_DRINK_MATRIX['kiosk-402']?.every((n) => n === null)).toBe(true)
    expect(EXPECTED_DRINK_MATRIX['kiosk-420-bar']?.every((n) => n === null)).toBe(true)
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

  it('controleert de bekers van alle locaties met een bekerlijst', () => {
    // 422 staat er bewust niet op en wordt dus niet gecontroleerd. Ziggo
    // Platform stond er ook niet op tot zijn eigen lijst er kwam; die zet alle
    // drie de formaten op 1 doos.
    expect(Object.keys(EXPECTED_CUP_MATRIX)).toHaveLength(22)
    expect(EXPECTED_CUP_MATRIX['kiosk-422']).toBeUndefined()
    expect(EXPECTED_CUP_MATRIX['kiosk-ziggo-platform']).toEqual([1, 1, 1])
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

  it('controleert alle locaties met een chipsnorm', () => {
    // 422 staat niet op de chipslijst; de rest wel, inclusief 403 sinds
    // bevestigd is dat het tweede "402"-blok van die kiosk was. Ziggo Platform
    // komt hier via zijn eigen lijst binnen, met dezelfde 2/2/2 als op papier.
    expect(Object.keys(EXPECTED_CHIP_MATRIX)).toHaveLength(22)
    expect(EXPECTED_CHIP_MATRIX['kiosk-403']).toEqual([8, 8, 6])
    expect(EXPECTED_CHIP_MATRIX['kiosk-422']).toBeUndefined()
    expect(EXPECTED_CHIP_MATRIX['kiosk-ziggo-platform']).toEqual([2, 2, 2])
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

  it('komt overeen met de disposables in de stamdata', () => {
    for (const [kioskKey, verwacht] of Object.entries(EXPECTED_DISPOSABLE_MATRIX)) {
      const werkelijk = DISPOSABLE_PRODUCT_IDS.map((productId) => {
        const standard = demoStandards.find(
          (s) => s.kioskId === kioskKey && s.productId === productId
        )
        return standard ? standard.targetQuantityQuarters / 4 : null
      })
      expect(werkelijk, kioskKey).toEqual(verwacht)
    }
  })

  it('controleert de tweeëntwintig locaties van de Disposable-lijst', () => {
    // 422 staat er niet op en wordt dus niet gecontroleerd.
    expect(Object.keys(EXPECTED_DISPOSABLE_MATRIX)).toHaveLength(22)
    expect(EXPECTED_DISPOSABLE_MATRIX['kiosk-422']).toBeUndefined()
  })

  it('komt overeen met de GFT-bakken in de stamdata', () => {
    for (const [kioskKey, verwacht] of Object.entries(EXPECTED_GFT)) {
      const standard = demoStandards.find(
        (s) => s.kioskId === kioskKey && s.productId === 'gft-bak'
      )
      expect(standard ? standard.targetQuantityQuarters / 4 : null, kioskKey).toBe(verwacht[0])
    }
  })

  it('controleert elke tweede-ringlocatie op GFT, ook waar er geen staat', () => {
    for (const key of authoritativeKioskKeys) {
      expect(EXPECTED_GFT[key], key).toBeDefined()
    }
  })

  it('komt overeen met de vuilniszakken in de stamdata', () => {
    for (const [kioskKey, verwacht] of Object.entries(EXPECTED_VUILNISZAKKEN)) {
      const standard = demoStandards.find(
        (s) => s.kioskId === kioskKey && s.productId === 'vuilniszakken'
      )
      expect(standard ? standard.targetQuantityQuarters / 4 : null, kioskKey).toBe(verwacht[0])
    }
  })

  it('komt overeen met de opschuimmelk in de stamdata', () => {
    for (const [kioskKey, verwacht] of Object.entries(EXPECTED_OPSCHUIMMELK)) {
      const standard = demoStandards.find(
        (s) => s.kioskId === kioskKey && s.productId === 'opschuimmelk'
      )
      expect(standard ? standard.targetQuantityQuarters / 4 : null, kioskKey).toBe(verwacht[0])
    }
  })

  it('komt overeen met de koffie in de stamdata', () => {
    for (const [kioskKey, verwacht] of Object.entries(EXPECTED_KOFFIE)) {
      const standard = demoStandards.find(
        (s) => s.kioskId === kioskKey && s.productId === 'koffie'
      )
      expect(standard ? standard.targetQuantityQuarters / 4 : null, kioskKey).toBe(verwacht[0])
    }
  })

  it('controleert elke tweede-ringlocatie op koffie en opschuimmelk', () => {
    // Allebei zijn het wijzigingen die normen wegnemen of verlagen; dan wil je
    // niet dat er één locatie buiten de controle valt.
    for (const key of authoritativeKioskKeys) {
      expect(EXPECTED_KOFFIE[key], key).toBeDefined()
      expect(EXPECTED_OPSCHUIMMELK[key], key).toBeDefined()
      expect(EXPECTED_VUILNISZAKKEN[key], key).toBeDefined()
    }
  })

  it('komt overeen met de eigen drankvoorraad in de stamdata', () => {
    for (const [kioskKey, verwacht] of Object.entries(EXPECTED_LOCAL_DRINK_STOCK)) {
      const kiosk = demoKiosks.find((k) => k.id === kioskKey)
      expect(kiosk?.keepsOwnDrinkStock, kioskKey).toBe(verwacht)
    }
  })

  it('noemt precies één locatie met eigen drankvoorraad', () => {
    // Dit vinkje zet de satellietbescherming uit; het hoort nergens per ongeluk
    // aan te staan.
    const met = Object.entries(EXPECTED_LOCAL_DRINK_STOCK)
      .filter(([, waarde]) => waarde)
      .map(([key]) => key)

    expect(met).toEqual(['kiosk-ziggo-platform'])
    for (const key of authoritativeKioskKeys) {
      expect(EXPECTED_LOCAL_DRINK_STOCK[key], key).toBeDefined()
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
