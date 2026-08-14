import { describe, it, expect } from 'vitest'
import {
  secondRingStandards,
  authoritativeKioskKeys,
  paperStandardsFor,
} from '../secondRingStandards'
import { demoKiosks, demoStandards } from '../demoData'
import { demoProducts } from '../catalogue'
import { DrinkStorageType } from '@/types'

/**
 * De stamdata tegen de papieren lijst.
 *
 * Deze tests zijn saai en dat is de bedoeling: een verschoven getal in een
 * normlijst valt nergens op tot een kiosk leegloopt.
 */

const configByKey = new Map(secondRingStandards.map((c) => [c.kioskKey, c]))

/** Norm in hele verpakkingen zoals hij in de stamdata terechtkomt. */
function norm(kioskKey: string, productId: string): number | undefined {
  const kiosk = demoKiosks.find((k) => k.id === kioskKey)
  if (!kiosk) throw new Error(`Onbekende kiosk ${kioskKey}`)

  const standard = demoStandards.find(
    (s) => s.kioskId === kiosk.id && s.productId === productId
  )
  return standard ? standard.targetQuantityQuarters / 4 : undefined
}

describe('opslagtypes', () => {
  const verwacht: Array<[DrinkStorageType, string[]]> = [
    [
      DrinkStorageType.LARGE_COOLER,
      ['401', '403', '407', '410', '416', '419', '420', '423', '426'].map((n) => `kiosk-${n}`),
    ],
    [
      DrinkStorageType.SATELLITE,
      [
        'kiosk-402',
        'kiosk-404',
        'kiosk-406',
        'kiosk-406-nieuw',
        'kiosk-409',
        'kiosk-412',
        'kiosk-414',
        'kiosk-417',
        'kiosk-424',
        'kiosk-427',
        'kiosk-429',
        'kiosk-ziggo-platform',
      ],
    ],
    [DrinkStorageType.SMALL_BAR, ['kiosk-420-bar']],
    [DrinkStorageType.NONE, ['kiosk-422']],
  ]

  it.each(verwacht)('%s', (type, keys) => {
    for (const key of keys) {
      expect(configByKey.get(key)?.drinkStorageType, key).toBe(type)
    }
  })

  it('zet het opslagtype ook door naar de kiosken zelf', () => {
    const kiosk401 = demoKiosks.find((k) => k.id === 'kiosk-401')
    const kiosk402 = demoKiosks.find((k) => k.id === 'kiosk-402')
    const bar = demoKiosks.find((k) => k.id === 'kiosk-420-bar')

    expect(kiosk401?.drinkStorageType).toBe(DrinkStorageType.LARGE_COOLER)
    expect(kiosk402?.drinkStorageType).toBe(DrinkStorageType.SATELLITE)
    expect(bar?.drinkStorageType).toBe(DrinkStorageType.SMALL_BAR)
  })

  it('laat een satelliet zonder vastgestelde bronkiosk leeg', () => {
    // Raden welke grote kiosk de bron is zou een verkeerde relatie vastleggen.
    for (const kiosk of demoKiosks) {
      expect(kiosk.drinkSourceKioskId ?? null, kiosk.id).toBeNull()
    }
  })
})

describe('dranknormen van de grote koelingen', () => {
  const gevallen: Array<[string, Record<string, number>]> = [
    [
      'kiosk-401',
      {
        'chaudfontaine-blauw': 25,
        'fuze-tea': 25,
        'stelz-icetea': 30,
        'bacardi-cola': 30,
      },
    ],
    ['kiosk-403', { 'chaudfontaine-blauw': 25, redbull: 8, 'bacardi-cola': 25 }],
    [
      'kiosk-407',
      {
        'chaudfontaine-blauw': 20,
        'fuze-tea': 21,
        'stelz-icetea': 29,
        'jack-daniels': 8,
        'bacardi-cola': 15,
      },
    ],
    ['kiosk-410', { 'chaudfontaine-rood': 8, 'fuze-tea': 21, 'bacardi-cola': 30 }],
    ['kiosk-416', { 'fuze-tea': 20, 'stelz-icetea': 24, 'bacardi-cola': 30 }],
    [
      'kiosk-419',
      {
        'chaudfontaine-blauw': 20,
        'chaudfontaine-rood': 6,
        'fuze-tea': 20,
        'heineken-00': 10,
        radler: 7,
        'stelz-icetea': 15,
        'bacardi-lemon': 10,
        redbull: 10,
        'bacardi-cola': 30,
      },
    ],
    ['kiosk-420', { 'chaudfontaine-blauw': 25, 'fuze-tea': 25, 'bacardi-cola': 20 }],
    ['kiosk-423', { 'chaudfontaine-blauw': 20, 'fuze-tea': 20, 'bacardi-cola': 25 }],
    ['kiosk-426', { 'chaudfontaine-blauw': 25, 'fuze-tea': 28, 'bacardi-cola': 30 }],
  ]

  it.each(gevallen)('%s', (kioskKey, verwacht) => {
    for (const [productId, aantal] of Object.entries(verwacht)) {
      expect(norm(kioskKey, productId), `${kioskKey} ${productId}`).toBe(aantal)
    }
  })
})

describe('419 volgens de papieren lijst', () => {
  it('heeft de non-dranknormen van het papier', () => {
    // Bewust zonder de bekers, de chips en de zeven disposables: die komen
    // sinds de nieuwe handmatige lijsten niet meer van papier. Zie de tests
    // hieronder en de Disposable-matrix in standardPrecedence.
    const verwacht: Record<string, number> = {
      'mayo-emmers': 5,
      'ketchup-flessen': 15,
    }

    for (const [productId, aantal] of Object.entries(verwacht)) {
      expect(norm('kiosk-419', productId), productId).toBe(aantal)
    }
  })

  it('volgt voor de bekers de nieuwere handmatige lijst', () => {
    // Papier zei 3 en 2 en kende geen 0,3; de bekerlijst zegt 3, 3 en 1.
    expect(norm('kiosk-419', 'bierbeker-05')).toBe(3)
    expect(norm('kiosk-419', 'bierbeker-04')).toBe(3)
    expect(norm('kiosk-419', 'bierbeker-03')).toBe(1)
  })

  it('volgt voor de chips de nieuwere handmatige lijst', () => {
    // Papier zei 6, 5 en 5; de chipslijst zegt 7, 5 en 5.
    expect(norm('kiosk-419', 'chips-blauw')).toBe(7)
    expect(norm('kiosk-419', 'chips-rood')).toBe(5)
    expect(norm('kiosk-419', 'chips-oranje')).toBe(5)
  })

  it('volgt voor de verpakkingen de nieuwste Disposable-lijst', () => {
    // Papier zei drie patatbakjes; de Disposable-lijst zegt er twee. De rest
    // van de regel bevestigt wat er al stond.
    expect(paperStandardsFor('kiosk-419')['patat-bakjes']).toBe(3)
    expect(norm('kiosk-419', 'patat-bakjes')).toBe(2)

    expect(norm('kiosk-419', 'square-bakjes')).toBe(2)
    expect(norm('kiosk-419', 'servetten')).toBe(5)
    expect(norm('kiosk-419', 'sixpacks')).toBe(3)
    expect(norm('kiosk-419', 'patat-vorkjes')).toBe(1)
    expect(norm('kiosk-419', 'arena-blaadjes')).toBe(1)

    // Rectangular staat op die lijst met een 0 en heeft dus geen norm — 419
    // voerde ze al niet en krijgt ze er ook niet bij.
    expect(norm('kiosk-419', 'rectangular-bakjes')).toBeUndefined()
  })

  it('krijgt een GFT-bak', () => {
    expect(norm('kiosk-419', 'gft-bak')).toBe(1)
  })

  it('voert geen post-mix en geen van de andere niet-genoemde producten', () => {
    const nietActief = [
      'cola',
      'cola-zero',
      'fanta',
      'sprite',
      'koolzuur',
      'rectangular-bakjes',
      'theedoeken',
      'mayo-flessen',
      'mosterd-flessen',
      'latiz',
      'lavazza-bekers',
      'lavazza-cupjes',
    ]

    for (const productId of nietActief) {
      // Geen norm, geen nul: een leeg vak op de lijst betekent "voert dit niet".
      expect(norm('kiosk-419', productId), productId).toBeUndefined()
    }
  })
})

describe('satellieten', () => {
  it('voert geen drank, want er staat geen koeling', () => {
    // Hier stond elk drankproduct op 1 als assortimentsindicatie. Dat leverde
    // een teller regels op die hij niet kon tellen en het magazijn tekorten van
    // één; alleen een grote koeling telt drank.
    for (const productId of ['chaudfontaine-blauw', 'fuze-tea', 'bacardi-cola', 'redbull']) {
      expect(norm('kiosk-402', productId), productId).toBeUndefined()
    }
  })

  it('geeft non-drank gewone normen', () => {
    expect(norm('kiosk-402', 'bierbeker-05')).toBe(1)
    expect(norm('kiosk-402', 'chips-blauw')).toBe(2)
    expect(norm('kiosk-402', 'tork-rol')).toBe(6)
    expect(norm('kiosk-404', 'cola')).toBe(2)
    expect(norm('kiosk-412', 'ketchup-flessen')).toBe(15)
    expect(norm('kiosk-429', 'square-bakjes')).toBe(2)
  })
})

describe('420 Bar', () => {
  it('voert geen drank meer', () => {
    // Een tappunt zonder koeling. Stond eerder op 2 per drankproduct.
    expect(norm('kiosk-420-bar', 'fuze-tea')).toBeUndefined()
    expect(norm('kiosk-420-bar', 'redbull')).toBeUndefined()
  })

  it('staat los van kiosk 420', () => {
    // 420 heeft de koeling en telt dus wél; de bar ernaast niet.
    expect(norm('kiosk-420', 'chaudfontaine-blauw')).toBe(25)
    expect(norm('kiosk-420-bar', 'chaudfontaine-blauw')).toBeUndefined()
  })

  it('houdt zijn eigen bekers, chips en Post-mix', () => {
    expect(norm('kiosk-420-bar', 'bierbeker-05')).toBe(4)
    expect(norm('kiosk-420-bar', 'chips-blauw')).toBe(10)
    expect(norm('kiosk-420-bar', 'cola-zero')).toBe(6)
  })
})

describe('406 Oud en 406 Nieuw', () => {
  it('zijn twee losse locaties met eigen normen', () => {
    // Allebei apart op de bekerlijst genoteerd: 406 Oud 1, 406 Nieuw 2.
    expect(norm('kiosk-406', 'bierbeker-05')).toBe(1)
    expect(norm('kiosk-406-nieuw', 'bierbeker-05')).toBe(2)
    expect(norm('kiosk-406', 'bierbeker-04')).toBe(2)
    expect(norm('kiosk-406-nieuw', 'bierbeker-04')).toBe(2)
  })

  it('tonen allebei een eigen opschrift', () => {
    expect(demoKiosks.find((k) => k.id === 'kiosk-406')?.label).toBe('406 Oud')
    expect(demoKiosks.find((k) => k.id === 'kiosk-406-nieuw')?.label).toBe('406 Nieuw')
  })

  it('staan naast elkaar in de looproute', () => {
    const oud = demoKiosks.find((k) => k.id === 'kiosk-406')!
    const nieuw = demoKiosks.find((k) => k.id === 'kiosk-406-nieuw')!
    const zeven = demoKiosks.find((k) => k.id === 'kiosk-407')!

    expect(oud.sortOrder).toBeLessThan(nieuw.sortOrder)
    expect(nieuw.sortOrder).toBeLessThan(zeven.sortOrder)
  })

  it('heeft alleen bij 406 Oud een koffiehoek met Lavazza', () => {
    expect(norm('kiosk-406', 'lavazza-bekers')).toBe(5)
    expect(norm('kiosk-406-nieuw', 'lavazza-bekers')).toBeUndefined()
  })
})

describe('Ziggo Platform', () => {
  it('bestaat met een eigen opschrift', () => {
    const kiosk = demoKiosks.find((k) => k.id === 'kiosk-ziggo-platform')
    expect(kiosk?.label).toBe('Ziggo Platform')
    expect(kiosk?.drinkStorageType).toBe(DrinkStorageType.SATELLITE)
  })

  it('voert geen Caprisun, ook niet nu er weer drank staat', () => {
    // Caprisun stond hier ooit als gewone voorraad. De nieuwste Ziggo-lijst
    // noemt het niet, en wat een lijst niet noemt krijgt geen norm terug.
    expect(norm('kiosk-ziggo-platform', 'caprisun')).toBeUndefined()

    // Het product bestaat nog wel; alleen deze locatie voert het niet.
    expect(demoProducts.find((p) => p.id === 'caprisun')).toBeDefined()
  })

  it('volgt voor bekers, chips en Post-mix zijn eigen lijst', () => {
    // Papier kende hier geen 0,3 en zei bij Post-mix 2/2/2/2.
    expect(norm('kiosk-ziggo-platform', 'bierbeker-05')).toBe(1)
    expect(norm('kiosk-ziggo-platform', 'bierbeker-03')).toBe(1)
    expect(norm('kiosk-ziggo-platform', 'chips-blauw')).toBe(2)
    expect(norm('kiosk-ziggo-platform', 'cola')).toBe(10)
  })

  it('houdt eigen drankvoorraad zonder grote koeling', () => {
    const kiosk = demoKiosks.find((k) => k.id === 'kiosk-ziggo-platform')
    expect(kiosk?.drinkStorageType).toBe(DrinkStorageType.SATELLITE)
    expect(kiosk?.keepsOwnDrinkStock).toBe(true)
  })

  it('is de enige locatie met dat kenmerk', () => {
    const met = demoKiosks.filter((k) => k.keepsOwnDrinkStock).map((k) => k.id)
    expect(met).toEqual(['kiosk-ziggo-platform'])
  })
})

describe('de catalogus', () => {
  it('kent de producten die de lijsten noemen', () => {
    for (const id of ['latiz', 'lavazza-bekers', 'lavazza-cupjes', 'theedoeken', 'caprisun']) {
      expect(demoProducts.find((p) => p.id === id), id).toBeDefined()
    }
  })

  it('gebruikt de namen van de bestellijst met behoud van de id', () => {
    const byId = new Map(demoProducts.map((p) => [p.id, p]))
    expect(byId.get('chaudfontaine-blauw')?.name).toBe('Water Blauw')
    expect(byId.get('bacardi-lemon')?.name).toBe('Bacardi Lime & Lemonade')
    expect(byId.get('redbull')?.name).toBe('Red Bull')
    expect(byId.get('jack-daniels')?.name).toBe('Jack Daniels Cola')
  })

  it('markeert precies de tien satellietdranken', () => {
    const gemarkeerd = demoProducts
      .filter((p) => p.suppliedFromLargeCoolerForSatellite)
      .map((p) => p.id)
      .sort()

    expect(gemarkeerd).toEqual(
      [
        'bacardi-cola',
        'bacardi-lemon',
        'chaudfontaine-blauw',
        'chaudfontaine-rood',
        'fuze-tea',
        'heineken-00',
        'jack-daniels',
        'radler',
        'redbull',
        'stelz-icetea',
      ].sort()
    )
  })

  it('telt sausflessen per fles', () => {
    const ketchup = demoProducts.find((p) => p.id === 'ketchup-flessen')
    expect(ketchup?.countUnit).toBe('fles')
  })
})

describe('de config als geheel', () => {
  it('verwijst alleen naar bestaande producten', () => {
    const productIds = new Set(demoProducts.map((p) => p.id))
    for (const config of secondRingStandards) {
      for (const productId of Object.keys(config.standards)) {
        expect(productIds.has(productId), `${config.kioskKey} → ${productId}`).toBe(true)
      }
    }
  })

  it('verwijst alleen naar bestaande kiosken', () => {
    const kioskIds = new Set(demoKiosks.map((k) => k.id))
    for (const config of secondRingStandards) {
      expect(kioskIds.has(config.kioskKey), config.kioskKey).toBe(true)
    }
  })

  it('noemt geen kiosk twee keer', () => {
    const keys = secondRingStandards.map((c) => c.kioskKey)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('laat locaties zonder aangeleverde lijst op de oude normen staan', () => {
    // 405 heeft geen echte lijst en moet dus gewoon normen houden.
    expect(authoritativeKioskKeys.has('kiosk-405')).toBe(false)
    expect(demoStandards.some((s) => s.kioskId === 'kiosk-405')).toBe(true)
  })

  it('laat de eerste ring ongemoeid', () => {
    expect(authoritativeKioskKeys.has('kiosk-110')).toBe(false)
    expect(demoStandards.some((s) => s.kioskId === 'kiosk-110')).toBe(true)
  })
})
