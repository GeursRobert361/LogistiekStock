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
  mapAgendaEntry,
  mapKioskCount,
  mapRound,
  mapDelivery,
  kioskCountToRow,
  roundToRow,
  roundStopToRow,
} from '../rowMappers'
import { InputStep, RoundType, ProductSize } from '@/types'

/**
 * Tijdstempels die leeg mógen zijn.
 *
 * node-postgres geeft een timestamptz terug als JS-Date. Ging die door
 * `String()`, dan werd het "Fri Aug 07 2026 16:34:31 GMT+0000 (Coordinated
 * Universal Time)" — leesbaar, maar geen ISO. De client bewaarde dat en
 * schreef het later terug, waarna Postgres het weigerde met
 * "invalid input syntax for type timestamp with time zone" en de telling
 * eindeloos in de wachtrij bleef hangen.
 */
describe('optionele tijdstempels', () => {
  const moment = new Date('2026-08-07T16:34:31.305Z')

  it('geeft een kiosktelling terug in ISO, niet als datumtekst', () => {
    const kioskCount = mapKioskCount({
      id: 'kc-1',
      count_session_id: 'sessie-1',
      kiosk_id: 'kiosk-101',
      started_at: moment,
      completed_at: moment,
      counter_id: 'teller-1',
      status: 'IN_PROGRESS',
      created_at: moment,
      updated_at: moment,
    })

    expect(kioskCount.startedAt).toBe('2026-08-07T16:34:31.305Z')
    expect(kioskCount.completedAt).toBe('2026-08-07T16:34:31.305Z')
  })

  it('doet hetzelfde voor de tijdstempels van een vulronde', () => {
    const round = mapRound({
      id: 'ronde-1',
      event_id: 'event-1',
      ring_id: 'ring-1',
      name: 'Productronde Water',
      round_type: 'PRODUCT_ROUND',
      status: 'CLAIMED',
      created_by_id: 'planner-1',
      claimed_at: moment,
      started_at: moment,
      completed_at: moment,
      created_at: moment,
      updated_at: moment,
    })

    expect(round.claimedAt).toBe('2026-08-07T16:34:31.305Z')
    expect(round.startedAt).toBe('2026-08-07T16:34:31.305Z')
    expect(round.completedAt).toBe('2026-08-07T16:34:31.305Z')
  })

  it('doet hetzelfde voor het moment van afleveren', () => {
    const delivery = mapDelivery({
      id: 'levering-1',
      restock_round_stop_id: 'halte-1',
      product_id: 'water',
      planned_packages: 6,
      delivered_packages: 6,
      not_delivered_packages: 0,
      delivered_at: moment,
      delivered_by_id: 'vuller-1',
      created_at: moment,
    })

    expect(delivery.deliveredAt).toBe('2026-08-07T16:34:31.305Z')
  })

  it('maakt een datumtekst uit een oude cache alsnog ISO bij het wegschrijven', () => {
    // Wie in de foute periode heeft geteld, heeft deze tekst in zijn
    // offline-opslag staan. Die telling moet gewoon alsnog weg te schrijven
    // zijn — anders blijft hij voorgoed in de wachtrij hangen.
    const row = kioskCountToRow({
      id: 'kc-1',
      startedAt: 'Fri Aug 07 2026 16:34:31 GMT+0000 (Coordinated Universal Time)',
    })

    expect(row.started_at).toBe('2026-08-07T16:34:31.000Z')
  })

  it('laat een tijdstempel die al ISO is met rust', () => {
    const row = kioskCountToRow({ id: 'kc-1', startedAt: '2026-08-07T16:34:31.305Z' })
    expect(row.started_at).toBe('2026-08-07T16:34:31.305Z')
  })

  it('laat onleesbare tekst staan, zodat de database erover klaagt', () => {
    // Stil aanpassen zou een echte fout verbergen.
    const row = kioskCountToRow({ id: 'kc-1', startedAt: 'gisterochtend' })
    expect(row.started_at).toBe('gisterochtend')
  })

  it('normaliseert ook de tijdstempels van een vulronde en een levering', () => {
    const rommel = 'Fri Aug 07 2026 16:34:31 GMT+0000 (Coordinated Universal Time)'
    expect(roundToRow({ claimedAt: rommel }).claimed_at).toBe('2026-08-07T16:34:31.000Z')
    expect(roundStopToRow({ completedAt: rommel }).completed_at).toBe('2026-08-07T16:34:31.000Z')
  })

  it('laat een lege tijdstempel leeg', () => {
    const kioskCount = mapKioskCount({
      id: 'kc-1',
      count_session_id: 'sessie-1',
      kiosk_id: 'kiosk-101',
      started_at: null,
      completed_at: null,
      counter_id: 'teller-1',
      status: 'PENDING',
      created_at: moment,
      updated_at: moment,
    })

    expect(kioskCount.startedAt).toBeUndefined()
    expect(kioskCount.completedAt).toBeUndefined()
  })
})

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

describe('datums uit de database', () => {
  /**
   * node-postgres geeft een `date`-kolom terug als Date-object. Werd dat met
   * String() omgezet, dan stond er "Sat Sep 05 2026 00:00:00 GMT+0000" in het
   * domeinobject. Daarop sorteren is alfabetisch: "Sat" vóór "Sun" vóór "Thu",
   * en elke vergelijking met "2026-08-08" gaat mis omdat een letter altijd
   * groter is dan een cijfer. De agenda wees daardoor een wedstrijd maanden
   * later aan als eerstvolgende.
   */
  const row = (date: unknown) => ({
    id: 'agenda-1',
    name: 'Ajax – PSV',
    date,
    event_type: 'VOETBAL',
    created_at: new Date('2026-08-01T09:00:00.000Z'),
    updated_at: '2026-08-01T09:00:00.000Z',
  })

  it('maakt van een Date-object een kale datum', () => {
    expect(mapAgendaEntry(row(new Date(2026, 8, 5))).date).toBe('2026-09-05')
  })

  it('laat een datum die al tekst is met rust', () => {
    expect(mapAgendaEntry(row('2026-09-05')).date).toBe('2026-09-05')
  })

  it('geeft datums die op volgorde te zetten zijn', () => {
    const dates = [new Date(2026, 7, 16), new Date(2026, 8, 5), new Date(2026, 7, 6)]
      .map((date) => mapAgendaEntry(row(date)).date)
      .sort((a, b) => a.localeCompare(b))

    expect(dates).toEqual(['2026-08-06', '2026-08-16', '2026-09-05'])
    expect(dates[0]! >= '2026-08-08').toBe(false)
    expect(dates[1]! >= '2026-08-08').toBe(true)
  })

  it('maakt van een tijdstempel ISO-tekst', () => {
    expect(mapAgendaEntry(row('2026-09-05')).createdAt).toBe('2026-08-01T09:00:00.000Z')
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
