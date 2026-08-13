import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QuickQuantityInput } from '../QuickQuantityInput'
import { ProductCountRow } from '../ProductCountRow'
import { calculateRestockQuantity } from '@/domain/counting/calculateRestock'
import { demoProducts } from '@/lib/seed/catalogue'

/**
 * Tellen met snelknoppen.
 *
 * De knoppen zijn alleen een andere manier om dezelfde `onChange` aan te
 * roepen. Wat hier vastligt is dus vooral wat er níet mag veranderen: nul
 * blijft een echte telling, wissen blijft iets anders dan nul, en het
 * bijvuladvies mag niet afhangen van hoe het getal is ingevoerd.
 */

function noop() {}

function setup(props: Partial<React.ComponentProps<typeof QuickQuantityInput>> = {}) {
  const onChange = vi.fn()
  const onClear = vi.fn()

  render(
    <QuickQuantityInput
      value={undefined}
      onChange={onChange}
      onClear={onClear}
      mode="INTEGER"
      max={5}
      targetQuantity={5}
      packagingUnit="zakken"
      {...props}
    />
  )

  return { onChange, onClear, user: userEvent.setup() }
}

const knop = (n: number) => screen.getByRole('button', { name: new RegExp(`^Tel ${n} `) })

describe('snel tellen, hele verpakkingen', () => {
  it('slaat op wat er aangetikt wordt', async () => {
    const { onChange, user } = setup()

    await user.click(knop(4))

    expect(onChange).toHaveBeenCalledWith(4)
  })

  it('toont knoppen van 0 tot en met het maximum', () => {
    setup({ max: 5 })

    for (const n of [0, 1, 2, 3, 4, 5]) {
      expect(knop(n)).toBeVisible()
    }
    expect(screen.queryByRole('button', { name: /^Tel 6 / })).toBeNull()
  })

  it('overschrijft een eerdere waarde', async () => {
    const { onChange, user } = setup({ value: 4 })

    await user.click(knop(5))

    expect(onChange).toHaveBeenCalledWith(5)
  })

  it('markeert de gekozen waarde, en alleen die', () => {
    setup({ value: 4 })

    expect(knop(4)).toHaveAttribute('aria-pressed', 'true')
    expect(knop(3)).toHaveAttribute('aria-pressed', 'false')
    expect(knop(0)).toHaveAttribute('aria-pressed', 'false')
  })

  it('heeft geen halve-knop', () => {
    setup()
    expect(screen.queryByRole('button', { name: /alve verpakking/ })).toBeNull()
  })
})

describe('nul is een echte telling', () => {
  it('stuurt 0 door als waarde en niet als "nog niet geteld"', async () => {
    const { onChange, onClear, user } = setup({ value: undefined })

    await user.click(knop(0))

    // Precies het onderscheid dat de hele telling draagt: 0 betekent "geteld,
    // er ligt niets", en dat is iets anders dan een leeg vakje.
    expect(onChange).toHaveBeenCalledWith(0)
    expect(onClear).not.toHaveBeenCalled()
  })

  it('markeert 0 als gekozen wanneer er nul geteld is', () => {
    setup({ value: 0 })
    expect(knop(0)).toHaveAttribute('aria-pressed', 'true')
  })

  it('laat niets geselecteerd zolang er niet geteld is', () => {
    setup({ value: undefined })

    for (const n of [0, 1, 2, 3, 4, 5]) {
      expect(knop(n)).toHaveAttribute('aria-pressed', 'false')
    }
  })

  it('wist via onClear en niet via een nul', async () => {
    const { onChange, onClear, user } = setup({ value: 3 })

    await user.click(screen.getByRole('button', { name: 'Wissen' }))

    expect(onClear).toHaveBeenCalledOnce()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('biedt geen wissen aan zolang er niets te wissen valt', () => {
    setup({ value: undefined })
    expect(screen.queryByRole('button', { name: 'Wissen' })).toBeNull()
  })
})

describe('snel tellen met halve verpakkingen', () => {
  const half = { mode: 'HALF' as const, max: 6, targetQuantity: 6, packagingUnit: 'dozen' }
  const halveKnop = () => screen.getByRole('button', { name: /alve verpakking/ })

  it('zet een halve op een heel getal', async () => {
    const { onChange, user } = setup({ ...half, value: 4 })

    await user.click(halveKnop())

    expect(onChange).toHaveBeenCalledWith(4.5)
  })

  it('haalt de halve er weer af', async () => {
    const { onChange, user } = setup({ ...half, value: 4.5 })

    await user.click(halveKnop())

    expect(onChange).toHaveBeenCalledWith(4)
  })

  it('begint op een halve wanneer er nog niet geteld is', async () => {
    const { onChange, user } = setup({ ...half, value: undefined })

    await user.click(halveKnop())

    expect(onChange).toHaveBeenCalledWith(0.5)
  })

  it('werkt ook buiten het bereik van de knoppen', async () => {
    // 8,5 komt uit het handmatige veld; de halve-knop hoort daar gewoon op te
    // werken en niet stilletjes naar het knoppenbereik terug te springen.
    const { onChange, user } = setup({ ...half, value: 8.5 })

    await user.click(halveKnop())

    expect(onChange).toHaveBeenCalledWith(8)
  })

  it('laat een hele knop de halve vervangen', async () => {
    const { onChange, user } = setup({ ...half, value: 4.5 })

    await user.click(knop(3))

    expect(onChange).toHaveBeenCalledWith(3)
  })

  it('markeert de halve-knop als actief en geen enkele hele knop', () => {
    setup({ ...half, value: 4.5 })

    expect(halveKnop()).toHaveAttribute('aria-pressed', 'true')
    expect(knop(4)).toHaveAttribute('aria-pressed', 'false')
    expect(knop(5)).toHaveAttribute('aria-pressed', 'false')
  })

  it('vertelt in woorden wat er staat zodra geen knop dat doet', () => {
    setup({ ...half, value: 4.5 })
    expect(screen.getByText('Geteld: 4,5 dozen')).toBeVisible()
  })

  it('zwijgt wanneer de knoppen het al vertellen', () => {
    setup({ ...half, value: 4 })
    expect(screen.queryByText(/^Geteld:/)).toBeNull()
  })
})

describe('meer invoeren', () => {
  it('toont het bestaande invoerveld pas op verzoek', async () => {
    const { user } = setup()

    expect(screen.queryByRole('textbox')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Meer invoeren' }))

    expect(screen.getByRole('textbox')).toBeVisible()
  })

  it('gebruikt hetzelfde onChange als de knoppen', async () => {
    const { onChange, user } = setup({ mode: 'HALF', max: 6, targetQuantity: 6 })

    await user.click(screen.getByRole('button', { name: 'Meer invoeren' }))
    await user.type(screen.getByRole('textbox'), '8,5')
    await user.tab()

    expect(onChange).toHaveBeenCalledWith(8.5)
  })

  it('klapt vanzelf open wanneer de knoppen de waarde niet kunnen tonen', () => {
    // 8,5 valt buiten 0–6. Zonder het veld zou er een rij knoppen staan waarvan
    // er geen enkele aanstaat, zonder dat te zien is waarom.
    setup({ mode: 'HALF', max: 6, targetQuantity: 6, value: 8.5 })

    expect(screen.getByRole('textbox')).toBeVisible()
  })

  it('klapt ook open bij een kwartverpakking', () => {
    // Kwarten kan de app al; de knoppen kunnen ze niet.
    setup({ mode: 'HALF', max: 6, targetQuantity: 6, value: 2.25 })

    expect(screen.getByRole('textbox')).toBeVisible()
  })

  it('is weer te sluiten', async () => {
    const { user } = setup()

    await user.click(screen.getByRole('button', { name: 'Meer invoeren' }))
    await user.click(screen.getByRole('button', { name: 'Handmatige invoer sluiten' }))

    expect(screen.queryByRole('textbox')).toBeNull()
  })

  it('laat het handmatige veld zijn eigen Vol en Wissen meebrengen', async () => {
    // Twee identieke knoppen onder elkaar is precies het soort ruis waar een
    // teller op moet gaan letten.
    const { user } = setup({ value: 3, targetQuantity: 10 })

    expect(screen.getAllByRole('button', { name: /^Vol \(10\)$/ })).toHaveLength(1)
    await user.click(screen.getByRole('button', { name: 'Meer invoeren' }))

    expect(screen.getAllByRole('button', { name: /^Vol \(10\)$/ })).toHaveLength(1)
    expect(screen.getAllByRole('button', { name: 'Wissen' })).toHaveLength(1)
  })
})

describe('de Vol-knop', () => {
  it('staat er wanneer de norm buiten de knoppen valt', async () => {
    const { onChange, user } = setup({ max: 6, targetQuantity: 10 })

    await user.click(screen.getByRole('button', { name: 'Vol (10)' }))

    expect(onChange).toHaveBeenCalledWith(10)
  })

  it('blijft weg wanneer een knop hetzelfde doet', () => {
    // Norm 5 binnen 0–5: de knop 5 dóet dat al.
    setup({ max: 5, targetQuantity: 5 })
    expect(screen.queryByRole('button', { name: /^Vol / })).toBeNull()
  })
})

describe('door de bestaande telflow heen', () => {
  const chips = demoProducts.find((p) => p.id === 'chips-blauw')!
  const zakken = demoProducts.find((p) => p.id === 'vuilniszakken')!
  const water = demoProducts.find((p) => p.id === 'chaudfontaine-blauw')!

  function renderRow(product = zakken, quarters?: number, target = 20) {
    const onCountChange = vi.fn()
    render(
      <ProductCountRow
        product={product}
        targetQuantityQuarters={target}
        countedQuantityQuarters={quarters}
        onCountChange={onCountChange}
        onCountClear={noop}
      />
    )
    return { onCountChange, user: userEvent.setup() }
  }

  it('geeft de waarde in kwarteenheden door', async () => {
    const { onCountChange, user } = renderRow()

    await user.click(knop(4))

    // Dezelfde omrekening als het handmatige veld: hele verpakkingen naar
    // kwarteenheden, in ProductCountRow en nergens anders.
    expect(onCountChange).toHaveBeenCalledWith('vuilniszakken', 16)
  })

  it('geeft een halve doos als kwarteenheden door', async () => {
    const { onCountChange, user } = renderRow(chips, 16, 24)

    await user.click(screen.getByRole('button', { name: 'Halve verpakking toevoegen' }))

    expect(onCountChange).toHaveBeenCalledWith('chips-blauw', 18)
  })

  it('geeft een halve rol bekers als kwarteenheden door', async () => {
    const beker = demoProducts.find((p) => p.id === 'bierbeker-05')!
    const { onCountChange, user } = renderRow(beker, 8, 20)

    await user.click(screen.getByRole('button', { name: 'Halve verpakking toevoegen' }))

    // 2 rollen plus een halve = 2,5 = tien kwarteenheden.
    expect(onCountChange).toHaveBeenCalledWith('bierbeker-05', 10)
  })

  it('slaat één keer op per tik en niet vaker', async () => {
    // Snelknoppen zijn alleen een andere aanroep van dezelfde flow. Een tweede
    // opslagpad zou hier als een dubbele aanroep opduiken.
    const { onCountChange, user } = renderRow()

    await user.click(knop(4))
    await user.click(knop(5))

    expect(onCountChange.mock.calls).toEqual([
      ['vuilniszakken', 16],
      ['vuilniszakken', 20],
    ])
  })

  it('laat de grote dranken het gewone invoerveld houden', () => {
    renderRow(water, undefined, 100)

    expect(screen.getByRole('textbox')).toBeVisible()
    expect(screen.queryByRole('button', { name: /^Tel 4 / })).toBeNull()
  })

  it('rekent het bijvuladvies uit alsof er getypt was', async () => {
    // Norm 6, geteld 4,5. De invoermethode mag daar niets aan veranderen.
    const { onCountChange, user } = renderRow(chips, 16, 24)

    await user.click(screen.getByRole('button', { name: 'Halve verpakking toevoegen' }))
    const [, quarters] = onCountChange.mock.calls[0]!

    expect(calculateRestockQuantity({ targetQuantity: 6, countedQuantity: quarters / 4 })).toEqual(
      calculateRestockQuantity({ targetQuantity: 6, countedQuantity: 4.5 })
    )
  })

  it('toont de getelde waarde in de kop van de regel', () => {
    renderRow(chips, 18, 24)
    expect(screen.getByText(/aanwezig/)).toHaveTextContent('4,5')
  })
})
