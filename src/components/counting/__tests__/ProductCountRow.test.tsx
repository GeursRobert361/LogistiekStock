import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ProductCountRow } from '../ProductCountRow'
import { CategoryAccordion } from '../CategoryAccordion'
import { demoProducts } from '@/lib/seed/catalogue'
import { buildStorageNoteLookup } from '@/lib/storageNotes'
import type { KioskProductStandard, KioskStorageNote } from '@/types'

/**
 * De opmerking over waar de voorraad ligt, tijdens het tellen.
 *
 * Wie alleen vooraan kijkt telt te weinig en laat de kiosk daarna te vol
 * bijvullen. De tekst hoort dus op het scherm te staan waar geteld wordt, niet
 * alleen op dat van de vuller.
 */

const beker = demoProducts.find((p) => p.id === 'bierbeker-05')!
const chips = demoProducts.find((p) => p.id === 'chips-blauw')!
const chipsRood = demoProducts.find((p) => p.id === 'chips-rood')!
const chipsOranje = demoProducts.find((p) => p.id === 'chips-oranje')!
const cola = demoProducts.find((p) => p.id === 'cola')!

function noop() {}

function standard(productId: string, quarters: number): KioskProductStandard {
  return {
    id: `std-${productId}`,
    kioskId: 'kiosk-401',
    productId,
    targetQuantityQuarters: quarters,
    halfPackageThresholdPercentage: 80,
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  }
}

/** De opmerkingen zoals ze uit de database komen. */
function note(fields: Partial<KioskStorageNote> & { id: string }): KioskStorageNote {
  return {
    kioskId: 'kiosk-401',
    note: 'ergens',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...fields,
  }
}

const storageNotes = buildStorageNoteLookup([
  note({
    id: 'n1',
    kioskId: 'kiosk-401',
    productId: 'bierbeker-05',
    note: '2 dozen achter in de kiosk',
  }),
  note({
    id: 'n2',
    kioskId: 'kiosk-426',
    categoryId: 'cat-chips',
    note: '3 op de plank, onder elk luik 1 doos',
  }),
])

describe('ProductCountRow', () => {
  it('toont de opmerking bij het product', () => {
    render(
      <ProductCountRow
        product={beker}
        targetQuantityQuarters={20}
        countedQuantityQuarters={undefined}
        onCountChange={noop}
        onCountClear={noop}
        storageNote="2 dozen achter in de kiosk"
      />
    )

    expect(screen.getByText('2 dozen achter in de kiosk')).toBeVisible()
  })

  it('laat de regel met rust wanneer er niets te melden is', () => {
    render(
      <ProductCountRow
        product={beker}
        targetQuantityQuarters={20}
        countedQuantityQuarters={undefined}
        onCountChange={noop}
        onCountClear={noop}
      />
    )

    expect(screen.queryByText(/achter in de kiosk/)).toBeNull()
  })

  it('houdt de opmerking in beeld nadat er geteld is', () => {
    // Bij het nakijken van een telling is dit juist de verklaring waarom het
    // aantal hoger ligt dan wat er vooraan staat.
    render(
      <ProductCountRow
        product={beker}
        targetQuantityQuarters={20}
        countedQuantityQuarters={12}
        onCountChange={noop}
        onCountClear={noop}
        storageNote="2 dozen achter in de kiosk"
      />
    )

    expect(screen.getByText('2 dozen achter in de kiosk')).toBeVisible()
  })
})

describe('CategoryAccordion', () => {
  it('haalt de opmerking op bij de kiosk die geteld wordt', () => {
    render(
      <CategoryAccordion
        categoryName="Bierbekers"
        categoryId="cat-bierbekers"
        products={[beker, chips]}
        kioskId="kiosk-401"
        storageNotes={storageNotes}
        standards={
          new Map([
            [beker.id, standard(beker.id, 20)],
            [chips.id, standard(chips.id, 28)],
          ])
        }
        counts={new Map()}
        onCountChange={noop}
        onCountClear={noop}
      />
    )

    // Alleen bij de bekers, niet bij de chips van dezelfde kiosk.
    expect(screen.getByText('2 dozen achter in de kiosk')).toBeVisible()
    expect(screen.getAllByText(/achter in de kiosk/)).toHaveLength(1)
  })

  it('zwijgt bij een kiosk zonder opmerkingen', () => {
    render(
      <CategoryAccordion
        categoryName="Bierbekers"
        categoryId="cat-bierbekers"
        products={[beker]}
        kioskId="kiosk-402"
        storageNotes={storageNotes}
        standards={new Map([[beker.id, standard(beker.id, 4)]])}
        counts={new Map()}
        onCountChange={noop}
        onCountClear={noop}
      />
    )

    expect(screen.queryByText(/achter in de kiosk/)).toBeNull()
  })

  it('toont de opmerking over een hele categorie één keer', () => {
    render(
      <CategoryAccordion
        categoryName="Chips"
        categoryId="cat-chips"
        products={[chips, chipsRood, chipsOranje]}
        kioskId="kiosk-426"
        storageNotes={storageNotes}
        standards={
          new Map([
            [chips.id, standard(chips.id, 24)],
            [chipsRood.id, standard(chipsRood.id, 24)],
            [chipsOranje.id, standard(chipsOranje.id, 24)],
          ])
        }
        counts={new Map()}
        onCountChange={noop}
        onCountClear={noop}
      />
    )

    // Eén keer boven de categorie, en niet drie keer onder elke smaak.
    expect(screen.getAllByText('3 op de plank, onder elk luik 1 doos')).toHaveLength(1)
  })

  it('toont bij Post-mix hoe er geteld moet worden', () => {
    // De reservepakken buiten het rek, niet het pak aan de tap. Wie dat niet
    // weet telt er bij elke Post-mixkiosk structureel één te veel.
    render(
      <CategoryAccordion
        categoryName="Post-mix"
        categoryId="cat-postmix"
        products={[cola]}
        kioskId="kiosk-401"
        storageNotes={storageNotes}
        standards={new Map([[cola.id, standard(cola.id, 16)]])}
        counts={new Map()}
        onCountChange={noop}
        onCountClear={noop}
      />
    )

    expect(screen.getByText(/reservepakken buiten het rek/)).toBeVisible()
    expect(screen.getByText(/25%/)).toBeVisible()
    expect(screen.getByText(/FIFO/)).toBeVisible()
  })

  it('laat de telinstructie weg bij een categorie die er geen heeft', () => {
    render(
      <CategoryAccordion
        categoryName="Chips"
        categoryId="cat-chips"
        products={[chips]}
        kioskId="kiosk-402"
        storageNotes={storageNotes}
        standards={new Map([[chips.id, standard(chips.id, 8)]])}
        counts={new Map()}
        onCountChange={noop}
        onCountClear={noop}
      />
    )

    expect(screen.queryByText(/Zo tel je/)).toBeNull()
  })
})
