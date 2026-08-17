import { describe, it, expect } from 'vitest'
import { runSecondRingSync, verifySecondRing } from '../secondRingSync'
import { demoKiosks, demoStandards } from '../demoData'
import { demoProducts } from '../catalogue'
import { authoritativeKioskKeys } from '../secondRingStandards'
import { EXPECTED_DRINK_MATRIX, EXPECTED_STORAGE_TYPES } from '../syncPlan'
import type { SqlClient } from '../dbIds'

/**
 * De productiesync tegen een nepdatabase.
 *
 * Drie dingen wil je niet op hun woord geloven: dat een proefdraai werkelijk
 * niets schrijft, dat een fout halverwege alles terugdraait, en dat de controle
 * achteraf een verkeerd getal ziet. Ze gaan over een draaiende productiedatabase
 * en je merkt het pas als het al gebeurd is.
 *
 * De nepdatabase hieronder is geen Postgres — hij beantwoordt de vragen die de
 * sync stelt en houdt bij wat er geschreven wordt, inclusief begin/commit/
 * rollback. Genoeg om die drie eigenschappen vast te leggen.
 */

const kioskDbId = (number: number) => `k-${number}`
const productDbId = (seedId: string) => `p-${seedId}`

interface StandardRow {
  id: string
  kioskId: string
  productId: string
  targetQuantityQuarters: number
  isActive: boolean
  /** Gezet in Beheer; de sync hoort er vanaf te blijven. */
  manuallySetAt?: string
}

interface FakeState {
  kiosks: Map<
    number,
    { label: string | null; drinkStorageType: string; keepsOwnDrinkStock: boolean }
  >
  standards: Map<string, StandardRow>
}

function emptyState(): FakeState {
  return { kiosks: new Map(), standards: new Map() }
}

/** Een database waarin de sync al gedraaid heeft: alles staat goed. */
function syncedState(): FakeState {
  const state = emptyState()

  for (const kiosk of demoKiosks) {
    state.kiosks.set(kiosk.number, {
      label: kiosk.label ?? null,
      drinkStorageType: kiosk.drinkStorageType,
      keepsOwnDrinkStock: kiosk.keepsOwnDrinkStock,
    })
  }

  for (const standard of demoStandards) {
    if (!authoritativeKioskKeys.has(standard.kioskId)) continue
    const kiosk = demoKiosks.find((k) => k.id === standard.kioskId)
    if (!kiosk) continue

    const key = `${kioskDbId(kiosk.number)}|${productDbId(standard.productId)}`
    state.standards.set(key, {
      id: `s-${key}`,
      kioskId: kioskDbId(kiosk.number),
      productId: productDbId(standard.productId),
      targetQuantityQuarters: standard.targetQuantityQuarters,
      isActive: true,
    })
  }

  return state
}

function cloneState(state: FakeState): FakeState {
  return {
    kiosks: new Map([...state.kiosks].map(([k, v]) => [k, { ...v }])),
    standards: new Map([...state.standards].map(([k, v]) => [k, { ...v }])),
  }
}

interface FakeClient extends SqlClient {
  queries: string[]
  state: FakeState
}

/**
 * @param failOn een query die stukloopt, om een halve sync na te bootsen.
 */
function fakeClient(initial: FakeState = emptyState(), failOn?: RegExp): FakeClient {
  const queries: string[] = []
  let state = initial
  let snapshot: FakeState | undefined

  const client = {
    queries,
    get state() {
      return state
    },
    async query<T extends Record<string, unknown> = Record<string, unknown>>(
      text: string,
      values: unknown[] = []
    ): Promise<{ rows: T[] }> {
      const sql = text.replace(/\s+/g, ' ').trim()
      queries.push(sql)

      if (failOn?.test(sql)) throw new Error(`nepfout op: ${sql.slice(0, 40)}`)

      const rows = handle(sql, values, state, {
        begin: () => {
          snapshot = cloneState(state)
        },
        commit: () => {
          snapshot = undefined
        },
        rollback: () => {
          if (snapshot) state = snapshot
          snapshot = undefined
        },
      })
      return { rows: rows as T[] }
    },
  }

  return client as FakeClient
}

function handle(
  sql: string,
  values: unknown[],
  state: FakeState,
  tx: { begin: () => void; commit: () => void; rollback: () => void }
): Array<Record<string, unknown>> {
  if (sql === 'begin') return tx.begin(), []
  if (sql === 'commit') return tx.commit(), []
  if (sql === 'rollback') return tx.rollback(), []

  if (sql.includes('information_schema.columns')) {
    return [
      { table_name: 'kiosks', column_name: 'drink_storage_type' },
      { table_name: 'kiosks', column_name: 'drink_source_kiosk_id' },
      { table_name: 'kiosks', column_name: 'keeps_own_drink_stock' },
      { table_name: 'products', column_name: 'supplied_from_large_cooler_for_satellite' },
      { table_name: 'products', column_name: 'collected_after_event' },
    ]
  }

  if (sql.startsWith('select id from rings')) return [{ id: 'ring-1' }]
  if (sql.startsWith('select id from product_categories')) return [{ id: 'cat-1' }]

  if (sql.startsWith('select id, number from kiosks')) {
    return [...state.kiosks.keys()].map((number) => ({ id: kioskDbId(number), number }))
  }

  if (sql.startsWith('select number, label, drink_storage_type, keeps_own_drink_stock from kiosks')) {
    return [...state.kiosks].map(([number, kiosk]) => ({
      number,
      label: kiosk.label,
      drink_storage_type: kiosk.drinkStorageType,
      keeps_own_drink_stock: kiosk.keepsOwnDrinkStock,
    }))
  }

  if (sql.startsWith('select drink_storage_type, keeps_own_drink_stock from kiosks where id')) {
    const number = Number(String(values[0]).replace('k-', ''))
    const kiosk = state.kiosks.get(number)
    return kiosk
      ? [
          {
            drink_storage_type: kiosk.drinkStorageType,
            keeps_own_drink_stock: kiosk.keepsOwnDrinkStock,
          },
        ]
      : []
  }

  if (sql.startsWith('select id, name from products')) {
    // Alle producten bestaan al; de sync hoeft er geen aan te maken.
    return demoProducts.map((product) => ({ id: productDbId(product.id), name: product.name }))
  }

  if (sql.startsWith('select kiosk_id, product_id, target_quantity_quarters')) {
    const dbIds = new Set(values[0] as string[])
    return [...state.standards.values()]
      .filter((row) => dbIds.has(row.kioskId))
      .map((row) => ({
        kiosk_id: row.kioskId,
        product_id: row.productId,
        target_quantity_quarters: row.targetQuantityQuarters,
        is_active: row.isActive,
        manually_set_at: row.manuallySetAt ?? null,
      }))
  }

  if (sql.startsWith('select kiosk_id, product_id from kiosk_product_standards')) {
    return [...state.standards.values()]
      .filter((row) => row.manuallySetAt !== undefined)
      .map((row) => ({ kiosk_id: row.kioskId, product_id: row.productId }))
  }

  if (sql.startsWith('select id, kiosk_id, product_id from kiosk_product_standards')) {
    const dbIds = new Set(values[0] as string[])
    return [...state.standards.values()]
      .filter((row) => row.isActive && dbIds.has(row.kioskId))
      .map((row) => ({ id: row.id, kiosk_id: row.kioskId, product_id: row.productId }))
  }

  if (sql.startsWith('select target_quantity_quarters from kiosk_product_standards')) {
    const row = state.standards.get(`${values[0]}|${values[1]}`)
    return row?.isActive ? [{ target_quantity_quarters: row.targetQuantityQuarters }] : []
  }

  if (sql.startsWith('insert into kiosks')) {
    const [, number, label, , , drinkStorageType, keepsOwnDrinkStock] = values as [
      string,
      number,
      string | null,
      string | null,
      number,
      string,
      boolean,
    ]
    state.kiosks.set(number, { label, drinkStorageType, keepsOwnDrinkStock })
    return []
  }

  if (sql.startsWith('insert into kiosk_product_standards')) {
    const [kioskId, productId, target] = values as [string, string, number]
    const key = `${kioskId}|${productId}`
    state.standards.set(key, {
      id: `s-${key}`,
      kioskId,
      productId,
      targetQuantityQuarters: target,
      isActive: true,
    })
    return []
  }

  if (sql.startsWith('update kiosk_product_standards set is_active = false')) {
    const ids = new Set(values[0] as string[])
    for (const row of state.standards.values()) {
      if (ids.has(row.id)) row.isActive = false
    }
    return []
  }

  if (sql.startsWith('update products set')) return []
  if (sql.startsWith('insert into products')) return []

  throw new Error(`Nepdatabase kent deze query niet: ${sql}`)
}

const SCHRIJFT = /^(begin|commit|rollback|insert|update|delete)/

describe('proefdraai', () => {
  it('schrijft niets zonder --apply', async () => {
    const client = fakeClient(syncedState())
    await runSecondRingSync(client, { apply: false })

    expect(client.queries.filter((q) => SCHRIJFT.test(q))).toEqual([])
  })

  it('schrijft ook niets wanneer er wél wat te doen valt', async () => {
    // Lege database: het plan is dan zo groot als het maar worden kan.
    const client = fakeClient(emptyState())
    const { plan, applied } = await runSecondRingSync(client, { apply: false })

    expect(plan.isEmpty).toBe(false)
    expect(applied).toBe(false)
    expect(client.queries.filter((q) => SCHRIJFT.test(q))).toEqual([])
    expect(client.state.standards.size).toBe(0)
  })

  it('vertelt wat er zou gebeuren', async () => {
    const client = fakeClient(emptyState())
    const regels: string[] = []
    await runSecondRingSync(client, { apply: false, log: (line) => regels.push(line) })

    expect(regels.join('\n')).toMatch(/Proefdraai — er is niets gewijzigd/)
    expect(regels.join('\n')).toMatch(/Normen: \d+ nieuw/)
  })

  it('stopt op een verouderd schema voordat er iets gebeurt', async () => {
    const client = fakeClient(emptyState())
    const kaal = {
      ...client,
      query: async (text: string, values?: unknown[]) => {
        if (text.includes('information_schema.columns')) return { rows: [] }
        return client.query(text, values)
      },
    } as SqlClient

    await expect(runSecondRingSync(kaal, { apply: false })).rejects.toThrow(/db:migrate/)
  })
})

describe('transactie', () => {
  it('draait alles terug wanneer er halverwege iets misgaat', async () => {
    const client = fakeClient(emptyState(), /^insert into kiosk_product_standards/)

    await expect(runSecondRingSync(client, { apply: true })).rejects.toThrow(/nepfout/)

    expect(client.queries).toContain('begin')
    expect(client.queries).toContain('rollback')
    expect(client.queries).not.toContain('commit')
    // De kiosken gaan vóór de normen, dus die waren al geschreven toen het
    // misging. Juist die moeten weer weg zijn.
    expect(client.queries.some((q) => q.startsWith('insert into kiosks'))).toBe(true)
    expect(client.state.kiosks.size).toBe(0)
    expect(client.state.standards.size).toBe(0)
  })

  it('sluit af met commit als alles lukt', async () => {
    const client = fakeClient(emptyState())
    const { applied, problems } = await runSecondRingSync(client, { apply: true })

    expect(applied).toBe(true)
    expect(client.queries).toContain('commit')
    expect(client.queries).not.toContain('rollback')
    expect(problems).toEqual([])
  })

  it('begint er niet eens aan als er niets te doen is', async () => {
    const client = fakeClient(syncedState())
    const { applied } = await runSecondRingSync(client, { apply: true })

    expect(applied).toBe(false)
    expect(client.queries).not.toContain('begin')
  })
})

/**
 * Wat iemand in Beheer zet, hoort daar te blijven staan.
 *
 * Dit is de aanleiding: na Ajax – SC Heerenveen bleek dat 401 en 410 leegliepen
 * op chips, de norm werd op de vloer verhoogd, en de eerstvolgende sync zou hem
 * zonder deze regel gewoon weer op het papieren getal zetten. Dan loopt dezelfde
 * kiosk bij de volgende wedstrijd opnieuw leeg, en niemand die begrijpt waarom.
 */
describe('handmatig gezette normen', () => {
  const CHIPS_401 = `${kioskDbId(401)}|${productDbId('chips-blauw')}`
  const CHIPS_402 = `${kioskDbId(402)}|${productDbId('chips-blauw')}`

  /**
   * 401 chips-blauw staat met de hand op 10; bij 402 staat een gewone afwijking
   * die de sync wél hoort recht te trekken.
   *
   * Die tweede is nodig: zonder werk stopt de sync al voordat hij iets doet, en
   * dan bewijst "de norm staat er nog" niets.
   */
  function metHandmatigeNorm(): FakeState {
    const state = syncedState()
    const handmatig = state.standards.get(CHIPS_401)!
    handmatig.targetQuantityQuarters = 40
    handmatig.manuallySetAt = '2026-08-17T09:55:04Z'

    state.standards.get(CHIPS_402)!.targetQuantityQuarters = 4
    return state
  }

  /** Dezelfde handmatige norm, maar verder staat alles goed. */
  function alleenHandmatig(): FakeState {
    const state = metHandmatigeNorm()
    state.standards.get(CHIPS_402)!.targetQuantityQuarters = 8
    return state
  }

  it('laat de norm staan terwijl de rest wél wordt rechtgetrokken', async () => {
    const client = fakeClient(metHandmatigeNorm())
    const { applied } = await runSecondRingSync(client, { apply: true })

    expect(applied).toBe(true)
    expect(client.state.standards.get(CHIPS_401)!.targetQuantityQuarters).toBe(40)
    // 402 hoort op 2 dozen te staan volgens de lijst.
    expect(client.state.standards.get(CHIPS_402)!.targetQuantityQuarters).toBe(8)
  })

  it('raakt de rij niet aan, dus het stempel blijft staan', async () => {
    // De nepdatabase vervangt de rij bij een insert en verliest daarbij het
    // stempel. Staat het er na afloop nog, dan is er niets overheen geschreven.
    const client = fakeClient(metHandmatigeNorm())
    await runSecondRingSync(client, { apply: true })

    expect(client.state.standards.get(CHIPS_401)!.manuallySetAt).toBe('2026-08-17T09:55:04Z')
  })

  it('meldt het verschil, zodat een vergissing niet stil blijft', async () => {
    const client = fakeClient(metHandmatigeNorm())
    const regels: string[] = []
    await runSecondRingSync(client, { apply: false, log: (line) => regels.push(line) })

    const uitvoer = regels.join('\n')
    expect(uitvoer).toMatch(/Handmatig gezet in Beheer \(1\)/)
    expect(uitvoer).toMatch(/kiosk-401 chips-blauw: 10 \(lijst: 6\)/)
  })

  it('telt niet als werk: een run met alleen zulke normen heeft niets te doen', async () => {
    const { plan } = await runSecondRingSync(fakeClient(alleenHandmatig()), { apply: false })

    expect(plan.isEmpty).toBe(true)
  })

  it('laat de controle achteraf er niet over struikelen', async () => {
    // Anders faalt de sync op precies het gedrag dat hij zelf toepast.
    expect(await verifySecondRing(fakeClient(alleenHandmatig()))).toEqual([])
  })

  it('schakelt een handmatig toegevoegde norm niet uit', async () => {
    // Koffie hoort volgens de lijst niet bij 429 — maar wie hem daar bewust
    // neerzet heeft een reden, en dat is geen restant om op te ruimen.
    const state = syncedState()
    const key = `${kioskDbId(429)}|${productDbId('koffie')}`
    state.standards.set(key, {
      id: `s-${key}`,
      kioskId: kioskDbId(429),
      productId: productDbId('koffie'),
      targetQuantityQuarters: 8,
      isActive: true,
      manuallySetAt: '2026-08-17T09:55:04Z',
    })

    const client = fakeClient(state)
    await runSecondRingSync(client, { apply: true })

    expect(client.state.standards.get(key)!.isActive).toBe(true)
    expect(client.state.standards.get(key)!.targetQuantityQuarters).toBe(8)
  })

  it('zet een handmatig uitgezette norm niet terug', async () => {
    // Een norm op nul zetten in Beheer betekent "hoort hier niet"; de lijst mag
    // hem niet opnieuw aanzetten.
    const state = syncedState()
    const row = state.standards.get(CHIPS_401)!
    row.isActive = false
    row.manuallySetAt = '2026-08-17T09:55:04Z'

    const client = fakeClient(state)
    await runSecondRingSync(client, { apply: true })

    expect(client.state.standards.get(CHIPS_401)!.isActive).toBe(false)
  })
})

describe('verificatie achteraf', () => {
  it('zwijgt wanneer de database klopt', async () => {
    expect(await verifySecondRing(fakeClient(syncedState()))).toEqual([])
  })

  it('ziet een verkeerde norm', async () => {
    const state = syncedState()
    // 410 Red Bull hoort volgens de nieuwste stocklijst op 9 te staan. Zet hem
    // op de 10 die eerder van een vergelijkbare kiosk was overgenomen.
    const key = `${kioskDbId(410)}|${productDbId('redbull')}`
    state.standards.get(key)!.targetQuantityQuarters = 40

    const problemen = await verifySecondRing(fakeClient(state))

    expect(problemen).toHaveLength(1)
    expect(problemen[0]).toMatch(/kiosk-410 redbull: 10 ≠ 9/)
  })

  it('ziet een verkeerde bekernorm', async () => {
    const state = syncedState()
    const key = `${kioskDbId(423)}|${productDbId('bierbeker-04')}`
    state.standards.get(key)!.targetQuantityQuarters = 12

    const problemen = await verifySecondRing(fakeClient(state))

    expect(problemen).toEqual(['kiosk-423 bierbeker-04: 3 ≠ 4'])
  })

  it('ziet een beker die actief bleef terwijl de lijst nul zegt', async () => {
    // Precies het geval dat de expliciete nul moet voorkomen: 420 hoort geen
    // 0,5 meer te voeren, maar de rij staat er nog — desnoods op nul.
    const state = syncedState()
    const key = `${kioskDbId(420)}|${productDbId('bierbeker-05')}`
    state.standards.set(key, {
      id: `s-${key}`,
      kioskId: kioskDbId(420),
      productId: productDbId('bierbeker-05'),
      targetQuantityQuarters: 0,
      isActive: true,
    })

    const problemen = await verifySecondRing(fakeClient(state))

    expect(problemen).toEqual(['kiosk-420 bierbeker-05: 0, hoort geen actieve norm te zijn'])
  })

  it('vindt het goed dat een nul-beker helemaal ontbreekt', async () => {
    // 412, 414, 427 en 429 hebben geen 0,3 en 420 geen 0,5; dat is de bedoeling.
    expect(await verifySecondRing(fakeClient(syncedState()))).toEqual([])
  })

  it('ziet een norm die helemaal ontbreekt', async () => {
    const state = syncedState()
    state.standards.delete(`${kioskDbId(401)}|${productDbId('fuze-tea')}`)

    const problemen = await verifySecondRing(fakeClient(state))

    expect(problemen).toEqual([`kiosk-401 fuze-tea: ontbreekt ≠ ${EXPECTED_DRINK_MATRIX['kiosk-401']![2]}`])
  })

  it('ziet een verkeerd opslagtype', async () => {
    const state = syncedState()
    state.kiosks.get(402)!.drinkStorageType = 'LARGE_COOLER'

    const problemen = await verifySecondRing(fakeClient(state))

    expect(problemen).toEqual([
      `kiosk-402 drankopslag: LARGE_COOLER ≠ ${EXPECTED_STORAGE_TYPES['kiosk-402']}`,
    ])
  })

  it('ziet een uitgeschakelde norm als ontbrekend', async () => {
    const state = syncedState()
    state.standards.get(`${kioskDbId(426)}|${productDbId('bacardi-cola')}`)!.isActive = false

    expect(await verifySecondRing(fakeClient(state))).toHaveLength(1)
  })

  it('ziet een verkeerde chipsnorm', async () => {
    const state = syncedState()
    state.standards.get(`${kioskDbId(423)}|${productDbId('chips-blauw')}`)!.targetQuantityQuarters =
      24

    expect(await verifySecondRing(fakeClient(state))).toEqual(['kiosk-423 chips-blauw: 6 ≠ 8'])
  })

  it('ziet het als 403 op zijn oude papieren chipsnorm blijft staan', async () => {
    // 403 hoort 8/8/6 te krijgen: het blok dat op de bron "402" heette is
    // nagevraagd en van 403. Blijft het papieren 6/5/5 staan, dan is de sync
    // niet aangekomen.
    const state = syncedState()
    for (const [productId, aantal] of [
      ['chips-blauw', 6],
      ['chips-rood', 5],
      ['chips-oranje', 5],
    ] as const) {
      state.standards.get(`${kioskDbId(403)}|${productDbId(productId)}`)!.targetQuantityQuarters =
        aantal * 4
    }

    expect(await verifySecondRing(fakeClient(state))).toEqual([
      'kiosk-403 chips-blauw: 6 ≠ 8',
      'kiosk-403 chips-rood: 5 ≠ 8',
      'kiosk-403 chips-oranje: 5 ≠ 6',
    ])
  })

  it('ziet een verkeerde Post-mixnorm', async () => {
    const state = syncedState()
    state.standards.get(`${kioskDbId(416)}|${productDbId('cola-zero')}`)!.targetQuantityQuarters = 20

    expect(await verifySecondRing(fakeClient(state))).toEqual(['kiosk-416 cola-zero: 5 ≠ 6'])
  })

  it('ziet 407 Fanta die actief bleef', async () => {
    const state = syncedState()
    const key = `${kioskDbId(407)}|${productDbId('fanta')}`
    state.standards.set(key, {
      id: `s-${key}`,
      kioskId: kioskDbId(407),
      productId: productDbId('fanta'),
      targetQuantityQuarters: 4,
      isActive: true,
    })

    expect(await verifySecondRing(fakeClient(state))).toEqual([
      'kiosk-407 fanta: 1, hoort geen actieve norm te zijn',
    ])
  })

  it('ziet Fuze Tea Peach Hibiscus die bij 407 ontbreekt', async () => {
    const state = syncedState()
    state.standards.delete(`${kioskDbId(407)}|${productDbId('fuze-tea-peach-hibiscus')}`)

    expect(await verifySecondRing(fakeClient(state))).toEqual([
      'kiosk-407 fuze-tea-peach-hibiscus: ontbreekt ≠ 2',
    ])
  })

  it('ziet koolzuur dat door de Post-mixlijst is weggevallen', async () => {
    // De pakkenlijst noemt koolzuur nergens; hem daardoor uitzetten is het soort
    // fout waar niemand naar kijkt tot de tap het begeeft.
    const state = syncedState()
    state.standards.get(`${kioskDbId(410)}|${productDbId('koolzuur')}`)!.isActive = false

    expect(await verifySecondRing(fakeClient(state))).toEqual([
      'kiosk-410 koolzuur: ontbreekt ≠ 2',
    ])
  })
})

describe('expliciete removals', () => {
  it('zet een bestaande beker- en Post-mixnorm uit die van de lijst af is', async () => {
    // Een lijst die iets weghaalt moet dat ook in de database doen; alleen uit
    // de TypeScript verdwijnen laat de norm gewoon staan.
    const state = syncedState()
    const weg: Array<[number, string]> = [
      [420, 'bierbeker-05'],
      [427, 'bierbeker-03'],
      [412, 'bierbeker-03'],
      [407, 'fanta'],
    ]

    for (const [nummer, productId] of weg) {
      const key = `${kioskDbId(nummer)}|${productDbId(productId)}`
      state.standards.set(key, {
        id: `s-${key}`,
        kioskId: kioskDbId(nummer),
        productId: productDbId(productId),
        targetQuantityQuarters: 8,
        isActive: true,
      })
    }

    const client = fakeClient(state)
    const { applied, problems } = await runSecondRingSync(client, { apply: true })

    expect(applied).toBe(true)
    expect(problems).toEqual([])
    for (const [nummer, productId] of weg) {
      const row = client.state.standards.get(`${kioskDbId(nummer)}|${productDbId(productId)}`)
      expect(row?.isActive, `${nummer} ${productId}`).toBe(false)
    }
  })

  it('zet een disposable uit waar de nieuwe lijst een 0 heeft', async () => {
    // De Disposable-lijst staat vol nullen. Een 0 betekent "voert dit niet";
    // een norm die daarna nog actief in de database staat — desnoods op nul —
    // is precies wat die 0 moest uitsluiten.
    const state = syncedState()
    const weg: Array<[number, string]> = [
      [423, 'rectangular-bakjes'],
      [423, 'arena-blaadjes'],
      [424, 'servetten'],
      [420, 'patat-vorkjes'],
      [4201, 'rectangular-bakjes'],
    ]

    for (const [nummer, productId] of weg) {
      const key = `${kioskDbId(nummer)}|${productDbId(productId)}`
      state.standards.set(key, {
        id: `s-${key}`,
        kioskId: kioskDbId(nummer),
        productId: productDbId(productId),
        targetQuantityQuarters: 8,
        isActive: true,
      })
    }

    const client = fakeClient(state)
    const { problems } = await runSecondRingSync(client, { apply: true })

    expect(problems).toEqual([])
    for (const [nummer, productId] of weg) {
      const row = client.state.standards.get(`${kioskDbId(nummer)}|${productDbId(productId)}`)
      expect(row?.isActive, `${nummer} ${productId}`).toBe(false)
    }
  })
})

describe('weglating is geen deactivering', () => {
  it('laat 422 zijn servetten houden, want die staat niet op de Disposable-lijst', async () => {
    const client = fakeClient(syncedState())
    const { problems } = await runSecondRingSync(client, { apply: true })

    expect(problems).toEqual([])
    const row = client.state.standards.get(
      `${kioskDbId(422)}|${productDbId('servetten')}`
    )
    expect(row).toMatchObject({ isActive: true, targetQuantityQuarters: 20 })
  })

  it('laat koolzuur staan, dat op geen van de nieuwe lijsten voorkomt', async () => {
    const client = fakeClient(syncedState())
    const { problems } = await runSecondRingSync(client, { apply: true })

    expect(problems).toEqual([])
    for (const nummer of [401, 404, 406, 407, 410, 416, 420, 4201, 426]) {
      const row = client.state.standards.get(`${kioskDbId(nummer)}|${productDbId('koolzuur')}`)
      expect(row, `${nummer}`).toMatchObject({ isActive: true, targetQuantityQuarters: 8 })
    }
  })
})

describe('de drie nieuwe lijsten in de database', () => {
  /** De actieve norm in hele verpakkingen, of undefined. */
  function actief(client: FakeClient, nummer: number, productId: string): number | undefined {
    const row = client.state.standards.get(`${kioskDbId(nummer)}|${productDbId(productId)}`)
    return row?.isActive ? row.targetQuantityQuarters / 4 : undefined
  }

  it('zet de GFT-bakken bij precies acht kiosken neer', async () => {
    const client = fakeClient(emptyState())
    const { problems } = await runSecondRingSync(client, { apply: true })
    expect(problems).toEqual([])

    for (const nummer of [401, 403, 407, 410, 416, 419, 420, 423]) {
      expect(actief(client, nummer, 'gft-bak'), `${nummer}`).toBe(1)
    }
    for (const nummer of [402, 404, 409, 422, 424, 426, 4201, 4300]) {
      expect(actief(client, nummer, 'gft-bak'), `${nummer}`).toBeUndefined()
    }
  })

  it('geeft Ziggo Platform zijn eigen normen, met Biertrays op 1', async () => {
    const client = fakeClient(emptyState())
    const { problems } = await runSecondRingSync(client, { apply: true })
    expect(problems).toEqual([])

    // De algemene Disposable-lijst zegt hier 3; de specifieke Ziggo-lijst 1.
    expect(actief(client, 4300, 'sixpacks')).toBe(1)

    expect(actief(client, 4300, 'bierbeker-03')).toBe(1)
    expect(actief(client, 4300, 'vuilniszakken')).toBe(3)
    expect(actief(client, 4300, 'cola')).toBe(10)
    expect(actief(client, 4300, 'fuze-tea')).toBe(2)
    expect(actief(client, 4300, 'redbull')).toBe(1)
  })

  it('zet het vinkje voor eigen drankvoorraad alleen bij Ziggo Platform', async () => {
    const client = fakeClient(emptyState())
    await runSecondRingSync(client, { apply: true })

    const met = [...client.state.kiosks]
      .filter(([, kiosk]) => kiosk.keepsOwnDrinkStock)
      .map(([number]) => number)

    expect(met).toEqual([4300])
  })

  it('maakt precies één nieuwe productrij voor GFT en hergebruikt de rest', async () => {
    // In productie bestaat GFT nog niet. De koppeling loopt op naam, dus een
    // ontbrekende rij hoort één keer aangemaakt te worden — en de bestaande
    // Biertrays-rij hoort met rust gelaten te worden, niet gedupliceerd.
    const client = fakeClient(emptyState())
    const bestaandeNamen = new Set(
      demoProducts.filter((p) => p.name !== 'GFT Bak').map((p) => p.name)
    )

    const zonderGft = {
      ...client,
      query: async (text: string, values?: unknown[]) => {
        const sql = text.replace(/\s+/g, ' ').trim()
        if (sql.startsWith('select id, name from products')) {
          await client.query(text, values)
          return {
            rows: demoProducts
              .filter((p) => bestaandeNamen.has(p.name))
              .map((p) => ({ id: productDbId(p.id), name: p.name })),
          }
        }
        if (sql.startsWith('insert into products')) {
          bestaandeNamen.add(String(values?.[1]))
        }
        return client.query(text, values)
      },
    } as SqlClient

    const { applied } = await runSecondRingSync(zonderGft, { apply: true })
    expect(applied).toBe(true)

    const inserts = client.queries.filter((q) => q.startsWith('insert into products'))
    expect(inserts).toHaveLength(1)
    expect(bestaandeNamen.has('GFT Bak')).toBe(true)

    // En de biertrays wijzen nog steeds naar de bestaande rij.
    const trays = client.state.standards.get(`${kioskDbId(423)}|${productDbId('sixpacks')}`)
    expect(trays).toMatchObject({ isActive: true, targetQuantityQuarters: 12 })
  })

  it('meldt in de proefdraai dat Ziggo eigen drankvoorraad krijgt', async () => {
    // Een bestaande database zonder dit kenmerk: de proefdraai hoort te zeggen
    // wat er verandert voordat iemand --apply typt.
    const state = syncedState()
    state.kiosks.set(4300, {
      label: 'Ziggo Platform',
      drinkStorageType: 'SATELLITE',
      keepsOwnDrinkStock: false,
    })

    const regels: string[] = []
    await runSecondRingSync(fakeClient(state), { apply: false, log: (r) => regels.push(r) })

    expect(regels.join('\n')).toMatch(/eigen drankvoorraad nee → ja/)
  })
})

describe('scope', () => {
  it('schrijft geen enkele norm van de eerste ring', async () => {
    const client = fakeClient(emptyState())
    await runSecondRingSync(client, { apply: true })

    const eersteRing = new Set(
      demoKiosks.filter((k) => k.ringId === 'ring-eerste').map((k) => kioskDbId(k.number))
    )
    for (const row of client.state.standards.values()) {
      expect(eersteRing.has(row.kioskId)).toBe(false)
    }
    expect(client.state.kiosks.has(110)).toBe(false)
  })

  it('raakt tellingen, bijvulbehoeften en gebruikers niet aan', async () => {
    // De nepdatabase kent alleen de tabellen die de sync hoort te gebruiken en
    // klapt op de rest; deze test maakt die grens expliciet.
    const client = fakeClient(emptyState())
    await runSecondRingSync(client, { apply: true })

    const beschreven = client.queries
      .filter((q) => /^(insert into|update|delete from) /.test(q))
      .map((q) => q.replace(/^(insert into|update|delete from) /, '').split(' ')[0]!)

    expect([...new Set(beschreven)].sort()).toEqual([
      'kiosk_product_standards',
      'kiosks',
      'products',
    ])
  })

  it('laat een bestaande norm buiten de authoritative kiosken met rust', async () => {
    const state = syncedState()
    const vreemd = `${kioskDbId(110)}|${productDbId('fuze-tea')}`
    state.kiosks.set(110, { label: null, drinkStorageType: 'NONE', keepsOwnDrinkStock: false })
    state.standards.set(vreemd, {
      id: 's-110',
      kioskId: kioskDbId(110),
      productId: productDbId('fuze-tea'),
      targetQuantityQuarters: 40,
      isActive: true,
    })

    const client = fakeClient(state)
    await runSecondRingSync(client, { apply: true })

    expect(client.state.standards.get(vreemd)).toMatchObject({
      isActive: true,
      targetQuantityQuarters: 40,
    })
  })
})
