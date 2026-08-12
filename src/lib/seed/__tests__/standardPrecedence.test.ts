import { describe, it, expect } from 'vitest'
import {
  mergeStandards,
  secondRingStandards,
  unconfirmedStandards,
  paperDrinksFor,
  PAPER_DRINK_PRODUCT_IDS,
} from '../secondRingStandards'
import { demoKiosks, demoStandards } from '../demoData'

/**
 * De bronprioriteit van voorraadnormen.
 *
 * Er zijn twee bronnen: de papieren bestellijst per kiosk en een latere
 * handmatige dranknotitie. De notitie wint, maar alleen voor de combinaties
 * kiosk + product die er met name in staan. Wat er niet in staat valt terug op
 * de papieren norm van diezelfde kiosk — nooit op die van een andere.
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

/** De norm zoals hij in de stamdata terechtkomt, in hele verpakkingen. */
function norm(kioskKey: string, productId: string): number | undefined {
  const standard = demoStandards.find(
    (s) => s.kioskId === kioskKey && s.productId === productId
  )
  return standard ? standard.targetQuantityQuarters / 4 : undefined
}

function drinksOf(kioskKey: string): Array<number | undefined> {
  return PRODUCT_VOLGORDE.map((productId) => norm(kioskKey, productId))
}

describe('mergeStandards', () => {
  it('laat de override winnen', () => {
    expect(mergeStandards({ water: 15 }, { water: 25 })).toEqual({ water: 25 })
  })

  it('houdt wat de override niet noemt', () => {
    const result = mergeStandards({ water: 15, redbull: 6 }, { water: 25 })
    expect(result).toEqual({ water: 25, redbull: 6 })
  })

  it('wist niets wanneer er geen override is', () => {
    expect(mergeStandards({ water: 15, redbull: 6 })).toEqual({ water: 15, redbull: 6 })
  })

  it('laat de basis onaangeroerd', () => {
    const basis = { water: 15 }
    mergeStandards(basis, { water: 25 })
    expect(basis).toEqual({ water: 15 })
  })
})

describe('bronprioriteit', () => {
  it('gebruikt de notitiewaarde waar die bestaat', () => {
    // 401 Water Blauw staat op de notitie.
    expect(norm('kiosk-401', 'chaudfontaine-blauw')).toBe(25)
  })

  it('valt terug op de eigen papieren norm, niet op die van een buurkiosk', () => {
    // 401 Red Bull staat niet op de notitie. Papier zegt 6; verschillende
    // grote koelingen zeggen 10, en dat getal hoort hier niet te verschijnen.
    expect(norm('kiosk-401', 'redbull')).toBe(6)
    expect(norm('kiosk-401', 'jack-daniels')).toBe(6)
  })

  it('geeft 423 zijn eigen papieren normen', () => {
    expect(norm('kiosk-423', 'radler')).toBe(5)
    expect(norm('kiosk-423', 'jack-daniels')).toBe(5)
    expect(norm('kiosk-423', 'redbull')).toBe(6)
  })

  it('geeft 426 Jack Daniels van papier', () => {
    expect(norm('kiosk-426', 'jack-daniels')).toBe(6)
  })

  it('geeft 419 Jack Daniels van papier', () => {
    // Stond eerder op 8: overgenomen van een andere kiosk. Papier zegt 5.
    expect(norm('kiosk-419', 'jack-daniels')).toBe(5)
  })

  it('laat een override de overige dranken van dezelfde kiosk staan', () => {
    // De notitie noemt voor 423 maar zes producten. De andere vier moeten
    // gewoon uit de papieren lijst blijven komen.
    const genoemdOpNotitie = [
      'chaudfontaine-blauw',
      'chaudfontaine-rood',
      'fuze-tea',
      'heineken-00',
      'stelz-icetea',
      'bacardi-cola',
    ]
    const nietGenoemd = PRODUCT_VOLGORDE.filter((p) => !genoemdOpNotitie.includes(p))

    for (const productId of nietGenoemd) {
      expect(norm('kiosk-423', productId), productId).toBeDefined()
    }
  })
})

describe('definitieve drankmatrix', () => {
  const MATRIX: Record<string, number[]> = {
    'kiosk-401': [25, 6, 25, 12, 8, 30, 10, 6, 6, 30],
    'kiosk-403': [25, 6, 15, 10, 8, 20, 8, 5, 8, 25],
    'kiosk-407': [20, 6, 21, 7, 7, 29, 12, 12, 10, 15],
    'kiosk-410': [25, 8, 21, 10, 7, 25, 10, 6, 6, 30],
    'kiosk-416': [25, 6, 20, 10, 10, 24, 8, 6, 6, 30],
    'kiosk-419': [20, 6, 20, 10, 7, 15, 8, 5, 10, 30],
    'kiosk-420': [25, 8, 25, 15, 10, 25, 12, 8, 10, 20],
    'kiosk-423': [20, 6, 20, 15, 5, 15, 10, 5, 6, 25],
    'kiosk-426': [25, 6, 28, 15, 10, 15, 10, 6, 10, 30],
  }

  it.each(Object.entries(MATRIX))('%s', (kioskKey, verwacht) => {
    expect(drinksOf(kioskKey)).toEqual(verwacht)
  })
})

describe('non-drank blijft van papier', () => {
  it('houdt de papieren normen van een satelliet', () => {
    expect(norm('kiosk-402', 'bierbeker-05')).toBe(1)
    expect(norm('kiosk-402', 'chips-blauw')).toBe(2)
    expect(norm('kiosk-402', 'tork-rol')).toBe(6)
  })

  it('houdt de papieren normen van een grote koeling', () => {
    expect(norm('kiosk-419', 'bierbeker-05')).toBe(3)
    expect(norm('kiosk-419', 'square-bakjes')).toBe(2)
    expect(norm('kiosk-406', 'tork-rol')).toBe(6)
  })
})

describe('geen tijdelijke aannames meer', () => {
  it('houdt alleen de waarden met een vraagteken als onbevestigd', () => {
    // De elf van vergelijkbare kiosken overgenomen waarden zijn vervangen door
    // hun eigen papieren norm en horen hier niet meer te staan.
    expect(unconfirmedStandards).toHaveLength(7)

    const jackDaniels = unconfirmedStandards.filter((a) => a.productId === 'jack-daniels')
    const redbull = unconfirmedStandards.filter((a) => a.productId === 'redbull')
    expect(jackDaniels).toEqual([])
    expect(redbull).toEqual([])
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
  const grootKoeling = [
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

  it.each(grootKoeling)('%s', (kioskKey) => {
    // Een ontbrekende norm zou betekenen dat papier én notitie allebei zwijgen;
    // dat mag, maar bij deze negen weten we dat het niet zo is.
    expect(secondRingStandards.find((c) => c.kioskKey === kioskKey)).toBeDefined()
    for (const productId of PRODUCT_VOLGORDE) {
      expect(norm(kioskKey, productId), `${kioskKey} ${productId}`).toBeGreaterThan(0)
    }
  })
})

describe('de papieren basis is compleet', () => {
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

  it.each(GROTE_KOELINGEN)('%s heeft alle tien de papieren dranknormen', (kioskKey) => {
    // De papieren lijst is de basis, ook waar de notitie hem overschrijft.
    // Alleen de gaten bewaren maakt van een halve bron een schijnbaar hele.
    const papier = paperDrinksFor(kioskKey)
    expect(Object.keys(papier).sort()).toEqual([...PAPER_DRINK_PRODUCT_IDS].sort())

    for (const productId of PAPER_DRINK_PRODUCT_IDS) {
      expect(papier[productId], `${kioskKey} ${productId}`).toBeGreaterThan(0)
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
