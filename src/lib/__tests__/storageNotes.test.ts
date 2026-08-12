import { describe, it, expect } from 'vitest'
import { storageNotes, storageNoteFor } from '../storageNotes'
import { demoKiosks, demoStandards } from '@/lib/seed/demoData'
import { demoProducts } from '@/lib/seed/catalogue'

/**
 * De opmerkingen over waar voorraad ligt.
 *
 * De koppeling loopt via kiosknummer en productnaam, en dat is precies waar dit
 * stil kan breken: hernoem "Bierbekers 0,5" in de catalogus en de notitie
 * verdwijnt zonder dat er iets stukgaat. Daarom staat hier een test die de
 * koppeling controleert in plaats van hem te vertrouwen.
 */

const KIOSK_401 = { number: 401 }
const BEKER_05 = { name: 'Bierbekers 0,5' }

describe('storageNoteFor', () => {
  it('vindt de opmerking van deze kiosk bij dit product', () => {
    expect(storageNoteFor(KIOSK_401, BEKER_05)).toBe('2 dozen achter in de kiosk')
    expect(storageNoteFor({ number: 410 }, BEKER_05)).toBe('1 doos achter in de kiosk')
  })

  it('zwijgt bij een kiosk zonder opmerking', () => {
    expect(storageNoteFor({ number: 402 }, BEKER_05)).toBeUndefined()
  })

  it('zwijgt bij een ander product op dezelfde kiosk', () => {
    expect(storageNoteFor(KIOSK_401, { name: 'Bierbekers 0,4' })).toBeUndefined()
    expect(storageNoteFor(KIOSK_401, { name: 'Fuze Tea' })).toBeUndefined()
  })

  it('gaat om met een kiosk of product dat nog niet geladen is', () => {
    expect(storageNoteFor(null, BEKER_05)).toBeUndefined()
    expect(storageNoteFor(KIOSK_401, undefined)).toBeUndefined()
  })
})

describe('de opmerkingen zelf', () => {
  it('verwijzen naar bestaande kiosken', () => {
    const nummers = new Set(demoKiosks.map((k) => k.number))
    for (const note of storageNotes) {
      expect(nummers.has(note.kioskNumber), String(note.kioskNumber)).toBe(true)
    }
  })

  it('verwijzen naar bestaande productnamen', () => {
    const namen = new Set(demoProducts.map((p) => p.name))
    for (const note of storageNotes) {
      expect(namen.has(note.productName), note.productName).toBe(true)
    }
  })

  it('horen bij een product dat die kiosk ook werkelijk voert', () => {
    // Een opmerking bij een product zonder norm zou nooit op het scherm komen.
    for (const note of storageNotes) {
      const kiosk = demoKiosks.find((k) => k.number === note.kioskNumber)!
      const product = demoProducts.find((p) => p.name === note.productName)!
      const standard = demoStandards.find(
        (s) => s.kioskId === kiosk.id && s.productId === product.id
      )

      expect(standard, `${note.kioskNumber} ${note.productName}`).toBeDefined()
    }
  })

  it('veranderen de norm niet', () => {
    // "2 dozen achter in de kiosk" hoort bij de vijf die er staan; het zijn er
    // geen zeven.
    const norm = (kioskId: string) =>
      demoStandards.find((s) => s.kioskId === kioskId && s.productId === 'bierbeker-05')
        ?.targetQuantityQuarters

    expect(norm('kiosk-401')).toBe(5 * 4)
    expect(norm('kiosk-410')).toBe(4 * 4)
    expect(norm('kiosk-426')).toBe(5 * 4)
  })
})
