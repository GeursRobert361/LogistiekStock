import { describe, it, expect } from 'vitest'
import { buildStorageNoteLookup, EMPTY_STORAGE_NOTES } from '../storageNotes'
import type { KioskStorageNote } from '@/types'

/**
 * De opmerkingen over waar voorraad ligt, zoals het scherm ze opzoekt.
 *
 * Ze stonden als vaste lijst in de code en gingen op kiosknummer en productnaam;
 * nu komen ze uit de database en gaan ze op id. Daarmee is de stille breuk weg
 * (hernoem een product en de opmerking verdwijnt), maar er komt een andere voor
 * terug: een regel hoort bij een product óf bij een categorie, nooit bij allebei
 * en nooit bij geen van beide. Daar zit het merendeel van deze tests op.
 */

const note = (fields: Partial<KioskStorageNote> & { id: string }): KioskStorageNote => ({
  kioskId: 'kiosk-401',
  note: 'ergens',
  createdAt: '2026-08-18T10:00:00.000Z',
  updatedAt: '2026-08-18T10:00:00.000Z',
  ...fields,
})

const NOTES: KioskStorageNote[] = [
  note({
    id: 'n1',
    kioskId: 'kiosk-401',
    productId: 'bierbeker-05',
    note: '2 dozen achter in de kiosk',
  }),
  note({
    id: 'n2',
    kioskId: 'kiosk-410',
    productId: 'bierbeker-05',
    note: '1 doos achter in de kiosk',
  }),
  note({
    id: 'n3',
    kioskId: 'kiosk-401',
    categoryId: 'cat-chips',
    note: '3 op de plank, onder elk luik 1 doos',
  }),
  note({
    id: 'n4',
    kioskId: 'kiosk-406',
    categoryId: 'cat-chips',
    note: '3 dozen op het kratje, rest onder de balie',
  }),
  note({
    id: 'n5',
    kioskId: 'kiosk-406',
    categoryId: 'cat-postmix',
    note: 'In het hok links van de kiosk',
  }),
]

describe('opmerking bij een product', () => {
  const lookup = buildStorageNoteLookup(NOTES)

  it('vindt de opmerking van deze kiosk bij dit product', () => {
    expect(lookup.forProduct('kiosk-401', 'bierbeker-05')).toBe('2 dozen achter in de kiosk')
    expect(lookup.forProduct('kiosk-410', 'bierbeker-05')).toBe('1 doos achter in de kiosk')
  })

  it('zwijgt bij een kiosk zonder opmerking', () => {
    expect(lookup.forProduct('kiosk-402', 'bierbeker-05')).toBeUndefined()
  })

  it('zwijgt bij een ander product op dezelfde kiosk', () => {
    expect(lookup.forProduct('kiosk-401', 'bierbeker-04')).toBeUndefined()
  })

  it('verwart een categorie niet met een product', () => {
    // 401 heeft een opmerking bij de categorie Chips. Wie met dat id een
    // product opzoekt hoort niets te krijgen, anders lekt de ene soort
    // opmerking de andere in.
    expect(lookup.forProduct('kiosk-401', 'cat-chips')).toBeUndefined()
  })

  it('gaat om met een kiosk of product dat nog niet geladen is', () => {
    expect(lookup.forProduct(undefined, 'bierbeker-05')).toBeUndefined()
    expect(lookup.forProduct('kiosk-401', undefined)).toBeUndefined()
  })
})

describe('opmerking bij een categorie', () => {
  const lookup = buildStorageNoteLookup(NOTES)

  it('vindt de opmerking van deze categorie bij deze kiosk', () => {
    expect(lookup.forCategory('kiosk-401', 'cat-chips')).toBe(
      '3 op de plank, onder elk luik 1 doos'
    )
    expect(lookup.forCategory('kiosk-406', 'cat-postmix')).toBe('In het hok links van de kiosk')
  })

  it('houdt de categorieën van dezelfde kiosk uit elkaar', () => {
    expect(lookup.forCategory('kiosk-406', 'cat-chips')).toBe(
      '3 dozen op het kratje, rest onder de balie'
    )
    expect(lookup.forCategory('kiosk-401', 'cat-postmix')).toBeUndefined()
  })

  it('verwart een product niet met een categorie', () => {
    expect(lookup.forCategory('kiosk-401', 'bierbeker-05')).toBeUndefined()
  })

  it('gaat om met een kiosk of categorie die nog niet geladen is', () => {
    expect(lookup.forCategory(undefined, 'cat-chips')).toBeUndefined()
    expect(lookup.forCategory('kiosk-401', undefined)).toBeUndefined()
  })
})

describe('nog niets geladen', () => {
  it('zwijgt overal over', () => {
    // Het telscherm tekent zijn rijen voordat de opmerkingen binnen zijn. Dat
    // hoort een leeg regeltje op te leveren en geen crash.
    expect(EMPTY_STORAGE_NOTES.forProduct('kiosk-401', 'bierbeker-05')).toBeUndefined()
    expect(EMPTY_STORAGE_NOTES.forCategory('kiosk-401', 'cat-chips')).toBeUndefined()
  })
})

describe('een regel die nergens bij hoort', () => {
  it('wordt niet gevonden als hij geen product en geen categorie noemt', () => {
    // De database staat dit niet toe. Zou zo'n rij er tóch zijn, dan mag hij
    // niet opeens bij álles horen.
    const lookup = buildStorageNoteLookup([note({ id: 'kapot', kioskId: 'kiosk-401' })])

    expect(lookup.forProduct('kiosk-401', 'bierbeker-05')).toBeUndefined()
    expect(lookup.forCategory('kiosk-401', 'cat-chips')).toBeUndefined()
  })
})
