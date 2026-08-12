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
}

interface FakeState {
  kiosks: Map<number, { label: string | null; drinkStorageType: string }>
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
      { table_name: 'products', column_name: 'supplied_from_large_cooler_for_satellite' },
    ]
  }

  if (sql.startsWith('select id from rings')) return [{ id: 'ring-1' }]
  if (sql.startsWith('select id from product_categories')) return [{ id: 'cat-1' }]

  if (sql.startsWith('select id, number from kiosks')) {
    return [...state.kiosks.keys()].map((number) => ({ id: kioskDbId(number), number }))
  }

  if (sql.startsWith('select number, label, drink_storage_type from kiosks')) {
    return [...state.kiosks].map(([number, kiosk]) => ({
      number,
      label: kiosk.label,
      drink_storage_type: kiosk.drinkStorageType,
    }))
  }

  if (sql.startsWith('select drink_storage_type from kiosks where id')) {
    const number = Number(String(values[0]).replace('k-', ''))
    const kiosk = state.kiosks.get(number)
    return kiosk ? [{ drink_storage_type: kiosk.drinkStorageType }] : []
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
      }))
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
    const [, number, label, , , drinkStorageType] = values as [
      string,
      number,
      string | null,
      string | null,
      number,
      string,
    ]
    state.kiosks.set(number, { label, drinkStorageType })
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

describe('verificatie achteraf', () => {
  it('zwijgt wanneer de database klopt', async () => {
    expect(await verifySecondRing(fakeClient(syncedState()))).toEqual([])
  })

  it('ziet een verkeerde norm', async () => {
    const state = syncedState()
    // 410 Red Bull hoort op 6 te staan. Zet hem op de 10 die er ooit ten
    // onrechte stond, overgenomen van een vergelijkbare kiosk.
    const key = `${kioskDbId(410)}|${productDbId('redbull')}`
    state.standards.get(key)!.targetQuantityQuarters = 40

    const problemen = await verifySecondRing(fakeClient(state))

    expect(problemen).toHaveLength(1)
    expect(problemen[0]).toMatch(/kiosk-410 redbull: 10 ≠ 6/)
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

  it('laat een bestaande norm buiten de authoritative kiosken met rust', async () => {
    const state = syncedState()
    const vreemd = `${kioskDbId(110)}|${productDbId('fuze-tea')}`
    state.kiosks.set(110, { label: null, drinkStorageType: 'NONE' })
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
