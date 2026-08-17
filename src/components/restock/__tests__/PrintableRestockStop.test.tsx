import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { PrintableRestockStop } from '../PrintableRestockStop'
import { demoProducts } from '@/lib/seed/catalogue'
import { demoKiosks, demoStandards } from '@/lib/seed/demoData'
import { fromQuarterUnits } from '@/lib/quarterUnits'
import type { Product, RestockRoundStop, RestockStopItem } from '@/types'

/**
 * De papieren vullijst.
 *
 * Wat hier misgaat merkt niemand op een scherm: het rolt uit de printer, gaat
 * de vloer op, en dan blijkt een kiosk "Kiosk 4300" te heten of staat er
 * "1 blikje" waar een tray bedoeld werd.
 */

const products = new Map<string, Product>(demoProducts.map((p) => [p.id, p]))
const categoryNames = new Map(demoProducts.map((p) => [p.categoryId, 'Chips']))
const kioskById = (id: string) => demoKiosks.find((k) => k.id === id)

function stop(id = 'stop-1', kioskId = 'kiosk-401'): RestockRoundStop {
  return { id, restockRoundId: 'ronde-1', kioskId, sortOrder: 0 }
}

function item(productId: string, plannedPackages: number, stopId = 'stop-1'): RestockStopItem {
  return {
    id: `item-${stopId}-${productId}`,
    restockRoundStopId: stopId,
    productId,
    plannedPackages,
    createdAt: '',
  }
}

/** De echte normen van een kiosk, in hele verpakkingen. */
function standardsFor(kioskId: string): Map<string, number> {
  return new Map(
    demoStandards
      .filter((standard) => standard.kioskId === kioskId)
      .map((standard) => [
        standard.productId,
        fromQuarterUnits(standard.targetQuantityQuarters),
      ])
  )
}

function renderStop(overrides: Partial<Parameters<typeof PrintableRestockStop>[0]> = {}) {
  return render(
    <PrintableRestockStop
      stop={stop()}
      stopItems={[item('chips-blauw', 3)]}
      products={products}
      categoryNames={categoryNames}
      standards={standardsFor('kiosk-401')}
      kiosk={kioskById('kiosk-401')}
      index={0}
      totalStops={3}
      previousKiosk={undefined}
      nextKiosk={kioskById('kiosk-403')}
      roundName="StockFlow — Vullijst · Ajax – FC Sion"
      {...overrides}
    />
  )
}

describe('PrintableRestockStop', () => {
  it('toont productnaam en gepland aantal met de juiste eenheid', () => {
    renderStop({ stopItems: [item('chips-blauw', 3)] })

    expect(screen.getByText('Chips Blauw')).toBeDefined()
    expect(screen.getByText('3 dozen')).toBeDefined()
  })

  it('gebruikt de volledige naam en niet de afkorting', () => {
    // "Bac. Lime" past op een telefoon; op papier hoort te staan wat er op de
    // doos staat.
    renderStop({ stopItems: [item('bacardi-lemon', 2)] })

    expect(screen.getByText('Bacardi Lime & Lemonade')).toBeDefined()
    expect(screen.queryByText('Bac. Lime')).toBeNull()
  })

  it('rekent in verpakkingen en niet in wat de kiosk telt', () => {
    // Bacardi wordt per tray geleverd; "1 blikje" stuurt iemand met één blikje
    // op pad.
    renderStop({ stopItems: [item('bacardi-lemon', 1)] })

    expect(screen.getByText('1 tray')).toBeDefined()
  })

  it('toont alleen de regels van deze halte', () => {
    // De pagina filtert op stop-id; hier hoort niets van een andere halte te
    // kunnen binnenkomen.
    renderStop({ stopItems: [item('chips-blauw', 3), item('chips-rood', 1)] })

    const rijen = screen.getAllByRole('row')
    // Eén koprij plus twee productregels.
    expect(rijen).toHaveLength(3)
    expect(screen.queryByText('Chips Oranje')).toBeNull()
  })

  it('laat een regel met nul gepland weg', () => {
    // Dit is een vullijst, geen tellijst: nul betekent er hoeft niets heen.
    renderStop({ stopItems: [item('chips-blauw', 3), item('chips-rood', 0)] })

    expect(screen.getByText('Chips Blauw')).toBeDefined()
    expect(screen.queryByText('Chips Rood')).toBeNull()
  })

  it('noemt een bijzondere locatie bij zijn eigen naam', () => {
    // Niet "KIOSK 4300": op de vloer heet dit Ziggo Platform.
    renderStop({ kiosk: kioskById('kiosk-ziggo-platform') })

    expect(screen.getByRole('heading', { name: 'ZIGGO PLATFORM' })).toBeDefined()
    expect(screen.queryByText(/4300/)).toBeNull()
  })

  it('toont het stopnummer, zodat een ontbrekend vel opvalt', () => {
    renderStop({ index: 6, totalStops: 18 })

    expect(screen.getByText('Stop 7 van 18')).toBeDefined()
  })

  it('zet de opslagnotitie onder de productnaam', () => {
    // 401 heeft twee dozen bekers achterin staan; zonder die zin zoekt de
    // vuller ernaar of vult hij te veel bij.
    renderStop({ stopItems: [item('bierbeker-05', 2)] })

    expect(screen.getByText(/2 dozen achter in de kiosk/)).toBeDefined()
  })

  it('zet de norm naast het te vullen aantal', () => {
    // Zo is op de vloer te zien of het plan klopt met wat er hoort te staan.
    // 401 voert Chips Blauw op zes dozen; er staan er drie gepland.
    renderStop({ stopItems: [item('chips-blauw', 3)] })

    expect(screen.getByRole('columnheader', { name: 'Standaard' })).toBeDefined()
    expect(screen.getByText('6 dozen')).toBeDefined()
    expect(screen.getByText('3 dozen')).toBeDefined()
  })

  it('laat de norm leeg als die er niet is, in plaats van er een te verzinnen', () => {
    renderStop({ stopItems: [item('chips-blauw', 3)], standards: new Map() })

    const cellen = within(screen.getAllByRole('row')[1]!).getAllByRole('cell')
    expect(cellen[1]!.textContent).toBe('')
  })

  it('geeft iedere regel een lege kolom om het geleverde aantal in te vullen', () => {
    renderStop({ stopItems: [item('chips-blauw', 3)] })

    expect(screen.getByRole('columnheader', { name: 'Geleverd' })).toBeDefined()

    const rijen = screen.getAllByRole('row')
    const cellen = within(rijen[1]!).getAllByRole('cell')
    expect(cellen).toHaveLength(4)
    expect(cellen[3]!.textContent).toBe('')
  })

  it('heeft een vinkje voor "alles geleverd zoals gepland"', () => {
    renderStop()

    expect(screen.getByText('Alles geleverd zoals gepland')).toBeDefined()
  })

  it('houdt ruimte voor opmerkingen en de naam van de vuller', () => {
    renderStop()

    expect(screen.getByText('Opmerking / afwijking')).toBeDefined()
    expect(screen.getByText(/Naam vuller:/)).toBeDefined()
  })

  it('drukt de naam van de vuller voor wanneer die bekend is', () => {
    renderStop({ assignedUserName: 'Robert Geurs' })

    expect(screen.getByText('Robert Geurs')).toBeDefined()
  })

  it('wijst op de vorige en volgende kiosk van de route', () => {
    renderStop({
      index: 1,
      totalStops: 3,
      previousKiosk: kioskById('kiosk-401'),
      nextKiosk: kioskById('kiosk-407'),
    })

    expect(screen.getByText('Vorige: Kiosk 401')).toBeDefined()
    expect(screen.getByText(/Volgende:\s*Kiosk 407/)).toBeDefined()
  })

  it('meldt bij de eerste en laatste pagina het begin en einde van de ronde', () => {
    const { unmount } = renderStop({ index: 0, totalStops: 2 })
    expect(screen.getByText('Vorige: Start')).toBeDefined()
    unmount()

    renderStop({ index: 1, totalStops: 2, previousKiosk: kioskById('kiosk-401') })
    expect(screen.getByText(/Volgende:\s*Einde ronde/)).toBeDefined()
  })

  it('blijft ruim bij een gewone hoeveelheid producten', () => {
    const { container } = renderStop({ stopItems: [item('chips-blauw', 3)] })

    expect(container.querySelector('.print-kiosk-page')).not.toBeNull()
    expect(container.querySelector('.print-kiosk-page--compact')).toBeNull()
    expect(container.querySelector('.print-kiosk-page--dense')).toBeNull()
  })

  it('zet de regels dichter op elkaar bij veel producten', () => {
    // Liever een volle pagina dan een tweede vel voor dezelfde kiosk: zo'n
    // tweede vel raakt tussen de andere kiosken zoek.
    const { container } = renderStop({
      kiosk: kioskById('kiosk-402'),
      stopItems: demoProducts.slice(0, 20).map((p) => item(p.id, 1)),
    })

    expect(container.querySelector('.print-kiosk-page--compact')).not.toBeNull()
  })

  it('gaat naar het dichtste niveau bij een volle kiosk', () => {
    // De ruimste kiosk voert 42 producten; die moeten er alle 42 op.
    const { container } = renderStop({
      kiosk: kioskById('kiosk-402'),
      stopItems: demoProducts.slice(0, 35).map((p) => item(p.id, 1)),
    })

    expect(container.querySelector('.print-kiosk-page--dense')).not.toBeNull()
  })

  it('telt een opslagnotitie mee als extra regel', () => {
    // Een notitie staat op een tweede regel onder de productnaam. Wie alleen
    // producten telt laat een kiosk vol notities alsnog over de rand lopen:
    // hier zijn tien producten twintig regels.
    const { container } = renderStop({
      kiosk: kioskById('kiosk-401'),
      stopItems: demoProducts.slice(0, 10).map((p) => item(p.id, 1)),
    })

    expect(container.querySelectorAll('.print-storage-note')).toHaveLength(10)
    expect(container.querySelector('.print-kiosk-page--compact')).not.toBeNull()
  })
})
