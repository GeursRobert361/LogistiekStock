import { DrinkStorageType } from '@/types'

/**
 * Wat er moet gebeuren om de database gelijk te trekken met de authoritative
 * tweede-ringstamdata.
 *
 * Puur: er gaat niets in of uit behalve gegevens. Dat is met opzet — dit is de
 * berekening die bepaalt wat er in productie verandert, en die wil je kunnen
 * testen zonder database, en identiek kunnen tonen in een dry-run en uitvoeren
 * in een transactie. Twee keer dezelfde logica los opschrijven is precies hoe
 * een dry-run gaat liegen over wat er echt gebeurt.
 */

export interface DesiredKiosk {
  kioskKey: string
  number: number
  label?: string
  drinkStorageType: DrinkStorageType
  /** Houdt dit telpunt eigen drankvoorraad ondanks zijn opslagtype? */
  keepsOwnDrinkStock: boolean
}

export interface CurrentKiosk {
  number: number
  label: string | null
  drinkStorageType: DrinkStorageType
  keepsOwnDrinkStock: boolean
}

export interface DesiredStandard {
  kioskKey: string
  productId: string
  /** Norm in kwarteenheden. */
  targetQuantityQuarters: number
}

export interface CurrentStandard {
  kioskKey: string
  productId: string
  targetQuantityQuarters: number
  isActive: boolean
}

export interface KioskChange {
  kioskKey: string
  number: number
  kind: 'nieuw' | 'gewijzigd'
  /** Leesbare beschrijving van wat er verandert. */
  details: string[]
}

export interface StandardChange {
  kioskKey: string
  productId: string
  kind: 'nieuw' | 'gewijzigd' | 'uitgeschakeld'
  from?: number
  to?: number
}

export interface SyncPlan {
  kiosks: KioskChange[]
  standards: StandardChange[]
  isEmpty: boolean
}

function compositeKey(kioskKey: string, productId: string): string {
  return `${kioskKey}:${productId}`
}

export function planKioskChanges(
  desired: DesiredKiosk[],
  current: Map<number, CurrentKiosk>
): KioskChange[] {
  const changes: KioskChange[] = []

  for (const kiosk of desired) {
    const existing = current.get(kiosk.number)
    if (!existing) {
      changes.push({
        kioskKey: kiosk.kioskKey,
        number: kiosk.number,
        kind: 'nieuw',
        details: [`wordt toegevoegd als ${kiosk.label ?? kiosk.number}`],
      })
      continue
    }

    const details: string[] = []
    if ((existing.label ?? undefined) !== kiosk.label) {
      details.push(`opschrift ${existing.label ?? '(geen)'} → ${kiosk.label ?? '(geen)'}`)
    }
    if (existing.drinkStorageType !== kiosk.drinkStorageType) {
      details.push(`drankopslag ${existing.drinkStorageType} → ${kiosk.drinkStorageType}`)
    }
    if (existing.keepsOwnDrinkStock !== kiosk.keepsOwnDrinkStock) {
      details.push(
        `eigen drankvoorraad ${existing.keepsOwnDrinkStock ? 'ja' : 'nee'} → ` +
          `${kiosk.keepsOwnDrinkStock ? 'ja' : 'nee'}`
      )
    }

    if (details.length > 0) {
      changes.push({ kioskKey: kiosk.kioskKey, number: kiosk.number, kind: 'gewijzigd', details })
    }
  }

  return changes
}

/**
 * Verouderde normen worden alleen binnen de authoritative kiosken
 * uitgeschakeld. Wat daarbuiten staat is niet van deze config, en daar blijft
 * de sync vanaf — ook als het er raar uitziet.
 */
export function planStandardChanges(
  desired: DesiredStandard[],
  current: CurrentStandard[]
): StandardChange[] {
  const desiredByKey = new Map(desired.map((s) => [compositeKey(s.kioskKey, s.productId), s]))
  const currentByKey = new Map(current.map((s) => [compositeKey(s.kioskKey, s.productId), s]))

  const changes: StandardChange[] = []

  for (const standard of desired) {
    const key = compositeKey(standard.kioskKey, standard.productId)
    const existing = currentByKey.get(key)

    if (!existing || !existing.isActive) {
      changes.push({
        kioskKey: standard.kioskKey,
        productId: standard.productId,
        kind: 'nieuw',
        to: standard.targetQuantityQuarters,
      })
      continue
    }

    if (existing.targetQuantityQuarters !== standard.targetQuantityQuarters) {
      changes.push({
        kioskKey: standard.kioskKey,
        productId: standard.productId,
        kind: 'gewijzigd',
        from: existing.targetQuantityQuarters,
        to: standard.targetQuantityQuarters,
      })
    }
  }

  for (const standard of current) {
    if (!standard.isActive) continue
    const key = compositeKey(standard.kioskKey, standard.productId)
    if (desiredByKey.has(key)) continue

    changes.push({
      kioskKey: standard.kioskKey,
      productId: standard.productId,
      kind: 'uitgeschakeld',
      from: standard.targetQuantityQuarters,
    })
  }

  return changes.sort(
    (a, b) => a.kioskKey.localeCompare(b.kioskKey) || a.productId.localeCompare(b.productId)
  )
}

export function buildSyncPlan(params: {
  desiredKiosks: DesiredKiosk[]
  currentKiosks: Map<number, CurrentKiosk>
  desiredStandards: DesiredStandard[]
  currentStandards: CurrentStandard[]
}): SyncPlan {
  const kiosks = planKioskChanges(params.desiredKiosks, params.currentKiosks)
  const standards = planStandardChanges(params.desiredStandards, params.currentStandards)

  return { kiosks, standards, isEmpty: kiosks.length === 0 && standards.length === 0 }
}

/**
 * Telpunten die géén enkele normale dranknorm horen te hebben.
 *
 * Tien keer `null` in de matrix hieronder: geen koeling, dus geen voorraad, dus
 * geen norm. Dit is een uitkomst om te controleren en niet om over te slaan —
 * het is precies het geval dat eerder mis was, met bij elke satelliet elk
 * drankproduct op norm 1.
 */
const GEEN_DRANKNORMEN: Array<number | null> = [
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
]

const ZONDER_DRANKVOORRAAD = [
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
  'kiosk-427',
  'kiosk-429',
]

/** De verwachte dranknormen na de sync, om achteraf te controleren. */
export const EXPECTED_DRINK_MATRIX: Record<string, Array<number | null>> = {
  'kiosk-401': [25, 6, 25, 12, 8, 30, 10, 6, 8, 30],
  'kiosk-403': [25, 6, 15, 10, 8, 20, 10, 6, 8, 25],
  'kiosk-407': [20, 6, 21, 7, 7, 29, 10, 8, 8, 15],
  'kiosk-410': [25, 8, 21, 10, 7, 25, 10, 8, 9, 30],
  'kiosk-416': [25, 6, 20, 10, 10, 24, 10, 6, 10, 30],
  // Jack Daniels is 8: de eerdere handmatige lijst zei 6, de nieuwste 8.
  'kiosk-419': [20, 6, 20, 10, 7, 15, 10, 8, 10, 30],
  'kiosk-420': [25, 8, 25, 15, 10, 25, 12, 8, 10, 20],
  'kiosk-423': [20, 6, 20, 15, 8, 15, 9, 6, 9, 25],
  'kiosk-426': [25, 6, 28, 15, 10, 15, 10, 8, 8, 30],

  // Geen grote koeling, maar wél een eigen stocklijst met echte aantallen. De
  // enige locatie met `keeps_own_drink_stock`; deze tien normen moeten na de
  // sync actief staan én bij een tekort in de vulplanning kunnen komen.
  'kiosk-ziggo-platform': [1, 2, 2, 1, 1, 2, 1, 1, 1, 2],

  // Alle overige tweede-ringlocaties: nul dranknormen.
  ...Object.fromEntries(ZONDER_DRANKVOORRAAD.map((key) => [key, GEEN_DRANKNORMEN])),
}

/**
 * De verwachte bekernormen na de sync, in de volgorde 0,5 / 0,4 / 0,3.
 *
 * `null` betekent: dit formaat hoort bij die locatie géén actieve norm te
 * hebben. Dat is een uitkomst om te controleren, niet om over te slaan — een
 * beker die na de sync nog actief op nul staat is precies het geval dat de
 * handmatige lijst wilde uitsluiten.
 *
 * 422 staat niet op de bekerlijst en wordt hier dus ook niet gecontroleerd.
 * Ziggo Platform stond er eerder ook niet op, maar heeft inmiddels een eigen
 * lijst die alle drie de formaten op 1 doos zet.
 */
export const EXPECTED_CUP_MATRIX: Record<string, Array<number | null>> = {
  'kiosk-401': [5, 4, 2],
  'kiosk-402': [1, 1, 1],
  'kiosk-403': [3, 3, 1],
  'kiosk-404': [2, 2, 1],
  'kiosk-406': [1, 2, 1],
  'kiosk-406-nieuw': [2, 2, 1],
  'kiosk-407': [4, 3, 2],
  'kiosk-409': [1, 1, 1],
  'kiosk-410': [4, 4, 2],
  'kiosk-412': [3, 3, null],
  'kiosk-414': [3, 3, null],
  'kiosk-416': [4, 4, 2],
  'kiosk-417': [2, 2, 1],
  'kiosk-419': [3, 3, 1],
  'kiosk-420': [null, 3, 1],
  'kiosk-420-bar': [4, 4, 2],
  'kiosk-423': [4, 4, 1],
  'kiosk-424': [2, 1, 1],
  'kiosk-426': [5, 4, 2],
  'kiosk-427': [3, 3, null],
  'kiosk-429': [3, 3, null],
  // Uit de specifieke Ziggo-lijst: "1x heineken small / medium / large".
  'kiosk-ziggo-platform': [1, 1, 1],
}

/**
 * De verwachte chipsnormen na de sync, in de volgorde Blauw / Rood / Oranje.
 *
 * 422 staat niet op de chipslijst en wordt hier dus ook niet gecontroleerd. De
 * Ziggo-waarden komen uit de specifieke Ziggo-lijst, niet uit de chipslijst.
 */
export const EXPECTED_CHIP_MATRIX: Record<string, number[]> = {
  'kiosk-401': [6, 6, 6],
  'kiosk-402': [2, 2, 2],
  // Het blok dat op de bron ten onrechte "402" heette; bevestigd als 403.
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
  'kiosk-ziggo-platform': [2, 2, 2],
}

/**
 * De verwachte Post-mixnormen na de sync: reservepakken buiten het rek.
 *
 * Volgorde Cola / Cola Zero / Fanta / Sprite / Fuze Tea Peach Hibiscus. `null`
 * betekent "hoort géén actieve norm te hebben" — dat geldt voor 407 Fanta, dat
 * op de nieuwe lijst ontbreekt terwijl die lijst 407 verder volledig opsomt, en
 * voor Fuze Tea Peach Hibiscus overal behalve bij 407.
 *
 * Koolzuur staat hier niet in en wordt hier dus ook niet gecontroleerd: dat is
 * een cilinder die op de pakkenlijst nergens voorkomt en gewoon van papier komt.
 */
export const EXPECTED_POSTMIX_MATRIX: Record<string, Array<number | null>> = {
  'kiosk-401': [4, 8, 4, 4, null],
  'kiosk-404': [2, 4, 2, 2, null],
  'kiosk-406': [2, 4, 2, 2, null],
  'kiosk-407': [1, 2, null, 2, 2],
  'kiosk-410': [4, 8, 4, 4, null],
  'kiosk-416': [2, 6, 3, 3, null],
  'kiosk-420': [4, 8, 4, 4, null],
  'kiosk-420-bar': [4, 6, 3, 3, null],
  'kiosk-426': [4, 8, 4, 4, null],
  // Uit de specifieke Ziggo-lijst; overschrijft de papieren 2/2/2/2.
  'kiosk-ziggo-platform': [10, 10, 6, 6, null],
}

/**
 * De verwachte normen van de Disposable-lijst, in de kolomvolgorde van de bron:
 * Rectangular / Square / Patat / Servetten / Biertrays / Patat vorkjes /
 * Arena blaadjes.
 *
 * `null` betekent "hoort géén actieve norm te hebben" — dat is wat een 0 op die
 * lijst wil zeggen. Juist die regels wil je hier controleren: een norm die na
 * de sync nog actief op nul staat is precies wat de 0 moest uitsluiten.
 *
 * Ziggo Biertrays staat hier op 1 en niet op 3: de specifieke Ziggo-lijst wint
 * van de algemene Disposable-lijst. 422 staat niet op de lijst en wordt hier
 * dus ook niet gecontroleerd.
 */
export const EXPECTED_DISPOSABLE_MATRIX: Record<string, Array<number | null>> = {
  'kiosk-401': [2, null, null, 5, 3, null, 1],
  'kiosk-402': [null, null, null, null, 1, null, null],
  'kiosk-403': [null, 2, 3, 5, 3, 1, null],
  'kiosk-404': [2, null, null, 5, 3, 1, 1],
  'kiosk-406': [2, null, null, 5, 3, null, 1],
  'kiosk-406-nieuw': [2, 2, null, 5, 3, null, 1],
  'kiosk-407': [null, 2, 3, 5, 3, 1, 1],
  'kiosk-409': [null, null, null, null, 1, null, null],
  'kiosk-410': [3, null, null, 5, 3, 1, 1],
  'kiosk-412': [2, 2, null, 5, 3, null, null],
  'kiosk-414': [2, 2, null, 5, 3, null, null],
  'kiosk-416': [3, null, null, 5, 3, null, 1],
  'kiosk-417': [2, null, null, 5, 3, null, 1],
  'kiosk-419': [null, 2, 2, 5, 3, 1, 1],
  'kiosk-420': [3, 3, 1, 5, 3, null, 1],
  'kiosk-420-bar': [null, null, null, null, 4, null, null],
  'kiosk-423': [null, 2, 3, 5, 3, 1, null],
  'kiosk-424': [null, null, null, null, 1, null, null],
  'kiosk-426': [2, null, null, 5, 3, null, 1],
  'kiosk-427': [2, 2, null, 5, 3, null, null],
  'kiosk-429': [2, 2, null, 5, 3, null, null],
  'kiosk-ziggo-platform': [null, null, null, null, 1, null, null],
}

/**
 * De verwachte GFT-normen: één bak bij de acht locaties die de GFT-lijst noemt,
 * en nergens anders.
 *
 * De `null`-regels staan er net zo hard in als de enen. Een GFT-bak die er niet
 * staat maar wel geteld moet worden levert elke ronde een tekort van één op dat
 * niemand kan oplossen.
 */
export const EXPECTED_GFT: Record<string, Array<number | null>> = {
  'kiosk-401': [1],
  'kiosk-403': [1],
  'kiosk-407': [1],
  'kiosk-410': [1],
  'kiosk-416': [1],
  'kiosk-419': [1],
  'kiosk-420': [1],
  'kiosk-423': [1],

  'kiosk-402': [null],
  'kiosk-404': [null],
  'kiosk-406': [null],
  'kiosk-406-nieuw': [null],
  'kiosk-409': [null],
  'kiosk-412': [null],
  'kiosk-414': [null],
  'kiosk-417': [null],
  'kiosk-420-bar': [null],
  'kiosk-422': [null],
  'kiosk-424': [null],
  'kiosk-426': [null],
  'kiosk-427': [null],
  'kiosk-429': [null],
  'kiosk-ziggo-platform': [null],
}

/**
 * Vuilniszakken: overal minstens drie rollen.
 *
 * Het papier zegt bij elke tweede-ringlocatie één rol, maar er geldt een
 * ondergrens van drie — zie `minimumStandards.ts`. Ziggo Platform had er via
 * zijn eigen stocklijst al drie en verandert dus niet.
 *
 * Alle locaties staan erin en niet een steekproef: dit is precies het soort
 * wijziging dat op één kiosk kan blijven hangen.
 */
export const EXPECTED_VUILNISZAKKEN: Record<string, Array<number | null>> = {
  'kiosk-401': [3],
  'kiosk-402': [3],
  'kiosk-403': [3],
  'kiosk-404': [3],
  'kiosk-406': [3],
  'kiosk-406-nieuw': [3],
  'kiosk-407': [3],
  'kiosk-409': [3],
  'kiosk-410': [3],
  'kiosk-412': [3],
  'kiosk-414': [3],
  'kiosk-416': [3],
  'kiosk-417': [3],
  'kiosk-419': [3],
  'kiosk-420': [3],
  'kiosk-420-bar': [3],
  'kiosk-422': [3],
  'kiosk-423': [3],
  'kiosk-424': [3],
  'kiosk-426': [3],
  'kiosk-427': [3],
  'kiosk-429': [3],
  'kiosk-ziggo-platform': [3],
}

/**
 * Opschuimmelk: overal één doosje, of helemaal niet.
 *
 * Een vaste norm en geen ondergrens — waar een lijst er twee zei wordt het er
 * één. `null` voor de locaties die het niet voeren; die krijgen er geen doosje
 * bij.
 */
export const EXPECTED_OPSCHUIMMELK: Record<string, Array<number | null>> = {
  'kiosk-401': [1],
  'kiosk-402': [1],
  'kiosk-403': [1],
  'kiosk-404': [1],
  'kiosk-406': [1],
  'kiosk-406-nieuw': [1],
  'kiosk-407': [1],
  'kiosk-409': [1],
  'kiosk-410': [1],
  'kiosk-412': [1],
  'kiosk-414': [1],
  'kiosk-416': [1],
  'kiosk-417': [1],
  'kiosk-419': [1],
  'kiosk-420': [1],
  'kiosk-423': [1],
  'kiosk-424': [1],
  'kiosk-426': [1],
  'kiosk-427': [1],
  'kiosk-429': [1],

  // Voeren het niet en krijgen het er niet bij.
  'kiosk-420-bar': [null],
  'kiosk-422': [null],
  'kiosk-ziggo-platform': [null],
}

/**
 * Koffie: alleen waar een koeling staat.
 *
 * De negen grote koelingen van de tweede ring houden hun twee pakken. Overal
 * anders hoort géén actieve norm te staan — ook waar de papieren lijst er wel
 * een noemde, want koffie bederft op een plek zonder koeling.
 *
 * Juist de `null`-regels zijn hier het punt: dit is een wijziging die normen
 * wegneemt, en die moet na de sync ook echt weg zijn.
 */
export const EXPECTED_KOFFIE: Record<string, Array<number | null>> = {
  'kiosk-401': [2],
  'kiosk-403': [2],
  'kiosk-407': [2],
  'kiosk-410': [2],
  'kiosk-416': [2],
  'kiosk-419': [2],
  'kiosk-420': [2],
  'kiosk-423': [2],
  'kiosk-426': [2],

  'kiosk-402': [null],
  'kiosk-404': [null],
  'kiosk-406': [null],
  'kiosk-406-nieuw': [null],
  'kiosk-409': [null],
  'kiosk-412': [null],
  'kiosk-414': [null],
  'kiosk-417': [null],
  'kiosk-420-bar': [null],
  'kiosk-422': [null],
  'kiosk-424': [null],
  'kiosk-427': [null],
  'kiosk-429': [null],
  'kiosk-ziggo-platform': [null],
}

/**
 * Kiosken die volgens de papieren lijst een koolzuurcilinder voeren.
 *
 * Apart gecontroleerd omdat het het makkelijkst mis kan gaan: de Post-mixlijst
 * gaat over pakken en noemt koolzuur nergens, en een sync die "de Post-mix van
 * deze kiosk" zou vervangen in plaats van alleen de genoemde producten zou hem
 * ongemerkt uitzetten.
 */
export const EXPECTED_KOOLZUUR: Record<string, number> = {
  'kiosk-401': 2,
  'kiosk-404': 2,
  'kiosk-406': 2,
  'kiosk-407': 2,
  'kiosk-410': 2,
  'kiosk-416': 2,
  'kiosk-420': 2,
  'kiosk-420-bar': 2,
  'kiosk-426': 2,
}

/** De opslagtypes die na de sync moeten gelden. */
export const EXPECTED_STORAGE_TYPES: Record<string, DrinkStorageType> = {
  'kiosk-401': DrinkStorageType.LARGE_COOLER,
  'kiosk-403': DrinkStorageType.LARGE_COOLER,
  'kiosk-407': DrinkStorageType.LARGE_COOLER,
  'kiosk-410': DrinkStorageType.LARGE_COOLER,
  'kiosk-416': DrinkStorageType.LARGE_COOLER,
  'kiosk-419': DrinkStorageType.LARGE_COOLER,
  'kiosk-420': DrinkStorageType.LARGE_COOLER,
  'kiosk-423': DrinkStorageType.LARGE_COOLER,
  'kiosk-426': DrinkStorageType.LARGE_COOLER,
  'kiosk-402': DrinkStorageType.SATELLITE,
  'kiosk-404': DrinkStorageType.SATELLITE,
  'kiosk-406': DrinkStorageType.SATELLITE,
  'kiosk-406-nieuw': DrinkStorageType.SATELLITE,
  'kiosk-409': DrinkStorageType.SATELLITE,
  'kiosk-412': DrinkStorageType.SATELLITE,
  'kiosk-414': DrinkStorageType.SATELLITE,
  'kiosk-417': DrinkStorageType.SATELLITE,
  'kiosk-424': DrinkStorageType.SATELLITE,
  'kiosk-427': DrinkStorageType.SATELLITE,
  'kiosk-429': DrinkStorageType.SATELLITE,
  'kiosk-ziggo-platform': DrinkStorageType.SATELLITE,
  'kiosk-420-bar': DrinkStorageType.SMALL_BAR,
  'kiosk-422': DrinkStorageType.NONE,
}

/**
 * Welke telpunten na de sync een eigen drankvoorraad hebben.
 *
 * Precies één, en de rest staat er nadrukkelijk met `false` bij: dit kenmerk
 * schakelt de bescherming uit die voorkomt dat satellietdrank in de centrale
 * bijvullijst belandt. Waar het per ongeluk aan staat, krijgt het magazijn werk
 * dat niemand uitvoert.
 */
export const EXPECTED_LOCAL_DRINK_STOCK: Record<string, boolean> = {
  'kiosk-ziggo-platform': true,
  'kiosk-401': false,
  'kiosk-402': false,
  'kiosk-403': false,
  'kiosk-404': false,
  'kiosk-406': false,
  'kiosk-406-nieuw': false,
  'kiosk-407': false,
  'kiosk-409': false,
  'kiosk-410': false,
  'kiosk-412': false,
  'kiosk-414': false,
  'kiosk-416': false,
  'kiosk-417': false,
  'kiosk-419': false,
  'kiosk-420': false,
  'kiosk-420-bar': false,
  'kiosk-422': false,
  'kiosk-423': false,
  'kiosk-424': false,
  'kiosk-426': false,
  'kiosk-427': false,
  'kiosk-429': false,
}
