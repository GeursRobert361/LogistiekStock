import { describe, it, expect } from 'vitest'
import {
  storageNotes,
  storageNoteFor,
  categoryStorageNotes,
  categoryStorageNoteFor,
} from '../storageNotes'
import { demoKiosks, demoStandards } from '@/lib/seed/demoData'
import { demoProducts, demoCategories } from '@/lib/seed/catalogue'

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

describe('categoryStorageNoteFor', () => {
  it('vindt de opmerking van deze categorie bij deze kiosk', () => {
    expect(categoryStorageNoteFor({ number: 426 }, 'Chips')).toBe(
      '3 op de plank, onder elk luik 1 doos'
    )
    expect(categoryStorageNoteFor({ number: 427 }, 'Chips')).toBe('Onder de balie, 3 per vakje')
    expect(categoryStorageNoteFor({ number: 406 }, 'Post-mix')).toBe(
      'In het hok links van de kiosk'
    )
  })

  it('houdt de categorieën uit elkaar', () => {
    // 406 Oud heeft een opmerking bij de Post-mix, niet bij de chips van
    // datzelfde nummer — daar staat een andere.
    expect(categoryStorageNoteFor({ number: 406 }, 'Chips')).toBe(
      '3 dozen op het kratje, rest onder de balie'
    )
    expect(categoryStorageNoteFor({ number: 426 }, 'Post-mix')).toBeUndefined()
  })

  it('zwijgt bij een kiosk of categorie zonder opmerking', () => {
    expect(categoryStorageNoteFor({ number: 402 }, 'Chips')).toBeUndefined()
    expect(categoryStorageNoteFor({ number: 426 }, 'Bierbekers')).toBeUndefined()
    expect(categoryStorageNoteFor(null, 'Chips')).toBeUndefined()
    expect(categoryStorageNoteFor({ number: 426 }, undefined)).toBeUndefined()
  })
})

describe('de categorie-opmerkingen zelf', () => {
  it('verwijzen naar bestaande kiosken', () => {
    const nummers = new Set(demoKiosks.map((k) => k.number))
    for (const note of categoryStorageNotes) {
      expect(nummers.has(note.kioskNumber), String(note.kioskNumber)).toBe(true)
    }
  })

  it('verwijzen naar bestaande categorienamen', () => {
    const namen = new Set(demoCategories.map((c) => c.name))
    for (const note of categoryStorageNotes) {
      expect(namen.has(note.categoryName), note.categoryName).toBe(true)
    }
  })

  it('horen bij een categorie die die kiosk ook werkelijk voert', () => {
    // Een opmerking bij een categorie zonder normen zou nooit op het scherm
    // komen.
    const categorieVanProduct = new Map(demoProducts.map((p) => [p.id, p.categoryId]))
    const naamVanCategorie = new Map(demoCategories.map((c) => [c.id, c.name]))

    for (const note of categoryStorageNotes) {
      const kiosk = demoKiosks.find((k) => k.number === note.kioskNumber)!
      const categorieën = new Set(
        demoStandards
          .filter((s) => s.kioskId === kiosk.id)
          .map((s) => naamVanCategorie.get(categorieVanProduct.get(s.productId) ?? ''))
      )

      expect(
        categorieën.has(note.categoryName),
        `${note.kioskNumber} ${note.categoryName}`
      ).toBe(true)
    }
  })

  it('veranderen de norm niet', () => {
    // "onder elk luik 1 doos" zegt waar de dozen liggen, niet dat er dozen bij
    // moeten. 426 Chips Blauw blijft dus 6.
    const norm = (kioskId: string, productId: string) =>
      demoStandards.find((s) => s.kioskId === kioskId && s.productId === productId)
        ?.targetQuantityQuarters

    expect(norm('kiosk-426', 'chips-blauw')).toBe(6 * 4)
    expect(norm('kiosk-401', 'chips-blauw')).toBe(6 * 4)
    expect(norm('kiosk-406', 'cola-zero')).toBe(4 * 4)
  })
})
