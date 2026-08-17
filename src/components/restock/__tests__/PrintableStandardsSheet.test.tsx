import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import {
  PrintableStandardsSheet,
  type StandardsSheetGroup,
} from '../PrintableStandardsSheet'
import { demoProducts } from '@/lib/seed/catalogue'
import { demoKiosks } from '@/lib/seed/demoData'
import { toQuarterUnits } from '@/lib/quarterUnits'

/**
 * De bestellijst: wat de kiosk voert, met de norm voorgedrukt en een lege kolom
 * om in te vullen wat er moet komen.
 *
 * Dit is het papier waar de oude bestellijsten op leken, en het bestaat los van
 * een vulronde — ook als er niets geteld is en niets bij te vullen valt.
 */

const kioskById = (id: string) => demoKiosks.find((k) => k.id === id)
const product = (id: string) => demoProducts.find((p) => p.id === id)!

function group(categoryName: string, rows: Array<[string, number]>): StandardsSheetGroup {
  return {
    categoryName,
    rows: rows.map(([productId, packages]) => ({
      product: product(productId),
      targetQuantityQuarters: toQuarterUnits(packages),
    })),
  }
}

function renderSheet(
  overrides: Partial<Parameters<typeof PrintableStandardsSheet>[0]> = {}
) {
  return render(
    <PrintableStandardsSheet
      kiosk={kioskById('kiosk-401')}
      groups={[
        group('Chips', [
          ['chips-blauw', 6],
          ['chips-rood', 6],
        ]),
        group('Post-mix', [['cola', 4]]),
      ]}
      index={0}
      totalSheets={23}
      subtitle="StockFlow — Bestellijst · Ajax – FC Sion · 27 augustus 2026"
      {...overrides}
    />
  )
}

describe('PrintableStandardsSheet', () => {
  it('zet de norm bij ieder artikel', () => {
    renderSheet()

    expect(screen.getByRole('columnheader', { name: 'Artikel' })).toBeDefined()
    expect(screen.getByRole('columnheader', { name: 'Standaard' })).toBeDefined()
    expect(screen.getByText('Chips Blauw')).toBeDefined()
    expect(screen.getAllByText('6 dozen')).toHaveLength(2)
    expect(screen.getByText('4 pakken')).toBeDefined()
  })

  it('houdt een lege kolom om te bestellen', () => {
    renderSheet()

    expect(screen.getByRole('columnheader', { name: 'Bestellen' })).toBeDefined()

    const rij = screen.getByText('Chips Blauw').closest('tr')!
    const cellen = within(rij).getAllByRole('cell')
    expect(cellen).toHaveLength(3)
    expect(cellen[2]!.textContent).toBe('')
  })

  it('groepeert per soort product, zoals de papieren lijst', () => {
    renderSheet()

    expect(screen.getByRole('columnheader', { name: 'Chips' })).toBeDefined()
    expect(screen.getByRole('columnheader', { name: 'Post-mix' })).toBeDefined()
  })

  it('gebruikt de verpakkingseenheid en niet wat de kiosk telt', () => {
    // Bacardi telt blikjes maar komt per tray; op een bestellijst hoort te
    // staan wat je bestelt.
    renderSheet({ groups: [group('Drank', [['bacardi-lemon', 1]])] })

    expect(screen.getByText('1 tray')).toBeDefined()
  })

  it('noemt een bijzondere locatie bij zijn eigen naam', () => {
    renderSheet({ kiosk: kioskById('kiosk-ziggo-platform') })

    expect(screen.getByRole('heading', { name: 'ZIGGO PLATFORM' })).toBeDefined()
  })

  it('nummert de bladen', () => {
    renderSheet({ index: 6, totalSheets: 23 })

    expect(screen.getByText(/blad 7 van 23/)).toBeDefined()
  })

  it('toont de opslagnotitie bij het artikel', () => {
    renderSheet({ groups: [group('Bierbekers', [['bierbeker-05', 5]])] })

    expect(screen.getByText(/2 dozen achter in de kiosk/)).toBeDefined()
  })

  it('houdt ruimte voor een storing en een naam', () => {
    renderSheet()

    expect(screen.getByText('Storing / opmerking')).toBeDefined()
    expect(screen.getByText(/Naam:/)).toBeDefined()
  })

  it('meldt het eerlijk als een kiosk geen normen heeft', () => {
    renderSheet({ groups: [] })

    expect(screen.getByText(/geen normen ingesteld/)).toBeDefined()
  })

  it('perst de regels samen bij een volle kiosk', () => {
    const veel = demoProducts.slice(0, 35).map((p) => [p.id, 1] as [string, number])
    const { container } = renderSheet({
      kiosk: kioskById('kiosk-402'),
      groups: [group('Alles', veel)],
    })

    expect(container.querySelector('.print-kiosk-page--dense')).not.toBeNull()
  })
})
