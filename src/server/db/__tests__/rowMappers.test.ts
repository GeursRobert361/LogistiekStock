import { describe, it, expect } from 'vitest'
import { mapRing, ringToRow, mapKiosk, kioskToRow, mapProduct, productToRow } from '../rowMappers'
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
