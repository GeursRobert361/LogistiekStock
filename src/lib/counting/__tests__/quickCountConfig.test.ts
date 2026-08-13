import { describe, it, expect } from 'vitest'
import { QUICK_COUNT_CONFIG, getQuickCountConfig } from '../quickCountConfig'
import { demoProducts } from '@/lib/seed/catalogue'
import { InputStep } from '@/types'

/**
 * Welke producten snelknoppen krijgen.
 *
 * De config koppelt op productnaam, want dat is het enige wat de app in beide
 * modi werkelijk in handen heeft: in productie is `product.id` een UUID uit de
 * database en bestaan de leesbare sleutels uit `catalogue.ts` niet.
 *
 * Precies daar ging het een keer mis. De config stond op seed-id, de tests
 * voedden hem met `demoProducts`, alles was groen — en in de app verscheen
 * nooit een knop, want daar heet Koffie `3e5785de-…`. Deze tests draaien daarom
 * met producten in productievorm: alles gelijk, behalve het id.
 */

const byId = new Map(demoProducts.map((p) => [p.id, p]))
const byName = new Map(demoProducts.map((p) => [p.name, p]))

/** De naam waarmee dit product in de app terechtkomt. */
function naam(seedId: string): string {
  const product = byId.get(seedId)
  if (!product) throw new Error(`Onbekend product ${seedId}`)
  return product.name
}

/**
 * Een product zoals de productiedatabase het teruggeeft: een UUID als id.
 *
 * `products.id` is `uuid primary key default gen_random_uuid()` en `mapProduct`
 * geeft die waarde ongewijzigd door aan de browser.
 */
function asProductionProduct(seedId: string) {
  const product = byId.get(seedId)
  if (!product) throw new Error(`Onbekend product ${seedId}`)
  return { ...product, id: '3e5785de-e06a-40f7-8d93-4b1e7c7d5771' }
}

describe('de config zelf', () => {
  it('verwijst alleen naar bestaande productnamen', () => {
    // Een typefout of een hernoeming hoort hier op te vallen, niet stilletjes
    // de snelknoppen weg te nemen.
    for (const productName of Object.keys(QUICK_COUNT_CONFIG)) {
      expect(byName.has(productName), productName).toBe(true)
    }
  })

  it('vindt een product zoals productie het teruggeeft', () => {
    const koffie = asProductionProduct('koffie')

    expect(koffie.id).not.toBe('koffie')
    expect(getQuickCountConfig(koffie.name)).toEqual({ mode: 'INTEGER', max: 5 })
  })

  it('koppelt op niets wat alleen in de demo bestaat', () => {
    // Het seed-id mag nooit een treffer opleveren: dan zou de config in de demo
    // werken en in productie niet, en dat is precies het gat dat dit dichttrekt.
    for (const seedId of ['koffie', 'chips-oranje', 'vuilniszakken']) {
      expect(getQuickCountConfig(seedId), seedId).toBeUndefined()
    }
  })

  it('gaat om met een product dat nog niet geladen is', () => {
    expect(getQuickCountConfig(undefined)).toBeUndefined()
    expect(getQuickCountConfig(null)).toBeUndefined()
    expect(getQuickCountConfig('')).toBeUndefined()
  })

  it('heeft overal een bruikbaar maximum', () => {
    for (const [productName, config] of Object.entries(QUICK_COUNT_CONFIG)) {
      // Onder de drie levert een rij knoppen niets op, boven de tien wordt het
      // een zoekplaatje.
      expect(config.max, productName).toBeGreaterThanOrEqual(3)
      expect(config.max, productName).toBeLessThanOrEqual(10)
    }
  })

  it('vraagt alleen halve verpakkingen waar het product die ook kent', () => {
    // Een halve-knop bij een product dat in hele stappen geteld wordt zou een
    // waarde opleveren die de rest van de app niet verwacht.
    for (const [productName, config] of Object.entries(QUICK_COUNT_CONFIG)) {
      if (config.mode !== 'HALF') continue
      const product = byName.get(productName)!

      expect(product.inputStep, productName).toBe(InputStep.HALF)
      expect(product.allowPartialPackage, productName).toBe(true)
    }
  })
})

describe('welke producten meedoen', () => {
  it('geeft bekers en chips halve verpakkingen', () => {
    for (const id of ['bierbeker-05', 'bierbeker-04', 'bierbeker-03']) {
      expect(getQuickCountConfig(naam(id)), id).toEqual({ mode: 'HALF', max: 5 })
    }
    for (const id of ['chips-blauw', 'chips-rood', 'chips-oranje']) {
      expect(getQuickCountConfig(naam(id)), id).toEqual({ mode: 'HALF', max: 6 })
    }
  })

  it('geeft het kleine spul knoppen tot vijf', () => {
    const klein = [
      'koffie',
      'cacao-zak',
      'melk',
      'suiker',
      'roerstaafjes',
      'thee-earl-grey',
      'thee-lemon',
      'opschuimmelk',
      'latiz',
      'lavazza-cupjes',
      'lavazza-bekers',
      'rectangular-bakjes',
      'square-bakjes',
      'patat-bakjes',
      'patat-vorkjes',
      'sixpacks',
      'arena-blaadjes',
      'kassa-bonnen',
      'vuilniszakken',
      'theedoeken',
      'mayo-emmers',
      'ketchup-emmers',
    ]

    for (const id of klein) {
      expect(getQuickCountConfig(naam(id)), id).toEqual({ mode: 'INTEGER', max: 5 })
    }
    for (const id of ['servetten', 'tork-rol']) {
      expect(getQuickCountConfig(naam(id)), id).toEqual({ mode: 'INTEGER', max: 6 })
    }
    expect(getQuickCountConfig(naam('koffiebekers'))).toEqual({ mode: 'INTEGER', max: 8 })
  })

  it('telt Post-mix in hele pakken tot acht', () => {
    for (const id of ['cola', 'cola-zero', 'fanta', 'sprite', 'fuze-tea-peach-hibiscus']) {
      expect(getQuickCountConfig(naam(id)), id).toEqual({ mode: 'INTEGER', max: 8 })
    }
    // Koolzuur is een cilinder; daar staan er nooit meer dan een paar.
    expect(getQuickCountConfig(naam('koolzuur'))).toEqual({ mode: 'INTEGER', max: 3 })
  })

  it('houdt het Post-mixpak los van de gekoelde Fuze Tea', () => {
    // Twee producten, twee namen. Zou de config op iets grovers koppelen dan
    // zou de drankkast ineens acht knoppen krijgen.
    expect(getQuickCountConfig(naam('fuze-tea-peach-hibiscus'))).toBeDefined()
    expect(getQuickCountConfig(naam('fuze-tea'))).toBeUndefined()
  })

  it('laat de gekoelde dranken met rust', () => {
    // Aantallen tot dertig, met halve pakken. Een rij van dertig knoppen is
    // geen versnelling.
    const dranken = [
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

    for (const id of dranken) {
      expect(getQuickCountConfig(naam(id)), id).toBeUndefined()
    }
  })

  it('laat de sausflessen met rust', () => {
    // Normen rond de vijftien, per fles geteld: daar is typen sneller.
    for (const id of ['ketchup-flessen', 'mayo-flessen', 'mosterd-flessen']) {
      expect(getQuickCountConfig(naam(id)), id).toBeUndefined()
    }
    // De emmers wél: die staan er met een handjevol.
    expect(getQuickCountConfig(naam('mayo-emmers'))).toEqual({ mode: 'INTEGER', max: 5 })
  })

  it('geeft een onbekend product geen snelknoppen', () => {
    expect(getQuickCountConfig('Bestaat Niet')).toBeUndefined()
  })
})

describe('chips tellen per halve doos', () => {
  it('staat in de catalogus op halve stappen', () => {
    for (const id of ['chips-blauw', 'chips-rood', 'chips-oranje']) {
      const chips = byId.get(id)!
      expect(chips.inputStep, id).toBe(InputStep.HALF)
      expect(chips.allowPartialPackage, id).toBe(true)
    }
  })

  it('laat de rest van de chipsgegevens ongemoeid', () => {
    const chips = byId.get('chips-blauw')!
    expect(chips.countUnit).toBe('zak')
    expect(chips.packagingUnit).toBe('dozen')
    expect(chips.categoryId).toBe('cat-chips')
  })
})
