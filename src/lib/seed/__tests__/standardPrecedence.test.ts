import { describe, it, expect } from 'vitest'
import {
  applyStandardOverrides,
  secondRingStandards,
  unconfirmedStandards,
  paperDrinksFor,
  paperStandardsFor,
  latestOverridesFor,
  countsChilledDrinks,
  LOCAL_DRINK_STOCK_KIOSK_KEYS,
  PAPER_DRINK_PRODUCT_IDS,
  CUP_PRODUCT_IDS,
  CHIP_PRODUCT_IDS,
  DISPOSABLE_PRODUCT_IDS,
  POSTMIX_PACKAGE_PRODUCT_IDS,
  POSTMIX_COUNTING_RULE,
} from '../secondRingStandards'
import { productStorageNoteSeeds, categoryStorageNoteSeeds } from '../storageNoteSeeds'
import { demoKiosks, demoStandards } from '../demoData'
import { demoProducts, CAT_POSTMIX_ID, CAT_DRANK_ID } from '../catalogue'
import { InputStep, DrinkStorageType } from '@/types'

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

function chipsOf(kioskKey: string): Array<number | undefined> {
  return CHIP_PRODUCT_IDS.map((productId) => norm(kioskKey, productId))
}

function postmixOf(kioskKey: string): Array<number | undefined> {
  return POSTMIX_PACKAGE_PRODUCT_IDS.map((productId) => norm(kioskKey, productId))
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
    expect(norm('kiosk-419', 'jack-daniels')).toBe(8)
  })

  it('laat de nieuwste lijst winnen van een oudere handmatige waarde', () => {
    // 419 Jack Daniels stond op de vorige handmatige lijst op 6. De nieuwste
    // zegt 8, en dat is geen halvering of typefout maar de bron van nu.
    expect(norm('kiosk-419', 'jack-daniels')).toBe(8)
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
    // De handmatige lijsten noemen voor 412 de bekers, de chips en de
    // disposables. De koffiehoek en de sauzen van diezelfde kiosk komen van
    // papier en blijven staan.
    expect(norm('kiosk-412', 'ketchup-flessen')).toBe(15)
    expect(norm('kiosk-412', 'koffiebekers')).toBe(8)
    expect(norm('kiosk-412', 'mayo-flessen')).toBe(15)
  })

  it('raakt producten buiten de handmatige lijsten niet aan', () => {
    // 419 staat op vier lijsten — drank, bekers, chips en disposables — maar
    // voert geen Post-mix, en de sauzen komen onveranderd van papier.
    expect(norm('kiosk-419', 'mayo-emmers')).toBe(5)
    expect(norm('kiosk-419', 'ketchup-flessen')).toBe(15)
    expect(norm('kiosk-419', 'cola')).toBeUndefined()
  })
})

describe('definitieve drankmatrix', () => {
  const MATRIX: Record<string, number[]> = {
    'kiosk-401': [25, 6, 25, 12, 8, 30, 10, 6, 8, 30],
    'kiosk-403': [25, 6, 15, 10, 8, 20, 10, 6, 8, 25],
    'kiosk-407': [20, 6, 21, 7, 7, 29, 10, 8, 8, 15],
    'kiosk-410': [25, 8, 21, 10, 7, 25, 10, 8, 9, 30],
    'kiosk-416': [25, 6, 20, 10, 10, 24, 10, 6, 10, 30],
    'kiosk-419': [20, 6, 20, 10, 7, 15, 10, 8, 10, 30],
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
    expect(productStorageNoteSeeds.map((seed) => seed.kioskNumber)).toEqual([401, 410, 426])
    expect(norm('kiosk-401', 'bierbeker-05')).toBe(5)
    expect(norm('kiosk-410', 'bierbeker-05')).toBe(4)
    expect(norm('kiosk-426', 'bierbeker-05')).toBe(5)
  })

  it('laat 422 zoals het was', () => {
    // 422 staat niet op de nieuwe bekerlijst; er valt dus niets over te zeggen
    // en dan verzinnen we ook niets.
    expect(cupsOf('kiosk-422')).toEqual([undefined, undefined, undefined])
  })

  it('geeft Ziggo Platform alle drie de formaten uit zijn eigen lijst', () => {
    // Papier kende hier alleen 0,5 en 0,4. De specifieke Ziggo-lijst zegt
    // "1x heineken small / medium / large", dus alle drie op één doos.
    expect(cupsOf('kiosk-ziggo-platform')).toEqual([1, 1, 1])
    expect(paperStandardsFor('kiosk-ziggo-platform')['bierbeker-03']).toBeUndefined()
  })
})

describe('definitieve chipsmatrix', () => {
  // Volgorde: Blauw / Rood / Oranje.
  const MATRIX: Record<string, number[]> = {
    'kiosk-401': [6, 6, 6],
    'kiosk-402': [2, 2, 2],
    'kiosk-403': [8, 8, 6],
    'kiosk-404': [4, 4, 4],
    'kiosk-406': [5, 4, 4],
    'kiosk-406-nieuw': [5, 4, 4],
    'kiosk-407': [5, 4, 4],
    'kiosk-409': [2, 2, 2],
    'kiosk-410': [8, 6, 6],
    'kiosk-412': [3, 3, 3],
    'kiosk-414': [3, 3, 3],
    'kiosk-416': [7, 6, 6],
    'kiosk-417': [5, 4, 4],
    'kiosk-419': [7, 5, 5],
    'kiosk-420': [6, 6, 6],
    'kiosk-420-bar': [10, 10, 10],
    'kiosk-423': [8, 6, 6],
    'kiosk-424': [2, 2, 2],
    'kiosk-426': [6, 6, 6],
    'kiosk-427': [3, 3, 3],
    'kiosk-429': [3, 3, 3],
  }

  it.each(Object.entries(MATRIX))('%s', (kioskKey, verwacht) => {
    expect(chipsOf(kioskKey)).toEqual(verwacht)
  })

  it('noemt de eenentwintig locaties van de lijst en niet meer', () => {
    expect(Object.keys(MATRIX)).toHaveLength(21)
  })

  it('houdt 402 en 403 uit elkaar', () => {
    // Op de bron stonden deze twee blokken allebei onder het opschrift "402";
    // nagevraagd en bevestigd dat het tweede 403 is. Ze mogen dus nooit
    // dezelfde aantallen krijgen.
    expect(chipsOf('kiosk-402')).toEqual([2, 2, 2])
    expect(chipsOf('kiosk-403')).toEqual([8, 8, 6])
  })

  it('laat de papieren chipsnorm van 403 onder de handmatige staan', () => {
    // Het papier zei 6/5/5 en blijft de basis voor als de handmatige waarde
    // ooit vervalt.
    const papier = paperStandardsFor('kiosk-403')
    expect([papier['chips-blauw'], papier['chips-rood'], papier['chips-oranje']]).toEqual([6, 5, 5])
  })

  it('laat 422 en Ziggo Platform zoals ze waren', () => {
    expect(chipsOf('kiosk-422')).toEqual([undefined, undefined, undefined])
    expect(chipsOf('kiosk-ziggo-platform')).toEqual([2, 2, 2])
  })
})

describe('definitieve Post-mixmatrix', () => {
  // Volgorde: Cola / Cola Zero / Fanta / Sprite / Fuze Tea Peach Hibiscus.
  // De aantallen zijn reservepakken buiten het rek; het aangesloten pak telt
  // niet mee.
  const MATRIX: Record<string, Array<number | undefined>> = {
    'kiosk-401': [4, 8, 4, 4, undefined],
    'kiosk-404': [2, 4, 2, 2, undefined],
    'kiosk-406': [2, 4, 2, 2, undefined],
    'kiosk-407': [1, 2, undefined, 2, 2],
    'kiosk-410': [4, 8, 4, 4, undefined],
    'kiosk-416': [2, 6, 3, 3, undefined],
    'kiosk-420': [4, 8, 4, 4, undefined],
    'kiosk-420-bar': [4, 6, 3, 3, undefined],
    'kiosk-426': [4, 8, 4, 4, undefined],
  }

  it.each(Object.entries(MATRIX))('%s', (kioskKey, verwacht) => {
    expect(postmixOf(kioskKey)).toEqual(verwacht)
  })

  it('zet 407 Fanta uit in plaats van op nul', () => {
    // De nieuwe lijst somt de reservepakken van 407 volledig op en noemt Fanta
    // niet. Een norm van nul zou het pak bij het tellen laten staan met een
    // streefwaarde van niets, en dus altijd "vol" heten.
    expect(norm('kiosk-407', 'fanta')).toBeUndefined()
    expect(demoStandards.some((s) => s.kioskId === 'kiosk-407' && s.productId === 'fanta')).toBe(
      false
    )
  })

  it('houdt de koolzuurcilinders overal staan', () => {
    // Koolzuur staat niet op de pakkenlijst en mag daar dus ook niet door
    // verdwijnen.
    for (const kioskKey of Object.keys(MATRIX)) {
      expect(norm(kioskKey, 'koolzuur'), kioskKey).toBe(2)
    }
  })

  it('behandelt 420 Hok als de voorraad van kiosk 420', () => {
    // "420 Hok" van de bron is de voorraadruimte van 420 en geen eigen telpunt;
    // er bestaat in de stamdata ook geen locatie met die naam.
    expect(demoKiosks.some((k) => k.label === '420 Hok')).toBe(false)
    expect(postmixOf('kiosk-420')).toEqual([4, 8, 4, 4, undefined])

    // 420 Bar is wél een eigen telpunt, met eigen aantallen.
    expect(postmixOf('kiosk-420-bar')).toEqual([4, 6, 3, 3, undefined])
  })

  it('vertelt bij 420 dat de pakken in het hok staan', () => {
    // Zonder die regel zoekt een teller bij 420 naar acht pakken Cola Zero die
    // niet in de kiosk zelf staan, en telt er dus te weinig.
    expect(
      categoryStorageNoteSeeds.find(
        (seed) => seed.kioskNumber === 420 && seed.categoryName === 'Post-mix'
      )?.note
    ).toBe('In het hok links van de kiosk')
  })

  it('laat kiosken buiten de lijst hun bestaande Post-mix houden', () => {
    // 419 voerde geen Post-mix en krijgt hem er niet bij.
    expect(postmixOf('kiosk-419')).toEqual([undefined, undefined, undefined, undefined, undefined])
  })

  it('volgt bij Ziggo Platform de nieuwste eigen lijst', () => {
    // Papier zei 2/2/2/2; de specifieke Ziggo-lijst zegt 10/10/6/6.
    expect(postmixOf('kiosk-ziggo-platform')).toEqual([10, 10, 6, 6, undefined])

    const papier = paperStandardsFor('kiosk-ziggo-platform')
    expect([papier.cola, papier['cola-zero'], papier.fanta, papier.sprite]).toEqual([2, 2, 2, 2])
  })

  it('telt Post-mix in hele pakken', () => {
    // De 25%-regel gaat over het aangesloten pak en de telprocedure, niet over
    // wat er in de app ingevoerd kan worden.
    for (const productId of POSTMIX_PACKAGE_PRODUCT_IDS) {
      const product = demoProducts.find((p) => p.id === productId)
      expect(product?.inputStep, productId).toBe(InputStep.ONE)
      expect(product?.allowPartialPackage, productId).toBe(false)
    }
  })

  it('legt de telprocedure vast bij de stamdata', () => {
    expect(POSTMIX_COUNTING_RULE.countsReservePackagesOnly).toBe(true)
    expect(POSTMIX_COUNTING_RULE.connectedPackageEmptyBelowPct).toBe(25)
    expect(POSTMIX_COUNTING_RULE.refillOrder).toBe('FIFO')
  })
})

describe('Fuze Tea Peach Hibiscus', () => {
  const product = demoProducts.find((p) => p.id === 'fuze-tea-peach-hibiscus')

  it('bestaat als eigen Post-mixproduct', () => {
    expect(product).toBeDefined()
    expect(product?.categoryId).toBe(CAT_POSTMIX_ID)
    expect(product?.name).toBe('Fuze Tea Peach Hibiscus')
    expect(product?.countUnit).toBe('pak')
    expect(product?.packagingUnit).toBe('pakken')
    expect(product?.refrigerated).toBe(false)
  })

  it('is niet hetzelfde product als de gekoelde Fuze Tea', () => {
    const gekoeld = demoProducts.find((p) => p.id === 'fuze-tea')
    expect(gekoeld?.categoryId).not.toBe(product?.categoryId)
    expect(gekoeld?.refrigerated).toBe(true)
    // De koppeling met productie loopt via de naam; die twee mogen dus nooit
    // gelijk worden.
    expect(gekoeld?.name).not.toBe(product?.name)
  })

  it('valt niet onder de satelliet-drankuitzondering', () => {
    expect(product?.suppliedFromLargeCoolerForSatellite).toBe(false)
  })

  it('staat alleen bij 407', () => {
    const metNorm = demoStandards
      .filter((s) => s.productId === 'fuze-tea-peach-hibiscus')
      .map((s) => s.kioskId)

    expect(metNorm).toEqual(['kiosk-407'])
    expect(norm('kiosk-407', 'fuze-tea-peach-hibiscus')).toBe(2)
  })
})

describe('alleen een grote koeling telt drank', () => {
  const drankProductIds = new Set(
    demoProducts.filter((p) => p.categoryId === CAT_DRANK_ID).map((p) => p.id)
  )

  it('kent tien gekoelde dranken plus witte wijn en Caprisun', () => {
    expect(drankProductIds.size).toBe(12)
  })

  it.each(
    secondRingStandards
      .filter(
        (config) =>
          config.drinkStorageType !== DrinkStorageType.LARGE_COOLER &&
          !LOCAL_DRINK_STOCK_KIOSK_KEYS.has(config.kioskKey)
      )
      .map((config) => [config.kioskKey, config.drinkStorageType] as const)
  )('%s (%s) voert geen enkel drankproduct', (kioskKey) => {
    // Een norm hoort te zeggen hoeveel er moet liggen. Zonder koeling ligt er
    // niets, dus is er geen norm — geen 1 als "het staat in het assortiment".
    const drank = demoStandards
      .filter((s) => s.kioskId === kioskKey && drankProductIds.has(s.productId))
      .map((s) => s.productId)

    expect(drank).toEqual([])
  })

  it('kent precies één uitzondering, en die staat als zodanig vastgelegd', () => {
    // De uitzondering hoort uit de lijst te komen en niet uit de data: een
    // locatie die stilletjes dranknormen krijgt zonder in deze set te staan is
    // een fout, geen nieuwe regel.
    expect([...LOCAL_DRINK_STOCK_KIOSK_KEYS]).toEqual(['kiosk-ziggo-platform'])

    const metDrank = secondRingStandards
      .filter((config) => config.drinkStorageType !== DrinkStorageType.LARGE_COOLER)
      .filter((config) =>
        demoStandards.some(
          (s) => s.kioskId === config.kioskKey && drankProductIds.has(s.productId)
        )
      )
      .map((config) => config.kioskKey)

    expect(metDrank).toEqual([...LOCAL_DRINK_STOCK_KIOSK_KEYS])
  })

  it('laat 402 helemaal geen drank meer zien', () => {
    for (const productId of PRODUCT_VOLGORDE) {
      expect(norm('kiosk-402', productId), productId).toBeUndefined()
    }
  })

  it('laat 420 Bar helemaal geen drank meer zien', () => {
    // Stonden hier eerder op 2.
    for (const productId of ['chaudfontaine-blauw', 'fuze-tea', 'bacardi-cola']) {
      expect(norm('kiosk-420-bar', productId), productId).toBeUndefined()
    }
  })

  it('laat Ziggo Platform wél drank zien, want daar is een eigen lijst voor', () => {
    // De uitzondering. Dit zijn echte aantallen uit een aangeleverde
    // stocklijst, geen assortimentsindicatie van 1 zoals de twaalf satellieten
    // die hadden.
    expect(norm('kiosk-ziggo-platform', 'chaudfontaine-blauw')).toBe(1)
    expect(norm('kiosk-ziggo-platform', 'fuze-tea')).toBe(2)

    // Caprisun staat niet op die lijst en krijgt dus geen norm terug.
    expect(norm('kiosk-ziggo-platform', 'caprisun')).toBeUndefined()
  })

  it('houdt de uitzondering bij Ziggo en trekt hem niet naar de buren', () => {
    // Zonder deze grens zou de nieuwe uitzondering de eerdere correctie stil
    // terugdraaien bij twaalf locaties.
    expect(norm('kiosk-402', 'fuze-tea')).toBeUndefined()
    expect(norm('kiosk-404', 'chaudfontaine-blauw')).toBeUndefined()
    expect(norm('kiosk-420-bar', 'redbull')).toBeUndefined()

    expect(norm('kiosk-ziggo-platform', 'fuze-tea')).toBe(2)
    expect(norm('kiosk-ziggo-platform', 'redbull')).toBe(1)
  })

  it('lost de uitzondering niet op met een verzonnen opslagtype', () => {
    // Er staat bij Ziggo geen grote koeling. Dat opslagtype stuurt ook de
    // indeling van de drankronde; hem laten liegen zou dáár weer misgaan.
    const config = secondRingStandards.find((c) => c.kioskKey === 'kiosk-ziggo-platform')
    expect(config?.drinkStorageType).toBe(DrinkStorageType.SATELLITE)
    expect(config?.keepsOwnDrinkStock).toBe(true)

    expect(countsChilledDrinks(DrinkStorageType.SATELLITE)).toBe(false)
    expect(
      countsChilledDrinks(DrinkStorageType.SATELLITE, { hasExplicitLocalStock: true })
    ).toBe(true)
  })

  it('houdt de negen grote koelingen ongewijzigd', () => {
    // De drankmatrix hierboven dekt alle negentig waarden; dit is de steekproef
    // uit de opdracht, zodat een regressie hier meteen zichtbaar is.
    expect(norm('kiosk-401', 'chaudfontaine-blauw')).toBe(25)
    expect(norm('kiosk-403', 'fuze-tea')).toBe(15)
    expect(norm('kiosk-407', 'stelz-icetea')).toBe(29)
    expect(norm('kiosk-410', 'bacardi-cola')).toBe(30)
    expect(norm('kiosk-416', 'redbull')).toBe(10)
    expect(norm('kiosk-419', 'jack-daniels')).toBe(8)
    expect(norm('kiosk-420', 'fuze-tea')).toBe(25)
    expect(norm('kiosk-423', 'radler')).toBe(8)
    expect(norm('kiosk-426', 'chaudfontaine-blauw')).toBe(25)
  })

  it('legt de regel vast als functie en niet als losse lijst', () => {
    expect(countsChilledDrinks(DrinkStorageType.LARGE_COOLER)).toBe(true)
    expect(countsChilledDrinks(DrinkStorageType.SATELLITE)).toBe(false)
    expect(countsChilledDrinks(DrinkStorageType.SMALL_BAR)).toBe(false)
    expect(countsChilledDrinks(DrinkStorageType.NONE)).toBe(false)
  })
})

describe('een kiosk zonder drank raakt niet leeg', () => {
  it('laat 402 zijn overige voorraad houden', () => {
    expect(norm('kiosk-402', 'bierbeker-05')).toBe(1)
    expect(norm('kiosk-402', 'chips-blauw')).toBe(2)
    expect(norm('kiosk-402', 'tork-rol')).toBe(6)
    // Papier zei één rol; de ondergrens maakt er drie van.
    expect(norm('kiosk-402', 'vuilniszakken')).toBe(3)
    // De rest van de koffiehoek blijft; alleen koffie zelf is weg, want die
    // hoort gekoeld en hier staat geen koeling.
    expect(norm('kiosk-402', 'koffiebekers')).toBe(8)
    expect(norm('kiosk-402', 'thee-earl-grey')).toBe(2)
    expect(norm('kiosk-402', 'koffie')).toBeUndefined()
  })

  it('laat 404 zijn Post-mix houden', () => {
    // "Geen drank" gaat over de categorie Drank; de BIB-pakken achter de tap
    // staan er gewoon.
    expect(norm('kiosk-404', 'cola')).toBe(2)
    expect(norm('kiosk-404', 'cola-zero')).toBe(4)
    expect(norm('kiosk-404', 'koolzuur')).toBe(2)
  })

  it('laat 406 Oud zijn hele lijst houden', () => {
    expect(norm('kiosk-406', 'chips-blauw')).toBe(5)
    expect(norm('kiosk-406', 'bierbeker-05')).toBe(1)
    expect(norm('kiosk-406', 'cola-zero')).toBe(4)
    expect(norm('kiosk-406', 'lavazza-bekers')).toBe(5)
    expect(norm('kiosk-406', 'tork-rol')).toBe(6)
  })

  it('laat 420 Bar zijn overige voorraad houden', () => {
    expect(norm('kiosk-420-bar', 'bierbeker-05')).toBe(4)
    expect(norm('kiosk-420-bar', 'chips-blauw')).toBe(10)
    expect(norm('kiosk-420-bar', 'cola')).toBe(4)
    expect(norm('kiosk-420-bar', 'koolzuur')).toBe(2)
    // De Disposable-lijst zet de biertrays hier van 3 naar 4.
    expect(norm('kiosk-420-bar', 'sixpacks')).toBe(4)
  })

  it('laat Ziggo Platform zijn overige voorraad houden', () => {
    expect(norm('kiosk-ziggo-platform', 'bierbeker-05')).toBe(1)
    expect(norm('kiosk-ziggo-platform', 'chips-blauw')).toBe(2)
    expect(norm('kiosk-ziggo-platform', 'cola')).toBe(10)
    // Niet op de nieuwe Ziggo-lijst, dus onveranderd van papier.
    expect(norm('kiosk-ziggo-platform', 'tork-rol')).toBe(6)
  })
})

describe('de tweede-ringroute rond 420', () => {
  it('loopt 420, Ziggo Platform, 420 Bar, 422', () => {
    // Op id en niet op opschrift: een label is zo veranderd, de volgorde in de
    // route bepaalt waar iemand fysiek naartoe loopt.
    const volgorde = demoKiosks.map((k) => k.id)
    const index = (id: string) => volgorde.indexOf(id)

    expect(index('kiosk-420')).toBeGreaterThanOrEqual(0)
    expect(index('kiosk-420')).toBeLessThan(index('kiosk-ziggo-platform'))
    expect(index('kiosk-ziggo-platform')).toBeLessThan(index('kiosk-420-bar'))
    // 421 bestaat niet; na 420 Bar volgt 422.
    expect(index('kiosk-420-bar')).toBeLessThan(index('kiosk-422'))
  })

  it('zet Ziggo Platform niet meer achteraan', () => {
    const ziggo = demoKiosks.find((k) => k.id === 'kiosk-ziggo-platform')!
    const laatste = demoKiosks[demoKiosks.length - 1]!

    expect(ziggo.sortOrder).toBeLessThan(laatste.sortOrder)
  })
})

describe('non-drank blijft van papier', () => {
  it('houdt de papieren normen van een satelliet', () => {
    expect(norm('kiosk-402', 'tork-rol')).toBe(6)
    expect(norm('kiosk-402', 'koffiebekers')).toBe(8)
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

  it('raakt alleen de producten van de aangeleverde lijsten aan', () => {
    // Drank, bekers, chips, de Post-mixpakken, de zeven disposables, GFT en de
    // vuilniszakken van de Ziggo-lijst — en verder niets. Koolzuur, de
    // koffiehoek, Tork en de sauzen komen van papier en horen hier dus niet
    // tussen te staan.
    const handmatigeProducten = new Set<string>([
      ...PRODUCT_VOLGORDE,
      ...CUP_PRODUCT_IDS,
      ...CHIP_PRODUCT_IDS,
      ...POSTMIX_PACKAGE_PRODUCT_IDS,
      ...DISPOSABLE_PRODUCT_IDS,
      'gft-bak',
      'vuilniszakken',
    ])

    for (const config of secondRingStandards) {
      const overig = Object.keys(latestOverridesFor(config.kioskKey)).filter(
        (id) => !handmatigeProducten.has(id)
      )
      expect(overig, config.kioskKey).toEqual([])
    }
  })

  it('laat koolzuur buiten elke handmatige lijst', () => {
    for (const config of secondRingStandards) {
      expect('koolzuur' in latestOverridesFor(config.kioskKey), config.kioskKey).toBe(false)
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
    // 105 heeft geen aangeleverde lijst; die valt terug op de afleiding. Stond
    // hier eerder 405, tot bleek dat die kiosk niet bestaat: sindsdien is er in
    // de tweede ring geen locatie meer zonder lijst.
    const richtaantallen = assortmentForKiosk(105)
    expect(richtaantallen.length).toBeGreaterThan(0)

    // Eén regel minder: 105 heeft geen koeling en voert dus geen koffie. De
    // afspraken uit standardPolicies gaan ook over de afgeleide normen.
    const uitStamdata = demoStandards.filter((s) => s.kioskId === 'kiosk-105')
    expect(uitStamdata).toHaveLength(richtaantallen.length - 1)
    expect(richtaantallen.some((item) => item.productId === 'koffie')).toBe(true)
    expect(uitStamdata.some((s) => s.productId === 'koffie')).toBe(false)
  })

  it('laat de eerste ring ongewijzigd', async () => {
    const { assortmentForKiosk } = await import('../assortment')
    // 110 voert sowieso geen koffie, dus hier verandert er niets aan het aantal.
    const kiosk110 = assortmentForKiosk(110)
    const uitStamdata = demoStandards.filter((s) => s.kioskId === 'kiosk-110')
    expect(uitStamdata).toHaveLength(kiosk110.length)
  })
})
