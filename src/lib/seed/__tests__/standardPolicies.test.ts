import { describe, it, expect } from 'vitest'
import {
  effectiveStandards,
  effectiveTarget,
  hasCooling,
  mayStock,
  FIXED_STANDARDS,
  MINIMUM_STANDARDS,
  REQUIRES_COOLING_PRODUCT_IDS,
} from '../standardPolicies'
import { KIOSKS_WITH_DRINKS_FRIDGE, assortmentForKiosk } from '../assortment'
import { demoKiosks, demoStandards } from '../demoData'
import { demoProducts } from '../catalogue'
import { paperStandardsFor, secondRingStandards } from '../secondRingStandards'
import { DrinkStorageType, InputStep, FractionStrategy } from '@/types'
import { fractionStrategyFor } from '@/lib/counting/fractionStrategy'
import { calculateRestockQuantity } from '@/domain/counting/calculateRestock'

/**
 * De afspraken die boven de bronlijsten uit gaan.
 *
 * Deze tests kijken bewust naar de uitkomst in `demoStandards` en niet alleen
 * naar de functies: een regel die klopt maar nergens wordt toegepast levert
 * precies dezelfde groene tests op als een regel die werkt.
 */

/** De norm zoals hij in de stamdata terechtkomt, in hele verpakkingen. */
function norm(kioskKey: string, productId: string): number | undefined {
  const standard = demoStandards.find((s) => s.kioskId === kioskKey && s.productId === productId)
  return standard ? standard.targetQuantityQuarters / 4 : undefined
}

const GROTE_KOELING = { number: 401, drinkStorageType: DrinkStorageType.LARGE_COOLER }
const SATELLIET = { number: 402, drinkStorageType: DrinkStorageType.SATELLITE }

describe('hasCooling', () => {
  it('kijkt naar het opgegeven opslagtype van de tweede ring', () => {
    expect(hasCooling(GROTE_KOELING)).toBe(true)
    expect(hasCooling(SATELLIET)).toBe(false)
    expect(hasCooling({ number: 4201, drinkStorageType: DrinkStorageType.SMALL_BAR })).toBe(false)
    expect(hasCooling({ number: 422, drinkStorageType: DrinkStorageType.NONE })).toBe(false)
  })

  it('kent ook de koelingen van de eerste ring', () => {
    // Daar is nog geen opslagtype opgegeven — alles staat op NONE — en zit de
    // kennis in het assortimentsmodel. Alleen naar het opslagtype kijken zou de
    // acht gekoelde eerste-ringkiosken hun koffie afnemen.
    expect(hasCooling({ number: 116, drinkStorageType: DrinkStorageType.NONE })).toBe(true)
    expect(hasCooling({ number: 101, drinkStorageType: DrinkStorageType.NONE })).toBe(false)
  })

  it('spreekt zichzelf niet tegen over de tweede ring', () => {
    // De twee bronnen noemen daar dezelfde negen locaties.
    const uitConfig = secondRingStandards
      .filter((c) => c.drinkStorageType === DrinkStorageType.LARGE_COOLER)
      .map((c) => demoKiosks.find((k) => k.id === c.kioskKey)!.number)
      .sort((a, b) => a - b)

    const uitModel = [...KIOSKS_WITH_DRINKS_FRIDGE].filter((n) => n >= 400).sort((a, b) => a - b)

    expect(uitConfig).toEqual(uitModel)
  })

  it('rekent Ziggo Platform niet als koeling', () => {
    // Daar staat juist géén koelkast; de uitzondering ging over een eigen
    // stocklijst, niet over koeling.
    const ziggo = demoKiosks.find((k) => k.id === 'kiosk-ziggo-platform')!
    expect(hasCooling(ziggo)).toBe(false)
  })
})

describe('koffie hoort in de koeling', () => {
  it('noemt alleen koffie', () => {
    // De rest van de koffiehoek is bewust niet meegenomen; daar is niets over
    // gezegd en zelf bedenken wat nog meer koeling nodig heeft is gokken.
    expect([...REQUIRES_COOLING_PRODUCT_IDS]).toEqual(['koffie'])
  })

  it('laat koffie toe bij een koeling en nergens anders', () => {
    expect(mayStock(GROTE_KOELING, 'koffie')).toBe(true)
    expect(mayStock(SATELLIET, 'koffie')).toBe(false)
    // Al het andere mag overal.
    expect(mayStock(SATELLIET, 'koffiebekers')).toBe(true)
    expect(mayStock(SATELLIET, 'melk')).toBe(true)
  })

  it('staat na toepassing alleen nog bij telpunten met een koeling', () => {
    const metKoffie = demoStandards
      .filter((s) => s.productId === 'koffie')
      .map((s) => demoKiosks.find((k) => k.id === s.kioskId)!)

    expect(metKoffie.length).toBeGreaterThan(0)
    for (const kiosk of metKoffie) {
      expect(hasCooling(kiosk), kiosk.label ?? String(kiosk.number)).toBe(true)
    }
  })

  it('haalt hem weg waar de oude lijst hem wel noemde', () => {
    // 402, 417 en 429 hadden koffie 2 van papier; 105 krijgt er een uit het
    // richtaantal. Geen van vieren heeft een koeling.
    for (const kioskKey of ['kiosk-402', 'kiosk-417', 'kiosk-429']) {
      expect(paperStandardsFor(kioskKey).koffie, kioskKey).toBe(2)
      expect(norm(kioskKey, 'koffie'), kioskKey).toBeUndefined()
    }
    expect(assortmentForKiosk(105).some((i) => i.productId === 'koffie')).toBe(true)
    expect(norm('kiosk-105', 'koffie')).toBeUndefined()
  })

  it('houdt hem waar er wél een koeling staat, in beide ringen', () => {
    expect(norm('kiosk-401', 'koffie')).toBe(2)
    expect(norm('kiosk-426', 'koffie')).toBe(2)
    expect(norm('kiosk-116', 'koffie')).toBe(1)
    expect(norm('kiosk-128', 'koffie')).toBe(1)
  })

  it('laat de rest van de koffiehoek staan', () => {
    // Een kiosk zonder koeling verliest zijn koffie en niet zijn koffiehoek.
    for (const productId of ['cacao-zak', 'melk', 'suiker', 'roerstaafjes', 'koffiebekers']) {
      expect(norm('kiosk-402', productId), productId).toBeDefined()
    }
  })

  it('staat als gekoeld in de catalogus', () => {
    expect(demoProducts.find((p) => p.id === 'koffie')?.refrigerated).toBe(true)
  })
})

describe('opschuimmelk: overal één doosje', () => {
  it('legt de vaste norm vast', () => {
    expect(FIXED_STANDARDS.opschuimmelk).toBe(1)
  })

  it('zet elke bron op één', () => {
    const waarden = new Set(
      demoStandards
        .filter((s) => s.productId === 'opschuimmelk')
        .map((s) => s.targetQuantityQuarters / 4)
    )

    expect([...waarden]).toEqual([1])
  })

  it('verlaagt dus ook, waar een bron er twee zei', () => {
    // Anders dan een ondergrens: dit is een vaste waarde en gaat allebei de
    // kanten op.
    expect(paperStandardsFor('kiosk-402').opschuimmelk).toBe(2)
    expect(norm('kiosk-402', 'opschuimmelk')).toBe(1)
    expect(norm('kiosk-105', 'opschuimmelk')).toBe(1)
  })

  it('geeft geen doosje aan wie er geen had', () => {
    // 422 voert het niet; een vaste norm hoort dat niet om te draaien.
    expect(paperStandardsFor('kiosk-422').opschuimmelk).toBeUndefined()
    expect(norm('kiosk-422', 'opschuimmelk')).toBeUndefined()
  })

  it('is per half doosje te tellen', () => {
    const product = demoProducts.find((p) => p.id === 'opschuimmelk')
    expect(product?.inputStep).toBe(InputStep.HALF)
    expect(product?.allowPartialPackage).toBe(true)
    expect(product?.countUnit).toBe('doosje')
  })

  it('vult pas bij onder een half doosje', () => {
    expect(fractionStrategyFor('Opschuimmelk')).toBe(FractionStrategy.HALF_COUNTS_FULL)

    const bij = (counted: number) =>
      calculateRestockQuantity({
        targetQuantity: 1,
        countedQuantity: counted,
        fractionStrategy: fractionStrategyFor('Opschuimmelk'),
      }).restockQuantity

    // Leeg → een nieuw doosje.
    expect(bij(0)).toBe(1)
    // Een half doosje gaat gewoon door.
    expect(bij(0.5)).toBe(0)
    expect(bij(1)).toBe(0)
  })

  it('zou onder de algemene regel elke ronde een doosje brengen', () => {
    // De reden dat hier een eigen strategie voor nodig was: de 80%-drempel
    // vergelijkt hele verpakkingen met de norm, en bij norm 1 is dat er nul.
    const standaard = calculateRestockQuantity({
      targetQuantity: 1,
      countedQuantity: 0.5,
      fractionStrategy: FractionStrategy.STANDARD,
    })

    expect(standaard.restockQuantity).toBe(1)
  })
})

describe('vuilniszakken: overal minstens drie', () => {
  it('legt de ondergrens vast', () => {
    expect(MINIMUM_STANDARDS.vuilniszakken).toBe(3)
  })

  it('geldt in allebei de ringen', () => {
    const onderDrie = demoStandards
      .filter((s) => s.productId === 'vuilniszakken')
      .filter((s) => s.targetQuantityQuarters / 4 < 3)

    expect(onderDrie).toEqual([])
    expect(norm('kiosk-402', 'vuilniszakken')).toBe(3)
    expect(norm('kiosk-105', 'vuilniszakken')).toBe(3)
  })

  it('verhoogt alleen en verlaagt nooit', () => {
    expect(effectiveTarget('vuilniszakken', 1)).toBe(3)
    expect(effectiveTarget('vuilniszakken', 3)).toBe(3)
    expect(effectiveTarget('vuilniszakken', 5)).toBe(5)
  })

  it('laat de bronnen zeggen wat ze zeiden', () => {
    // Het papier blijft één rol; de afspraak staat er los bovenop.
    expect(paperStandardsFor('kiosk-402').vuilniszakken).toBe(1)
  })
})

describe('effectiveStandards', () => {
  it('voegt nooit een product toe', () => {
    const uit = effectiveStandards(SATELLIET, [{ productId: 'tork-rol', target: 6 }])
    expect(uit).toEqual([{ productId: 'tork-rol', target: 6 }])
  })

  it('laat een product dat op 0 is gezet weg in plaats van het op te hogen', () => {
    // Een lijst die 0 zegt heeft besloten het niet te voeren. Dat product komt
    // hier niet eens langs — het is er al uit — en een ondergrens hoort het niet
    // terug te halen.
    const zonder = effectiveStandards(SATELLIET, [])
    expect(zonder).toEqual([])
  })

  it('laat producten zonder afspraak met rust', () => {
    expect(effectiveTarget('chips-blauw', 6)).toBe(6)
    expect(effectiveTarget('bierbeker-05', 1)).toBe(1)
  })
})
