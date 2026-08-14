import { describe, it, expect } from 'vitest'
import {
  DISPOSABLE_PRODUCT_IDS,
  LOCAL_DRINK_STOCK_KIOSK_KEYS,
  latestOverridesFor,
  paperStandardsFor,
  secondRingStandards,
} from '../secondRingStandards'
import { demoKiosks, demoStandards } from '../demoData'
import { demoProducts, CAT_SCHOONMAAK_ID } from '../catalogue'
import { InputStep, DrinkStorageType } from '@/types'

/**
 * De drie nieuwste stocklijsten: Disposable, GFT en Ziggo Platform.
 *
 * De getallen hieronder zijn met de hand overgetypt van de bron en staan
 * bewust náást die in `secondRingStandards.ts`. Twee keer hetzelfde overtypen
 * is de enige manier waarop deze test iets zegt: zou hij dezelfde constante
 * importeren, dan bewijst hij alleen dat een object gelijk is aan zichzelf.
 *
 * Wat hier vastligt en waarom:
 *
 *   · Een positief getal is een actieve norm van precies dat aantal.
 *   · Een 0 is géén actieve norm. Niet norm nul — dan blijft het product bij
 *     het tellen staan met een streefwaarde van niets en heet het altijd
 *     "compleet".
 *   · Een locatie die niet op een lijst staat verandert niet. Weglating is
 *     geen deactivering.
 */

/** De norm zoals hij in de stamdata terechtkomt, in hele verpakkingen. */
function norm(kioskKey: string, productId: string): number | undefined {
  const standard = demoStandards.find((s) => s.kioskId === kioskKey && s.productId === productId)
  return standard ? standard.targetQuantityQuarters / 4 : undefined
}

function disposablesOf(kioskKey: string): Array<number | undefined> {
  return DISPOSABLE_PRODUCT_IDS.map((productId) => norm(kioskKey, productId))
}

// ─── Disposable ───────────────────────────────────────────────────────────

/**
 * De Disposable-lijst, letterlijk overgetypt.
 *
 * Kolomvolgorde: Rectangular / Square / Patat / Servetten / Biertrays /
 * Patat vorkjes / Arena blaadjes. Sleutelvolgorde die van de bron, zodat de
 * regels naast het papier te leggen zijn.
 */
const DISPOSABLE_BRON: Record<string, number[]> = {
  'kiosk-423': [0, 2, 3, 5, 3, 1, 0],
  'kiosk-424': [0, 0, 0, 0, 1, 0, 0],
  'kiosk-426': [2, 0, 0, 5, 3, 0, 1],
  'kiosk-427': [2, 2, 0, 5, 3, 0, 0],
  'kiosk-429': [2, 2, 0, 5, 3, 0, 0],
  'kiosk-401': [2, 0, 0, 5, 3, 0, 1],
  'kiosk-402': [0, 0, 0, 0, 1, 0, 0],
  'kiosk-403': [0, 2, 3, 5, 3, 1, 0],
  'kiosk-404': [2, 0, 0, 5, 3, 1, 1],
  'kiosk-406': [2, 0, 0, 5, 3, 0, 1],
  'kiosk-406-nieuw': [2, 2, 0, 5, 3, 0, 1],
  'kiosk-407': [0, 2, 3, 5, 3, 1, 1],
  'kiosk-409': [0, 0, 0, 0, 1, 0, 0],
  'kiosk-410': [3, 0, 0, 5, 3, 1, 1],
  'kiosk-412': [2, 2, 0, 5, 3, 0, 0],
  'kiosk-414': [2, 2, 0, 5, 3, 0, 0],
  'kiosk-416': [3, 0, 0, 5, 3, 0, 1],
  'kiosk-417': [2, 0, 0, 5, 3, 0, 1],
  'kiosk-419': [0, 2, 2, 5, 3, 1, 1],
  'kiosk-ziggo-platform': [0, 0, 0, 0, 3, 0, 0],
  'kiosk-420-bar': [0, 0, 0, 0, 4, 0, 0],
  'kiosk-420': [3, 3, 1, 5, 3, 0, 1],
}

/**
 * Waar een nieuwere, specifiekere bron over de Disposable-lijst heen gaat.
 *
 * Eén geval, en het is bewust: de Disposable-lijst zegt Ziggo Biertrays 3, de
 * specifieke Ziggo Platform-lijst zegt 1. Dat staat hier apart in plaats van
 * dat de 3 hierboven stilletjes een 1 wordt — anders is over een maand niet
 * meer te zien dat er een conflict wás.
 */
const OVERRULED_DOOR_ZIGGO: Record<string, Record<string, number>> = {
  'kiosk-ziggo-platform': { sixpacks: 1 },
}

function verwachteDisposable(kioskKey: string): Array<number | undefined> {
  const bron = DISPOSABLE_BRON[kioskKey]!
  return DISPOSABLE_PRODUCT_IDS.map((productId, index) => {
    const specifieker = OVERRULED_DOOR_ZIGGO[kioskKey]?.[productId]
    if (specifieker !== undefined) return specifieker

    const waarde = bron[index]!
    return waarde === 0 ? undefined : waarde
  })
}

describe('de volledige Disposable-matrix', () => {
  it.each(Object.keys(DISPOSABLE_BRON))('%s', (kioskKey) => {
    expect(disposablesOf(kioskKey)).toEqual(verwachteDisposable(kioskKey))
  })

  it('dekt de tweeëntwintig locaties van de lijst', () => {
    expect(Object.keys(DISPOSABLE_BRON)).toHaveLength(22)
  })

  it('maakt van elke nul een ontbrekende regel, niet een norm van nul', () => {
    for (const [kioskKey, waarden] of Object.entries(DISPOSABLE_BRON)) {
      for (const [index, waarde] of waarden.entries()) {
        if (waarde !== 0) continue
        const productId = DISPOSABLE_PRODUCT_IDS[index]!
        if (OVERRULED_DOOR_ZIGGO[kioskKey]?.[productId] !== undefined) continue

        expect(
          demoStandards.some((s) => s.kioskId === kioskKey && s.productId === productId),
          `${kioskKey} ${productId}`
        ).toBe(false)
      }
    }
  })

  it('laat de gevallen uit de opdracht kloppen', () => {
    // Dezelfde regels als hierboven, maar uitgeschreven: dit zijn de locaties
    // waar de lijst het meest van de vorige situatie afwijkt.
    expect(disposablesOf('kiosk-423')).toEqual([undefined, 2, 3, 5, 3, 1, undefined])
    expect(disposablesOf('kiosk-424')).toEqual([
      undefined,
      undefined,
      undefined,
      undefined,
      1,
      undefined,
      undefined,
    ])
    expect(disposablesOf('kiosk-403')).toEqual([undefined, 2, 3, 5, 3, 1, undefined])
    expect(disposablesOf('kiosk-419')).toEqual([undefined, 2, 2, 5, 3, 1, 1])
    expect(disposablesOf('kiosk-420-bar')).toEqual([
      undefined,
      undefined,
      undefined,
      undefined,
      4,
      undefined,
      undefined,
    ])
    expect(disposablesOf('kiosk-420')).toEqual([3, 3, 1, 5, 3, undefined, 1])
  })

  it('laat 422 met rust, want die staat niet op de lijst', () => {
    // Geen inference: een lijst die over tweeëntwintig locaties gaat zegt niets
    // over de drieëntwintigste. 422 hield één disposable — servetten — en houdt
    // die.
    expect(DISPOSABLE_BRON['kiosk-422']).toBeUndefined()
    expect(norm('kiosk-422', 'servetten')).toBe(5)
    expect(paperStandardsFor('kiosk-422').servetten).toBe(5)
  })

  it('raakt niets aan buiten de zeven producten', () => {
    // 401 staat op de lijst; chips, koffie, Tork, vuilniszakken, drank, bekers
    // en sauzen mogen daar niet door veranderen.
    expect(norm('kiosk-401', 'chips-blauw')).toBe(6)
    expect(norm('kiosk-401', 'koffie')).toBe(2)
    expect(norm('kiosk-401', 'tork-rol')).toBe(6)
    expect(norm('kiosk-401', 'vuilniszakken')).toBe(1)
    expect(norm('kiosk-401', 'chaudfontaine-blauw')).toBe(25)
    expect(norm('kiosk-401', 'bierbeker-05')).toBe(5)
    expect(norm('kiosk-401', 'ketchup-flessen')).toBe(15)
    expect(norm('kiosk-401', 'koolzuur')).toBe(2)
  })

  it('gebruikt de bestaande Biertrays-rij en maakt er geen tweede naast', () => {
    // Het product heet zichtbaar "Biertrays"; het seed-id bleef `sixpacks`,
    // zodat elke eerdere telling naar dezelfde rij blijft wijzen.
    expect(DISPOSABLE_PRODUCT_IDS).toContain('sixpacks')
    expect(demoProducts.filter((p) => p.name === 'Biertrays')).toHaveLength(1)
    expect(demoProducts.find((p) => p.id === 'sixpacks')?.name).toBe('Biertrays')
    expect(demoProducts.some((p) => p.id === 'biertrays')).toBe(false)
  })
})

// ─── GFT ──────────────────────────────────────────────────────────────────

/** De acht locaties die de GFT-lijst noemt. */
const MET_GFT = [
  'kiosk-401',
  'kiosk-403',
  'kiosk-407',
  'kiosk-410',
  'kiosk-416',
  'kiosk-419',
  'kiosk-420',
  'kiosk-423',
]

describe('de GFT-lijst', () => {
  it.each(MET_GFT)('%s heeft één GFT-bak', (kioskKey) => {
    expect(norm(kioskKey, 'gft-bak')).toBe(1)
  })

  it.each([
    'kiosk-402',
    'kiosk-404',
    'kiosk-406',
    'kiosk-406-nieuw',
    'kiosk-409',
    'kiosk-412',
    'kiosk-414',
    'kiosk-417',
    'kiosk-420-bar',
    'kiosk-422',
    'kiosk-424',
    'kiosk-426',
    'kiosk-427',
    'kiosk-429',
    'kiosk-ziggo-platform',
  ])('%s heeft er geen', (kioskKey) => {
    // De bron noemt acht locaties. Een negende erbij verzinnen omdat hij op de
    // acht lijkt, levert elke ronde een tekort van één op dat niemand oplost.
    expect(norm(kioskKey, 'gft-bak')).toBeUndefined()
  })

  it('staat bij precies acht locaties en nergens anders', () => {
    const met = demoStandards.filter((s) => s.productId === 'gft-bak').map((s) => s.kioskId)
    expect(met.sort()).toEqual([...MET_GFT].sort())
  })

  it('bestaat als één product bij Schoonmaak', () => {
    const gft = demoProducts.filter((p) => p.id === 'gft-bak')
    expect(gft).toHaveLength(1)
    expect(demoProducts.filter((p) => p.name === 'GFT Bak')).toHaveLength(1)

    const product = gft[0]!
    expect(product.categoryId).toBe(CAT_SCHOONMAAK_ID)
    expect(product.name).toBe('GFT Bak')
    expect(product.shortName).toBe('GFT')
    expect(product.countUnit).toBe('bak')
    expect(product.packagingUnit).toBe('bakken')
  })

  it('telt in hele bakken', () => {
    // Een halve GFT-bak is geen aantal dat iemand kan aanwijzen. De norm blijft
    // zichtbaar voor de vuller, ook al wordt er niet geteld.
    const product = demoProducts.find((p) => p.id === 'gft-bak')
    expect(product?.inputStep).toBe(InputStep.ONE)
    expect(product?.allowPartialPackage).toBe(false)
  })

  it('wordt na elk evenement opgehaald en staat dus niet op de tellijst', () => {
    // De kiosk begint elke keer leeg; tellen zou altijd nul opleveren en
    // ondertussen het afronden blokkeren bij een teller die niets kan vinden.
    expect(demoProducts.find((p) => p.id === 'gft-bak')?.collectedAfterEvent).toBe(true)
  })

  it('is het enige product met dat kenmerk', () => {
    // Het haalt een product van de tellijst af; dat hoort nergens per ongeluk
    // aan te staan.
    const met = demoProducts.filter((p) => p.collectedAfterEvent).map((p) => p.id)
    expect(met).toEqual(['gft-bak'])
  })

  it('houdt zijn norm, want die is de vulopdracht', () => {
    // Niet tellen betekent niet "geen norm": de norm ís precies wat er elke
    // ronde gebracht moet worden.
    for (const kioskKey of MET_GFT) {
      expect(norm(kioskKey, 'gft-bak'), kioskKey).toBe(1)
    }
  })

  it('heeft geen snelknoppen, want er wordt niet geteld', async () => {
    const { QUICK_COUNT_CONFIG } = await import('@/lib/counting/quickCountConfig')
    expect(QUICK_COUNT_CONFIG['GFT Bak']).toBeUndefined()
  })

  it('valt niet onder de satelliet-drankuitzondering', () => {
    expect(demoProducts.find((p) => p.id === 'gft-bak')?.suppliedFromLargeCoolerForSatellite).toBe(
      false
    )
  })
})

// ─── Ziggo Platform ───────────────────────────────────────────────────────

describe('de specifieke Ziggo Platform-lijst', () => {
  const ZIGGO = 'kiosk-ziggo-platform'

  const VERWACHT: Record<string, number> = {
    'bierbeker-03': 1,
    'bierbeker-04': 1,
    'bierbeker-05': 1,

    'chips-blauw': 2,
    'chips-rood': 2,
    'chips-oranje': 2,

    vuilniszakken: 3,
    sixpacks: 1,

    'chaudfontaine-blauw': 1,
    'chaudfontaine-rood': 2,
    'fuze-tea': 2,
    'heineken-00': 1,
    radler: 1,
    'stelz-icetea': 2,
    'bacardi-lemon': 1,
    'jack-daniels': 1,
    redbull: 1,
    'bacardi-cola': 2,

    cola: 10,
    'cola-zero': 10,
    fanta: 6,
    sprite: 6,
  }

  it.each(Object.entries(VERWACHT))('%s = %i', (productId, aantal) => {
    expect(norm(ZIGGO, productId)).toBe(aantal)
  })

  it('hoort bij de bestaande locatie en maakt geen kiosk "420 Ziggo"', () => {
    const kiosk = demoKiosks.find((k) => k.id === ZIGGO)
    expect(kiosk?.label).toBe('Ziggo Platform')
    expect(kiosk?.number).toBe(4300)
    expect(demoKiosks.filter((k) => k.label === 'Ziggo Platform')).toHaveLength(1)
    expect(demoKiosks.some((k) => k.label === '420 Ziggo')).toBe(false)
  })

  it('wint van de algemene Disposable-lijst bij de Biertrays', () => {
    // Dit is het conflict, en het is bewust: Disposable zegt 3, de specifieke
    // lijst zegt 1. Zou de mergevolgorde ooit omdraaien, dan valt het hier om
    // en niet pas op de vloer.
    expect(DISPOSABLE_BRON[ZIGGO]![4]).toBe(3)
    expect(norm(ZIGGO, 'sixpacks')).toBe(1)
  })

  it('wint van de eerdere beker-, chips- en Post-mixwaarden', () => {
    const papier = paperStandardsFor(ZIGGO)

    // Papier kende hier geen 0,3-beker; de Ziggo-lijst wel.
    expect(papier['bierbeker-03']).toBeUndefined()
    expect(norm(ZIGGO, 'bierbeker-03')).toBe(1)

    // Papier zei 2 pakken Cola; de Ziggo-lijst zegt 10.
    expect(papier.cola).toBe(2)
    expect(norm(ZIGGO, 'cola')).toBe(10)

    // Papier zei 1 rol vuilniszakken; de Ziggo-lijst zegt 3.
    expect(papier.vuilniszakken).toBe(1)
    expect(norm(ZIGGO, 'vuilniszakken')).toBe(3)
  })

  it('laat niet-genoemde producten staan', () => {
    // Tork staat niet op de nieuwe lijst en blijft dus van papier komen.
    expect(latestOverridesFor(ZIGGO)['tork-rol']).toBeUndefined()
    expect(norm(ZIGGO, 'tork-rol')).toBe(6)
  })

  it('laat een koolzuurnorm ongemoeid als die er zou zijn', () => {
    // De Ziggo-lijst noemt koolzuur niet, en weglating is geen deactivering.
    // Deze locatie hád er al geen; wat de test vastlegt is dat de lijst er niet
    // over gaat, zodat een latere koolzuurnorm hier niet stilletjes sneuvelt.
    expect(latestOverridesFor(ZIGGO).koolzuur).toBeUndefined()
    expect(norm(ZIGGO, 'koolzuur')).toBe(paperStandardsFor(ZIGGO).koolzuur)
  })

  it('telt Post-mix in hele pakken', () => {
    for (const productId of ['cola', 'cola-zero', 'fanta', 'sprite']) {
      const product = demoProducts.find((p) => p.id === productId)
      expect(product?.inputStep, productId).toBe(InputStep.ONE)
      expect(product?.allowPartialPackage, productId).toBe(false)
    }
  })

  it('gebruikt de bekers in dozen', () => {
    for (const productId of ['bierbeker-03', 'bierbeker-04', 'bierbeker-05']) {
      const product = demoProducts.find((p) => p.id === productId)
      expect(product?.countUnit, productId).toBe('doos')
      expect(product?.packagingUnit, productId).toBe('dozen')
    }
  })
})

// ─── Bronprioriteit ───────────────────────────────────────────────────────

describe('bronprioriteit van de nieuwe lijsten', () => {
  it('A. de Disposable-lijst wint van papier', () => {
    // 419 patatbakjes: papier 3, Disposable 2.
    expect(paperStandardsFor('kiosk-419')['patat-bakjes']).toBe(3)
    expect(norm('kiosk-419', 'patat-bakjes')).toBe(2)

    // 412 rectangular: papier 3, Disposable 2.
    expect(paperStandardsFor('kiosk-412')['rectangular-bakjes']).toBe(3)
    expect(norm('kiosk-412', 'rectangular-bakjes')).toBe(2)

    // 416 rectangular de andere kant op: papier 2, Disposable 3.
    expect(paperStandardsFor('kiosk-416')['rectangular-bakjes']).toBe(2)
    expect(norm('kiosk-416', 'rectangular-bakjes')).toBe(3)
  })

  it('B. de specifieke Ziggo-lijst wint van de Disposable-lijst', () => {
    expect(norm('kiosk-ziggo-platform', 'sixpacks')).toBe(1)
  })

  it('C. de specifieke Ziggo-lijst wint van de eerdere bekers, chips en Post-mix', () => {
    expect(norm('kiosk-ziggo-platform', 'cola-zero')).toBe(10)
    expect(norm('kiosk-ziggo-platform', 'bierbeker-03')).toBe(1)
    expect(norm('kiosk-ziggo-platform', 'chips-oranje')).toBe(2)
  })

  it('D. producten buiten de nieuwe lijsten houden hun eerdere norm', () => {
    // De chipslijst blijft leidend waar de nieuwe lijsten niets zeggen.
    expect(norm('kiosk-403', 'chips-blauw')).toBe(8)
    expect(norm('kiosk-420-bar', 'chips-blauw')).toBe(10)

    // De bekerlijst ook, inclusief zijn eigen nullen.
    expect(norm('kiosk-420', 'bierbeker-05')).toBeUndefined()
    expect(norm('kiosk-412', 'bierbeker-03')).toBeUndefined()

    // En de Post-mixlijst.
    expect(norm('kiosk-407', 'fanta')).toBeUndefined()
    expect(norm('kiosk-416', 'cola-zero')).toBe(6)
  })

  it('E. een expliciete 0 haalt een bestaande norm weg', () => {
    // 419 voerde geen rectangular en 423 geen arena blaadjes; de nullen
    // bevestigen dat, en zouden ze weggehaald hebben als ze er wel stonden.
    expect(norm('kiosk-419', 'rectangular-bakjes')).toBeUndefined()
    expect(norm('kiosk-423', 'arena-blaadjes')).toBeUndefined()

    // Het geval waar de 0 werkelijk iets weghaalt: 412 en 414 voerden op papier
    // geen patatbakjes, maar 427 en 429 hadden square bakjes die blijven — de
    // 0 raakt alleen wat de lijst zelf op nul zet.
    expect(norm('kiosk-427', 'square-bakjes')).toBe(2)
    expect(norm('kiosk-427', 'patat-bakjes')).toBeUndefined()
  })

  it('F. weglating haalt niets weg', () => {
    // 426 staat wél op de Disposable-lijst maar niet op de Ziggo-lijst; 422
    // staat op geen van beide. Allebei houden ze alles wat ze hadden.
    expect(norm('kiosk-426', 'chips-blauw')).toBe(6)
    expect(norm('kiosk-426', 'koolzuur')).toBe(2)
    expect(norm('kiosk-422', 'servetten')).toBe(5)
    expect(norm('kiosk-422', 'lavazza-bekers')).toBe(5)
    expect(norm('kiosk-422', 'tork-rol')).toBe(6)
  })

  it('laat de grote-koelingdrank ongemoeid', () => {
    // Deze drie lijsten gaan niet over drank bij de negen grote koelingen.
    expect(norm('kiosk-401', 'chaudfontaine-blauw')).toBe(25)
    expect(norm('kiosk-407', 'stelz-icetea')).toBe(29)
    expect(norm('kiosk-419', 'jack-daniels')).toBe(8)
    expect(norm('kiosk-426', 'bacardi-cola')).toBe(30)
  })

  it('verwijst alleen naar bestaande producten', () => {
    const productIds = new Set(demoProducts.map((p) => p.id))
    for (const config of secondRingStandards) {
      for (const productId of Object.keys(latestOverridesFor(config.kioskKey))) {
        expect(productIds.has(productId), `${config.kioskKey} → ${productId}`).toBe(true)
      }
    }
  })

  it('verwijst alleen naar bestaande kiosken', () => {
    const kioskKeys = new Set(secondRingStandards.map((c) => c.kioskKey))
    for (const kioskKey of Object.keys(DISPOSABLE_BRON)) {
      expect(kioskKeys.has(kioskKey), kioskKey).toBe(true)
    }
    for (const kioskKey of LOCAL_DRINK_STOCK_KIOSK_KEYS) {
      expect(kioskKeys.has(kioskKey), kioskKey).toBe(true)
    }
  })
})

// ─── De drankregel na de uitzondering ─────────────────────────────────────

describe('de drankregel houdt stand naast de Ziggo-uitzondering', () => {
  it.each([
    ['kiosk-402', 'fuze-tea'],
    ['kiosk-404', 'chaudfontaine-blauw'],
    ['kiosk-406', 'redbull'],
    ['kiosk-406-nieuw', 'heineken-00'],
    ['kiosk-409', 'radler'],
    ['kiosk-412', 'bacardi-cola'],
    ['kiosk-414', 'stelz-icetea'],
    ['kiosk-417', 'jack-daniels'],
    ['kiosk-424', 'chaudfontaine-rood'],
    ['kiosk-427', 'bacardi-lemon'],
    ['kiosk-429', 'fuze-tea'],
    ['kiosk-420-bar', 'redbull'],
  ])('%s voert geen %s', (kioskKey, productId) => {
    expect(norm(kioskKey, productId)).toBeUndefined()
  })

  it('geeft Ziggo dezelfde producten wél', () => {
    expect(norm('kiosk-ziggo-platform', 'fuze-tea')).toBe(2)
    expect(norm('kiosk-ziggo-platform', 'redbull')).toBe(1)
  })

  it('houdt het opslagtype eerlijk', () => {
    // Geen fake LARGE_COOLER: er staat daar geen koeling.
    const ziggo = demoKiosks.find((k) => k.id === 'kiosk-ziggo-platform')
    expect(ziggo?.drinkStorageType).toBe(DrinkStorageType.SATELLITE)
    expect(ziggo?.keepsOwnDrinkStock).toBe(true)

    const bar = demoKiosks.find((k) => k.id === 'kiosk-420-bar')
    expect(bar?.keepsOwnDrinkStock).toBe(false)
  })
})
