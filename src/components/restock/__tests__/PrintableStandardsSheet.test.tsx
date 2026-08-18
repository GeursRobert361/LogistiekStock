import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { PrintableStandardsSheet, type StandardsSheetGroup } from '../PrintableStandardsSheet'
import { demoProducts, demoCategories } from '@/lib/seed/catalogue'
import { demoKiosks, demoStorageNotes } from '@/lib/seed/demoData'
import { buildStorageNoteLookup } from '@/lib/storageNotes'
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

const storageNotes = buildStorageNoteLookup(demoStorageNotes)

function group(
  categoryName: string,
  rows: Array<[string, number] | [string, number, number]>
): StandardsSheetGroup {
  return {
    categoryName,
    // Het id hoort bij de naam; de opmerkingen gaan op id. Een verzonnen
    // categorie (de indelingstests gebruiken die) krijgt een verzonnen id.
    categoryId: demoCategories.find((c) => c.name === categoryName)?.id ?? `cat-${categoryName}`,
    rows: rows.map(([productId, packages, restockPackages]) => ({
      product: product(productId),
      targetQuantityQuarters: toQuarterUnits(packages),
      restockPackages,
    })),
  }
}

function renderSheet(overrides: Partial<Parameters<typeof PrintableStandardsSheet>[0]> = {}) {
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
      storageNotes={storageNotes}
      {...overrides}
    />
  )
}

describe('PrintableStandardsSheet', () => {
  it('zet de norm bij ieder artikel', () => {
    renderSheet()

    expect(screen.getAllByRole('columnheader', { name: 'Artikel' }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('columnheader', { name: 'Standaard' }).length).toBeGreaterThan(0)
    expect(screen.getByText('Chips Blauw')).toBeDefined()
    expect(screen.getAllByText('6 dozen')).toHaveLength(2)
    expect(screen.getByText('4 pakken')).toBeDefined()
  })

  it('houdt de kolom "Vullen" leeg zolang er niet geteld is', () => {
    renderSheet()

    expect(screen.getAllByRole('columnheader', { name: 'Vullen' }).length).toBeGreaterThan(0)

    const rij = screen.getByText('Chips Blauw').closest('tr')!
    const cellen = within(rij).getAllByRole('cell')
    expect(cellen).toHaveLength(3)
    expect(cellen[2]!.textContent).toBe('')
  })

  it('vult het aantal in zodra de telling er is', () => {
    // Norm zes dozen, er stonden er nog twee: dan moeten er vier bij.
    renderSheet({ groups: [group('Chips', [['chips-blauw', 6, 4]])] })

    const rij = screen.getByText('Chips Blauw').closest('tr')!
    const cellen = within(rij).getAllByRole('cell')
    expect(cellen[1]!.textContent).toBe('6 dozen')
    expect(cellen[2]!.textContent).toBe('4 dozen')
  })

  it('laat het vakje leeg wanneer er niets bij hoeft', () => {
    // Nul is geen opdracht; een lege regel leest sneller dan een rij nullen.
    renderSheet({ groups: [group('Chips', [['chips-blauw', 6, 0]])] })

    const rij = screen.getByText('Chips Blauw').closest('tr')!
    expect(within(rij).getAllByRole('cell')[2]!.textContent).toBe('')
  })

  it('geeft ieder soort product een eigen blokje, zoals de papieren lijst', () => {
    // Losse blokjes met witruimte ertussen, niet één doorlopende tabel: dat is
    // wat de oude lijst leesbaar maakte.
    const { container } = renderSheet()

    const blokken = container.querySelectorAll('.print-block')
    expect(blokken).toHaveLength(2)
    expect(
      [...container.querySelectorAll('.print-block-name')].map((el) => el.textContent)
    ).toEqual(['Chips', 'Post-mix'])
  })

  it('zet de blokjes in twee kolommen naast elkaar', () => {
    const { container } = renderSheet()

    expect(container.querySelector('.print-columns')).not.toBeNull()
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

  it('houdt ruimte voor een storing of opmerking', () => {
    renderSheet()

    expect(screen.getByText('Storing / opmerking')).toBeDefined()
  })

  it('vraagt niet om een naam', () => {
    // Wie de lijst invult is bekend; een naamregel is alleen ruimte kwijt.
    renderSheet()

    expect(screen.queryByText(/Naam/)).toBeNull()
  })

  it('meldt het eerlijk als een kiosk geen normen heeft', () => {
    renderSheet({ groups: [] })

    expect(screen.getByText(/geen normen ingesteld/)).toBeDefined()
  })

  it('perst de blokjes samen bij een volle kiosk', () => {
    // 42 artikelen over acht soorten is de ruimste kiosk die er is; dan moet er
    // ruimte gewonnen worden, maar er blijft niets weg.
    const veel = demoProducts.slice(0, 42)
    const groepen = [0, 1, 2, 3, 4, 5, 6, 7].map((n) =>
      group(
        `Soort ${n}`,
        veel.filter((_, i) => i % 8 === n).map((p) => [p.id, 1] as [string, number])
      )
    )
    const { container } = renderSheet({ kiosk: kioskById('kiosk-402'), groups: groepen })

    expect(container.querySelector('.print-kiosk-page--compact')).not.toBeNull()
    expect(container.querySelectorAll('tbody tr')).toHaveLength(42)
  })
})
