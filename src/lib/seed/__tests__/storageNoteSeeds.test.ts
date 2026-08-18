import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { productStorageNoteSeeds, categoryStorageNoteSeeds } from '../storageNoteSeeds'
import { demoKiosks, demoStandards } from '@/lib/seed/demoData'
import { demoProducts, demoCategories } from '@/lib/seed/catalogue'

/**
 * De opmerkingen zoals ze de eerste keer de database in gaan.
 *
 * Ze staan op twee plekken: hier als lijst, en als `values`-blok in migratie
 * 014 die ze in productie plant. Twee plekken die uit elkaar kunnen lopen is
 * precies het soort fout dat pas op een wedstrijddag opvalt — een vuller die
 * naar dozen zoekt waarvan het briefje verdwenen is. Daarom vergelijkt de test
 * onderaan het blok in de migratie regel voor regel met deze lijst.
 */

const MIGRATION = join(process.cwd(), 'db', 'migrations', '014_kiosk_storage_notes.sql')

/**
 * Een regel uit het `values`-blok van de migratie.
 *
 * De eerste regel draagt `::text`-casts, zodat Postgres de kolomtypes niet uit
 * een kolom vol `null` hoeft te raden. Die casts mogen er dus staan.
 */
const CAST = /(?:::text)?/.source
const LITERAL = `(null|'[^']*')${CAST}`
const SEED_ROW = new RegExp(`^\\s*\\((\\d+),\\s*${LITERAL},\\s*${LITERAL},\\s*${LITERAL}\\),?\\s*$`)

interface MigrationRow {
  kioskNumber: number
  productName: string | null
  categoryName: string | null
  note: string
}

/** `'Chips'` wordt Chips, `null` wordt null. */
const unquote = (literal: string): string | null =>
  literal === 'null' ? null : literal.slice(1, -1)

function rowsFromMigration(): MigrationRow[] {
  const sql = readFileSync(MIGRATION, 'utf8')

  return sql
    .split('\n')
    .map((line) => SEED_ROW.exec(line))
    .filter((match): match is RegExpExecArray => match !== null)
    .map((match) => ({
      kioskNumber: Number(match[1]),
      productName: unquote(match[2]!),
      categoryName: unquote(match[3]!),
      note: unquote(match[4]!) ?? '',
    }))
}

describe('de opmerkingen bij een product', () => {
  it('verwijzen naar bestaande kiosken', () => {
    const nummers = new Set(demoKiosks.map((k) => k.number))
    for (const seed of productStorageNoteSeeds) {
      expect(nummers.has(seed.kioskNumber), String(seed.kioskNumber)).toBe(true)
    }
  })

  it('verwijzen naar bestaande productnamen', () => {
    const namen = new Set(demoProducts.map((p) => p.name))
    for (const seed of productStorageNoteSeeds) {
      expect(namen.has(seed.productName), seed.productName).toBe(true)
    }
  })

  it('horen bij een product dat die kiosk ook werkelijk voert', () => {
    // Een opmerking bij een product zonder norm zou nooit op het scherm komen.
    for (const seed of productStorageNoteSeeds) {
      const kiosk = demoKiosks.find((k) => k.number === seed.kioskNumber)!
      const product = demoProducts.find((p) => p.name === seed.productName)!
      const standard = demoStandards.find(
        (s) => s.kioskId === kiosk.id && s.productId === product.id
      )

      expect(standard, `${seed.kioskNumber} ${seed.productName}`).toBeDefined()
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

describe('de opmerkingen bij een categorie', () => {
  it('verwijzen naar bestaande kiosken', () => {
    const nummers = new Set(demoKiosks.map((k) => k.number))
    for (const seed of categoryStorageNoteSeeds) {
      expect(nummers.has(seed.kioskNumber), String(seed.kioskNumber)).toBe(true)
    }
  })

  it('verwijzen naar bestaande categorienamen', () => {
    const namen = new Set(demoCategories.map((c) => c.name))
    for (const seed of categoryStorageNoteSeeds) {
      expect(namen.has(seed.categoryName), seed.categoryName).toBe(true)
    }
  })

  it('horen bij een categorie die die kiosk ook werkelijk voert', () => {
    const categorieVanProduct = new Map(demoProducts.map((p) => [p.id, p.categoryId]))
    const naamVanCategorie = new Map(demoCategories.map((c) => [c.id, c.name]))

    for (const seed of categoryStorageNoteSeeds) {
      const kiosk = demoKiosks.find((k) => k.number === seed.kioskNumber)!
      const categorieën = new Set(
        demoStandards
          .filter((s) => s.kioskId === kiosk.id)
          .map((s) => naamVanCategorie.get(categorieVanProduct.get(s.productId) ?? ''))
      )

      expect(categorieën.has(seed.categoryName), `${seed.kioskNumber} ${seed.categoryName}`).toBe(
        true
      )
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

describe('de migratie die ze plant', () => {
  it('plant precies de opmerkingen uit deze lijst', () => {
    const verwacht: MigrationRow[] = [
      ...productStorageNoteSeeds.map((seed) => ({
        kioskNumber: seed.kioskNumber,
        productName: seed.productName,
        categoryName: null,
        note: seed.note,
      })),
      ...categoryStorageNoteSeeds.map((seed) => ({
        kioskNumber: seed.kioskNumber,
        productName: null,
        categoryName: seed.categoryName,
        note: seed.note,
      })),
    ]

    expect(rowsFromMigration()).toEqual(verwacht)
  })

  it('noemt bij elke regel een product of een categorie, nooit allebei', () => {
    for (const row of rowsFromMigration()) {
      const genoemd = [row.productName, row.categoryName].filter((name) => name !== null)
      expect(genoemd, `${row.kioskNumber} ${row.note}`).toHaveLength(1)
    }
  })
})
