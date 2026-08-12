import { describe, it, expect } from 'vitest'
import {
  applyStandardOverrides,
  secondRingStandards,
  unconfirmedStandards,
  paperDrinksFor,
  latestOverridesFor,
  PAPER_DRINK_PRODUCT_IDS,
  CUP_PRODUCT_IDS,
} from '../secondRingStandards'
import { storageNotes } from '@/lib/storageNotes'
import { demoKiosks, demoStandards } from '../demoData'

/**
 * De bronprioriteit van voorraadnormen.
 *
 * Er zijn drie bronnen: de papieren bestellijst per kiosk, de nieuwste
 * handmatige drankstocklijst en de nieuwste handmatige bekerlijst. De
 * handmatige lijsten winnen, maar alleen voor de combinaties kiosk + product
 * die er met name in staan. Wat er niet in staat valt terug op de papieren norm
 * van diezelfde kiosk — nooit op die van een andere.
 *
 * Deze tests bestaan omdat het één keer misging: elf normen waren ingevuld met
 * het getal van een vergelijkbare grote koeling. Zulke getallen zien er
 * plausibel uit en vallen daardoor niet op.
 */

const PRODUCT_VOLGORDE = [
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

const GROTE_KOELINGEN = [
  'kiosk-401',
  'kiosk-403',
  'kiosk-407',
  'kiosk-410',
  'kiosk-416',
  'kiosk-419',
  'kiosk-420',
  'kiosk-423',
  'kiosk-426',
]

/** De norm zoals hij in de stamdata terechtkomt, in hele verpakkingen. */
function norm(kioskKey: string, productId: string): number | undefined {
  const standard = demoStandards.find((s) => s.kioskId === kioskKey && s.productId === productId)
  return standard ? standard.targetQuantityQuarters / 4 : undefined
}

function drinksOf(kioskKey: string): Array<number | undefined> {
  return PRODUCT_VOLGORDE.map((productId) => norm(kioskKey, productId))
}

function cupsOf(kioskKey: string): Array<number | undefined> {
  return CUP_PRODUCT_IDS.map((productId) => norm(kioskKey, productId))
}

describe('applyStandardOverrides', () => {
  it('laat de override winnen', () => {
    expect(applyStandardOverrides({ water: 15 }, { water: 25 })).toEqual({ water: 25 })
  })

  it('houdt wat de override niet noemt', () => {
    const result = applyStandardOverrides({ water: 15, redbull: 6 }, { water: 25 })
    expect(result).toEqual({ water: 25, redbull: 6 })
  })

  it('wist niets wanneer er geen override is', () => {
    expect(applyStandardOverrides({ water: 15, redbull: 6 })).toEqual({ water: 15, redbull: 6 })
  })

  it('laat de basis onaangeroerd', () => {
    const basis = { water: 15 }
    applyStandardOverrides(basis, { water: 25 })
    expect(basis).toEqual({ water: 15 })
  })

  it('haalt bij nul de norm weg in plaats van hem op nul te zetten', () => {
    // Norm nul zou het product bij het tellen laten staan met een streefwaarde
    // van niets, en dus altijd "compleet" heten.
    const result = applyStandardOverrides({ 'bierbeker-05': 3, 'bierbeker-04': 3 }, { 'bierbeker-05': 0 })
    expect(result).toEqual({ 'bierbeker-04': 3 })
    expect('bierbeker-05' in result).toBe(false)
  })

  it('doet niets bij een nul voor een product dat er toch al niet stond', () => {
    expect(applyStandardOverrides({ 'bierbeker-04': 3 }, { 'bierbeker-03': 0 })).toEqual({
      'bierbeker-04': 3,
    })
  })
})

describe('bronprioriteit', () => {
  it('gebruikt de handmatige waarde waar die bestaat', () => {
    // 423 Radler staat op de nieuwe stocklijst met 8; papier zei 5.
    expect(paperDrinksFor('kiosk-423').radler).toBe(5)
    expect(norm('kiosk-423', 'radler')).toBe(8)
  })

  it('laat de papieren bron staan onder een handmatige waarde', () => {
    // Het papier blijft de basis voor als een handmatige waarde ooit vervalt;
    // dat is de reden dat PAPER_DRINKS compleet is en niet alleen de gaten.
    expect(paperDrinksFor('kiosk-419')['jack-daniels']).toBe(5)
    expect(norm('kiosk-419', 'jack-daniels')).toBe(6)
  })

  it('haalt elk drankgetal uit de eigen kiosk', () => {
    // Geen buurman, geen gemiddelde: elk getal komt van de eigen handmatige
    // lijst of anders van het eigen papier.
    for (const kioskKey of GROTE_KOELINGEN) {
      const papier = paperDrinksFor(kioskKey)
      const handmatig = latestOverridesFor(kioskKey)

      for (const productId of PRODUCT_VOLGORDE) {
        expect(norm(kioskKey, productId), `${kioskKey} ${productId}`).toBe(
          handmatig[productId] ?? papier[productId]
        )
      }
    }
  })

  it('laat een override de rest van de lijst met rust', () => {
    // De bekerlijst noemt voor 412 alleen de drie bekerformaten. De chips, de
    // koffiehoek en de sauzen van diezelfde kiosk komen van papier.
    expect(norm('kiosk-412', 'chips-blauw')).toBe(2)
    expect(norm('kiosk-412', 'ketchup-flessen')).toBe(15)
    expect(norm('kiosk-412', 'koffiebekers')).toBe(8)
    expect(norm('kiosk-412', 'square-bakjes')).toBe(3)
  })

  it('raakt producten buiten de twee handmatige lijsten niet aan', () => {
    // 419 staat op beide lijsten, maar alleen voor drank en bekers.
    expect(norm('kiosk-419', 'chips-blauw')).toBe(6)
    expect(norm('kiosk-419', 'patat-bakjes')).toBe(3)
    expect(norm('kiosk-419', 'mayo-emmers')).toBe(5)
  })
})

describe('definitieve drankmatrix', () => {
  const MATRIX: Record<string, number[]> = {
    'kiosk-401': [25, 6, 25, 12, 8, 30, 10, 6, 8, 30],
    'kiosk-403': [25, 6, 15, 10, 8, 20, 10, 6, 8, 25],
    'kiosk-407': [20, 6, 21, 7, 7, 29, 10, 8, 8, 15],
    'kiosk-410': [25, 8, 21, 10, 7, 25, 10, 8, 9, 30],
    'kiosk-416': [25, 6, 20, 10, 10, 24, 10, 6, 10, 30],
    'kiosk-419': [20, 6, 20, 10, 7, 15, 10, 6, 10, 30],
    'kiosk-420': [25, 8, 25, 15, 10, 25, 12, 8, 10, 20],
    'kiosk-423': [20, 6, 20, 15, 8, 15, 9, 6, 9, 25],
    'kiosk-426': [25, 6, 28, 15, 10, 15, 10, 8, 8, 30],
  }

  it.each(Object.entries(MATRIX))('%s', (kioskKey, verwacht) => {
    expect(drinksOf(kioskKey)).toEqual(verwacht)
  })
})

describe('definitieve bekermatrix', () => {
  // Volgorde: 0,5 / 0,4 / 0,3. `undefined` betekent geen actieve norm, omdat de
  // bekerlijst daar een expliciete 0 heeft staan.
  const MATRIX: Record<string, Array<number | undefined>> = {
    'kiosk-401': [5, 4, 2],
    'kiosk-402': [1, 1, 1],
    'kiosk-403': [3, 3, 1],
    'kiosk-404': [2, 2, 1],
    'kiosk-406': [1, 2, 1],
    'kiosk-406-nieuw': [2, 2, 1],
    'kiosk-407': [4, 3, 2],
    'kiosk-409': [1, 1, 1],
    'kiosk-410': [4, 4, 2],
    'kiosk-412': [3, 3, undefined],
    'kiosk-414': [3, 3, undefined],
    'kiosk-416': [4, 4, 2],
    'kiosk-417': [2, 2, 1],
    'kiosk-419': [3, 3, 1],
    'kiosk-420': [undefined, 3, 1],
    'kiosk-420-bar': [4, 4, 2],
    'kiosk-423': [4, 4, 1],
    'kiosk-424': [2, 1, 1],
    'kiosk-426': [5, 4, 2],
    'kiosk-427': [3, 3, undefined],
    'kiosk-429': [3, 3, undefined],
  }

  it.each(Object.entries(MATRIX))('%s', (kioskKey, verwacht) => {
    expect(cupsOf(kioskKey)).toEqual(verwacht)
  })

  it('laat een expliciete nul geen norm van nul worden', () => {
    // Niet "0 stuks", maar helemaal geen regel: anders blijft het formaat bij
    // het tellen staan.
    const nul = demoStandards.filter(
      (s) => s.productId === 'bierbeker-03' && ['kiosk-412', 'kiosk-427'].includes(s.kioskId)
    )
    expect(nul).toEqual([])
    expect(demoStandards.some((s) => s.kioskId === 'kiosk-420' && s.productId === 'bierbeker-05')).toBe(
      false
    )
  })

  it('telt de opslagnotities niet bij de norm op', () => {
    // "2 doos achter in kiosk" zegt waar de bekers liggen, niet dat er twee bij
    // moeten. 401 blijft dus 5 en wordt geen 7.
    expect(storageNotes.map((n) => n.kioskNumber)).toEqual([401, 410, 426])
    expect(norm('kiosk-401', 'bierbeker-05')).toBe(5)
    expect(norm('kiosk-410', 'bierbeker-05')).toBe(4)
    expect(norm('kiosk-426', 'bierbeker-05')).toBe(5)
  })

  it('laat 422 en Ziggo Platform zoals ze waren', () => {
    // Die staan niet op de nieuwe bekerlijst; er valt dus niets over te zeggen
    // en dan verzinnen we ook niets.
    expect(cupsOf('kiosk-422')).toEqual([undefined, undefined, undefined])
    expect(cupsOf('kiosk-ziggo-platform')).toEqual([1, 1, undefined])
  })
})

describe('non-drank blijft van papier', () => {
  it('houdt de papieren normen van een satelliet', () => {
    expect(norm('kiosk-402', 'chips-blauw')).toBe(2)
    expect(norm('kiosk-402', 'tork-rol')).toBe(6)
  })

  it('houdt de papieren normen van een grote koeling', () => {
    expect(norm('kiosk-419', 'square-bakjes')).toBe(2)
    expect(norm('kiosk-406', 'tork-rol')).toBe(6)
  })
})

describe('twijfelwaarden', () => {
  it('houdt alleen de zes waarden die op de nieuwste lijst een vraagteken hadden', () => {
    expect(unconfirmedStandards).toHaveLength(6)

    const gecombineerd = unconfirmedStandards.map((a) => `${a.kioskKey} ${a.productId}`)
    expect(gecombineerd).toEqual([
      'kiosk-401 stelz-icetea',
      'kiosk-407 stelz-icetea',
      'kiosk-416 bacardi-cola',
      'kiosk-420 fuze-tea',
      'kiosk-423 heineken-00',
      'kiosk-426 heineken-00',
    ])
  })

  it('laat 401 Bacardi Cola los nu de nieuwe lijst er geen vraagteken bij zet', () => {
    // Het getal blijft 30; alleen de twijfel is weg.
    expect(norm('kiosk-401', 'bacardi-cola')).toBe(30)
    expect(
      unconfirmedStandards.some((a) => a.kioskKey === 'kiosk-401' && a.productId === 'bacardi-cola')
    ).toBe(false)
  })

  it('verwijst naar bestaande kiosken en producten', () => {
    const kioskIds = new Set(demoKiosks.map((k) => k.id))
    for (const assumption of unconfirmedStandards) {
      expect(kioskIds.has(assumption.kioskKey), assumption.kioskKey).toBe(true)
      expect(norm(assumption.kioskKey, assumption.productId)).toBeDefined()
    }
  })
})

describe('elke grote koeling voert alle tien de dranken', () => {
  it.each(GROTE_KOELINGEN)('%s', (kioskKey) => {
    expect(secondRingStandards.find((c) => c.kioskKey === kioskKey)).toBeDefined()
    for (const productId of PRODUCT_VOLGORDE) {
      expect(norm(kioskKey, productId), `${kioskKey} ${productId}`).toBeGreaterThan(0)
    }
  })
})

describe('de papieren basis is compleet', () => {
  it.each(GROTE_KOELINGEN)('%s heeft alle tien de papieren dranknormen', (kioskKey) => {
    // De papieren lijst is de basis, ook waar een handmatige lijst hem
    // overschrijft. Alleen de gaten bewaren maakt van een halve bron een
    // schijnbaar hele.
    const papier = paperDrinksFor(kioskKey)
    expect(Object.keys(papier).sort()).toEqual([...PAPER_DRINK_PRODUCT_IDS].sort())

    for (const productId of PAPER_DRINK_PRODUCT_IDS) {
      expect(papier[productId], `${kioskKey} ${productId}`).toBeGreaterThan(0)
    }
  })
})

describe('de nieuwste handmatige lijst', () => {
  it.each(GROTE_KOELINGEN)('%s noemt alle tien de dranken', (kioskKey) => {
    // Sinds de bijgewerkte stocklijst is de handmatige lijst voor deze negen
    // compleet; er valt voor drank dus niets meer terug op papier.
    const handmatig = latestOverridesFor(kioskKey)
    const dranken = Object.keys(handmatig).filter((id) => PRODUCT_VOLGORDE.includes(id))

    expect(dranken.sort()).toEqual([...PRODUCT_VOLGORDE].sort())
  })

  it('noemt bij de bekerlijst alleen de drie bekerformaten', () => {
    for (const config of secondRingStandards) {
      const handmatig = latestOverridesFor(config.kioskKey)
      const overig = Object.keys(handmatig).filter(
        (id) => !PRODUCT_VOLGORDE.includes(id) && !CUP_PRODUCT_IDS.includes(id as never)
      )
      expect(overig, config.kioskKey).toEqual([])
    }
  })
})

describe('er is nog maar één bron voor de echte normen', () => {
  it('heeft geen tweede dataset in assortment.ts', async () => {
    const assortment = await import('../assortment')
    expect('COUNTED_DRINK_STANDARDS' in assortment).toBe(false)
  })

  it('gebruikt voor een authoritative kiosk de expliciete config', () => {
    // 401 Water Blauw is 25 volgens de config; assortmentForKiosk zou een
    // richtaantal rond de 14 geven.
    expect(norm('kiosk-401', 'chaudfontaine-blauw')).toBe(25)
  })

  it('gebruikt voor een kiosk zonder lijst nog het richtaantal', async () => {
    const { assortmentForKiosk } = await import('../assortment')
    // 405 heeft geen aangeleverde lijst; die valt terug op de afleiding.
    const richtaantallen = assortmentForKiosk(405)
    expect(richtaantallen.length).toBeGreaterThan(0)

    const uitStamdata = demoStandards.filter((s) => s.kioskId === 'kiosk-405')
    expect(uitStamdata).toHaveLength(richtaantallen.length)
  })

  it('laat de eerste ring ongewijzigd', async () => {
    const { assortmentForKiosk } = await import('../assortment')
    const kiosk110 = assortmentForKiosk(110)
    const uitStamdata = demoStandards.filter((s) => s.kioskId === 'kiosk-110')
    expect(uitStamdata).toHaveLength(kiosk110.length)
  })
})
