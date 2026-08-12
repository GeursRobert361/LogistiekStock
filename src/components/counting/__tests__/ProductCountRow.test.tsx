import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ProductCountRow } from '../ProductCountRow'
import { CategoryAccordion } from '../CategoryAccordion'
import { demoProducts } from '@/lib/seed/catalogue'
import type { KioskProductStandard } from '@/types'

/**
 * De opmerking over waar de voorraad ligt, tijdens het tellen.
 *
 * Wie alleen vooraan kijkt telt te weinig en laat de kiosk daarna te vol
 * bijvullen. De tekst hoort dus op het scherm te staan waar geteld wordt, niet
 * alleen op dat van de vuller.
 */

const beker = demoProducts.find((p) => p.id === 'bierbeker-05')!
const chips = demoProducts.find((p) => p.id === 'chips-blauw')!

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
        products={[beker, chips]}
        kiosk={{ number: 401 }}
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
        products={[beker]}
        kiosk={{ number: 402 }}
        standards={new Map([[beker.id, standard(beker.id, 4)]])}
        counts={new Map()}
        onCountChange={noop}
        onCountClear={noop}
      />
    )

    expect(screen.queryByText(/achter in de kiosk/)).toBeNull()
  })
})
