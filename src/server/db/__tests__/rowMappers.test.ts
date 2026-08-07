import { describe, it, expect } from 'vitest'
import {
  mapRing,
  ringToRow,
  mapKiosk,
  kioskToRow,
  mapProduct,
  productToRow,
  mapCountSession,
  countSessionToRow,
} from '../rowMappers'
import { InputStep, RoundType, ProductSize } from '@/types'

/**
 * De mappers vertalen tussen databasekolommen en domeintypes.
 *
 * Deze laag is stil als hij fout is: een vergeten veld levert geen typefout op
 * — het is gewoon `undefined` — en geen foutmelding. Zo verdween eerder de
 * startkiosk van een ring: hij stond in de database, maar de API gaf hem niet
 * terug en de UI viel terug op de standaardkeuze.
 */

describe('mapRing', () => {
  const row = {
    id: 'ring-1',
    name: 'Eerste ring',
    description: 'Kiosknummers 100-serie',
    is_active: true,
    sort_order: 1,
    count_start_kiosk_id: 'kiosk-127',
    restock_start_kiosk_id: 'kiosk-122',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  }

  it('leest alle velden, inclusief de startkiosken', () => {
    expect(mapRing(row)).toEqual({
      id: 'ring-1',
      name: 'Eerste ring',
      description: 'Kiosknummers 100-serie',
      isActive: true,
      sortOrder: 1,
      countStartKioskId: 'kiosk-127',
      restockStartKioskId: 'kiosk-122',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    })
  })

  it('geeft undefined wanneer er geen startkiosk is ingesteld', () => {
    const ring = mapRing({ ...row, count_start_kiosk_id: null, restock_start_kiosk_id: null })
    expect(ring.countStartKioskId).toBeUndefined()
    expect(ring.restockStartKioskId).toBeUndefined()
  })

  it('schrijft de startkiosken terug naar de juiste kolommen', () => {
    expect(
      ringToRow({ countStartKioskId: 'kiosk-127', restockStartKioskId: 'kiosk-122' })
    ).toEqual({
      count_start_kiosk_id: 'kiosk-127',
      restock_start_kiosk_id: 'kiosk-122',
    })
  })

  it('maakt een startkiosk leeg met null in plaats van een lege string', () => {
    // Een lege string zou de foreign key breken.
    expect(ringToRow({ countStartKioskId: '' })).toEqual({ count_start_kiosk_id: null })
  })

  it('laat velden weg die niet gezet zijn', () => {
    expect(ringToRow({ name: 'Derde ring' })).toEqual({ name: 'Derde ring' })
  })

  it('overleeft een rondje heen en terug', () => {
    const ring = mapRing(row)
    const backToRow = ringToRow(ring)

    expect(backToRow.count_start_kiosk_id).toBe(row.count_start_kiosk_id)
    expect(backToRow.restock_start_kiosk_id).toBe(row.restock_start_kiosk_id)
    expect(backToRow.name).toBe(row.name)
    expect(backToRow.sort_order).toBe(row.sort_order)
  })
})

describe('mapKiosk', () => {
  it('overleeft een rondje heen en terug', () => {
    const row = {
      id: 'kiosk-101',
      ring_id: 'ring-1',
      number: 101,
      name: 'Kiosk 101',
      sort_order: 1,
      is_active: true,
      location: 'Vak 12',
      notes: 'naast de lift',
      created_at: '',
      updated_at: '',
    }

    const backToRow = kioskToRow(mapKiosk(row))

    expect(backToRow.ring_id).toBe('ring-1')
    expect(backToRow.number).toBe(101)
    expect(backToRow.sort_order).toBe(1)
    expect(backToRow.location).toBe('Vak 12')
    expect(backToRow.notes).toBe('naast de lift')
  })

  it('geeft het opschrift terug', () => {
    // Zonder dit veld valt de hele app terug op het nummer: "120 Cubes" werd
    // overal 1201.
    const kiosk = mapKiosk({
      id: 'kiosk-120-cubes',
      ring_id: 'ring-1',
      number: 1201,
      label: '120 Cubes',
      sort_order: 205,
      is_active: true,
      created_at: '',
      updated_at: '',
    })

    expect(kiosk.label).toBe('120 Cubes')
    expect(kioskToRow(kiosk).label).toBe('120 Cubes')
  })

  it('laat een kiosk zonder opschrift met rust', () => {
    const kiosk = mapKiosk({
      id: 'kiosk-101',
      ring_id: 'ring-1',
      number: 101,
      label: null,
      sort_order: 10,
      is_active: true,
      created_at: '',
      updated_at: '',
    })

    expect(kiosk.label).toBeUndefined()
    expect(kioskToRow(kiosk)).not.toHaveProperty('label')
  })

  it('wist een opschrift als het leeg wordt gemaakt', () => {
    expect(kioskToRow({ label: '   ' }).label).toBeNull()
  })
})

describe('mapProduct', () => {
  it('overleeft een rondje heen en terug, met de invoerstap als tekst', () => {
    const row = {
      id: 'prod-1',
      category_id: 'cat-1',
      name: 'Water blauw',
      short_name: 'Water',
      count_unit: 'pak',
      packaging_unit: 'pakken',
      sort_order: 4,
      is_active: true,
      input_step: '0.5',
      allow_partial_package: true,
      round_type: RoundType.PRODUCT_ROUND,
      product_size: ProductSize.LARGE,
      estimated_pallet_load: 2.5,
      own_round_threshold: 30,
      priority: 5,
      storage_location: 'Stelling A',
      refrigerated: false,
      notes: null,
      created_at: '',
      updated_at: '',
    }

    const product = mapProduct(row)
    expect(product.inputStep).toBe(InputStep.HALF)
    expect(product.estimatedPalletLoad).toBe(2.5)

    // input_step is text in de database, geen getal.
    const backToRow = productToRow(product)
    expect(backToRow.input_step).toBe('0.5')
    expect(backToRow.own_round_threshold).toBe(30)
    expect(backToRow.storage_location).toBe('Stelling A')
  })
})

describe('mapCountSession', () => {
  const row = {
    id: 'sessie-1',
    user_id: 'teller-1',
    event_id: 'event-1',
    ring_id: 'ring-1',
    start_kiosk_id: 'kiosk-127',
    direction: 'ascending',
    kiosk_route: ['kiosk-127', 'kiosk-128', 'kiosk-101'],
    started_at: '2026-08-07T10:00:00Z',
    status: 'IN_PROGRESS',
    sync_status: 'LOCAL',
    created_at: '',
    updated_at: '',
  }

  it('leest de route uit een jsonb-kolom', () => {
    expect(mapCountSession(row).kioskRoute).toEqual(['kiosk-127', 'kiosk-128', 'kiosk-101'])
  })

  it('leest de route ook wanneer die als tekst binnenkomt', () => {
    const asText = { ...row, kiosk_route: '["kiosk-127","kiosk-128"]' }
    expect(mapCountSession(asText).kioskRoute).toEqual(['kiosk-127', 'kiosk-128'])
  })

  it('geeft een lege route bij onbruikbare inhoud in plaats van te crashen', () => {
    expect(mapCountSession({ ...row, kiosk_route: null }).kioskRoute).toEqual([])
    expect(mapCountSession({ ...row, kiosk_route: 'geen json' }).kioskRoute).toEqual([])
  })

  /**
   * De reden dat deze test bestaat: een JavaScript-array als queryparameter
   * wordt door de driver een Postgres-array ({a,b}), niet JSON (["a","b"]).
   * Voor een jsonb-kolom is dat een fout, en die kwam pas in productie boven.
   */
  it('schrijft de route als JSON-tekst, niet als array', () => {
    const written = countSessionToRow({ kioskRoute: ['kiosk-127', 'kiosk-128'] })

    expect(typeof written.kiosk_route).toBe('string')
    expect(written.kiosk_route).toBe('["kiosk-127","kiosk-128"]')
    // Een Postgres-array zou hiermee beginnen.
    expect(written.kiosk_route as string).not.toMatch(/^\{/)
  })

  it('overleeft een rondje heen en terug', () => {
    const session = mapCountSession(row)
    const backToRow = countSessionToRow(session)

    expect(mapCountSession({ ...row, kiosk_route: backToRow.kiosk_route }).kioskRoute).toEqual(
      session.kioskRoute
    )
  })
})
