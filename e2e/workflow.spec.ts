import { test, expect, type Page } from '@playwright/test'
import { login, resetAppData, fillAllCounts } from './helpers'

/**
 * De volledige operationele keten in één test: evenement → telronde → review →
 * goedkeuren → vulplanning → pallet laden → afleveren → restant terug in de
 * planning.
 */
/** Ring 1: kiosk 101 t/m 128 plus de cubes tegenover 120. */
const ROUTE_LENGTH = 29

test.describe('Volledige workflow', () => {
  // Deze test loopt de hele keten door en vult per kiosk het volledige
  // assortiment in — ruim veertig producten per kiosk, plus 27 kiosken die
  // stuk voor stuk met een reden worden overgeslagen.
  test.setTimeout(240_000)

  test.beforeEach(async ({ page }) => {
    await resetAppData(page)
    await login(page, 'admin@demo.nl')
  })

  test('van telling tot gedeeltelijke levering en terug in de planning', async ({ page }) => {
    // ── 1. Telronde starten bij kiosk 123, oplopend ────────────────────────
    await page.goto('/events/event-demo-ajax')
    await page.getByRole('button', { name: /telronde starten/i }).click()
    await page.waitForURL(/\/count\/start/)

    await page.getByLabel('Startkiosk').selectOption({ label: 'Kiosk 116' })
    await page.getByRole('button', { name: /Telronde starten/ }).click()
    await page.waitForURL(/\/kiosk\/kiosk-116/)

    await expect(page.getByRole('heading', { level: 2 })).toHaveText('116')
    await expect(page.getByText(/Stop 1 van 29/)).toBeVisible()

    // ── 2. Kiosk 116 tellen: expliciet 0 en een kwartwaarde ────────────────
    await fillAllCounts(page, '1')

    const water = page.locator('#product-chaudfontaine-blauw')
    await water.getByRole('button', { name: '0', exact: true }).click()
    await expect(water.getByText('+15')).toBeVisible()

    const waterInput = water.locator('input[inputmode="decimal"]')
    await waterInput.fill('4,5')
    await waterInput.blur()
    await expect(water.getByText('+11')).toBeVisible()

    await page.getByRole('button', { name: /Kiosk afronden/ }).click()
    await page.waitForURL(/\/kiosk\/kiosk-117/)

    // ── 3. Kiosk 117 tellen ────────────────────────────────────────────────
    await fillAllCounts(page, '2')
    await page.getByRole('button', { name: /Kiosk afronden/ }).click()
    await page.waitForURL(/\/kiosk\/kiosk-118/)

    // ── 4. De rest van de ring bewust overslaan ────────────────────────────
    // Ring 1 telt 29 stops (101–128 plus 120 Cubes); twee zijn er geteld.
    for (let index = 0; index < ROUTE_LENGTH - 2; index++) {
      await skipCurrentKiosk(page)
    }

    // Laatste kiosk afgehandeld → de telronde is ingediend.
    await page.waitForURL(/\/count\/review/)

    // ── 5. Review kent de hele route ───────────────────────────────────────
    await expect(page.getByText('2 van 29 kiosken afgerond')).toBeVisible()
    await expect(page.getByText('Totaal bijvullen')).toBeVisible()

    // ── 6. Goedkeuren ──────────────────────────────────────────────────────
    await expect(page.getByText('Alles opgeslagen')).toBeVisible()
    await page.getByRole('button', { name: /Telling goedkeuren/ }).click()
    await page.getByRole('button', { name: 'Goedkeuren', exact: true }).click()

    await expect(page.getByText(/bijvulregels aangemaakt/)).toBeVisible()

    // ── 7. Vulplanning toont de tekorten ───────────────────────────────────
    await page.goto('/events/event-demo-ajax/restock')
    await expect(page.getByRole('heading', { name: 'Eigen ronde' })).toBeVisible()

    // ── 8. Productronde maken ──────────────────────────────────────────────
    const roundProductName = await page
      .locator('p.font-semibold')
      .filter({ hasText: /\S/ })
      .first()
      .textContent()
    expect(roundProductName).toBeTruthy()

    await page.getByRole('button', { name: 'Productronde maken' }).first().click()
    await page.waitForURL(/\/restock-rounds\//)
    await expect(page.getByRole('heading', { name: 'Pallet laden' })).toBeVisible()

    // ── 9. Werkelijk geladen aantal invullen ───────────────────────────────
    const loadedInput = page.locator('input[inputmode="numeric"]').first()
    const needed = Number(await loadedInput.inputValue())
    expect(needed).toBeGreaterThan(0)
    await loadedInput.fill(String(needed))

    await page.getByRole('button', { name: /Route maken/ }).click()
    const routeHeading = page.getByRole('heading', { name: /Route \(/ })
    await expect(routeHeading).toBeVisible()

    const stopCount = Number(
      /Route \((\d+)/.exec((await routeHeading.textContent()) ?? '')?.[1] ?? '0'
    )
    expect(stopCount).toBeGreaterThan(0)

    // ── 10. Ronde aannemen en starten ──────────────────────────────────────
    await page.getByRole('button', { name: /Ronde aannemen en starten/ }).click()
    await page.waitForURL(/\/stop\//)

    // ── 11. Kiosk voor kiosk afleveren; de eerste bewust gedeeltelijk ──────
    let shortfall = 0

    for (let stopNumber = 1; stopNumber <= stopCount; stopNumber++) {
      await expect(page.getByText(`Stop ${stopNumber} van ${stopCount}`)).toBeVisible()

      if (stopNumber === 1) {
        const plannedText = await page.getByText(/Te leveren:/).first().textContent()
        const planned = Number(/(\d+)/.exec(plannedText ?? '')?.[1] ?? '0')
        expect(planned).toBeGreaterThan(1)
        shortfall = 1

        await page.getByRole('button', { name: 'Anders' }).first().click()
        await page.getByLabel('Geleverd').first().fill(String(planned - shortfall))
        await page
          .getByLabel('Reden van afwijking')
          .selectOption('onvoldoende_magazijnvoorraad')
        await page.getByRole('button', { name: 'Bevestigen' }).click()

        await expect(
          page.getByText(`✓ ${planned - shortfall} van ${planned} geleverd`)
        ).toBeVisible()
      } else {
        await page.getByRole('button', { name: 'Alles geleverd' }).first().click()
        await expect(page.getByText(/van \d+ geleverd/).first()).toBeVisible()
      }

      await page.getByRole('button', { name: /Kiosk klaar/ }).click()

      if (stopNumber === stopCount) {
        await expect(page.getByRole('button', { name: /Vulronde afronden/ })).toBeVisible()
      }
    }

    // ── 12. Ronde afsluiten ────────────────────────────────────────────────
    await page.getByRole('button', { name: /Vulronde afronden/ }).click()
    await page.getByRole('button', { name: 'Afronden', exact: true }).click()
    await expect(page.getByText('Deels geleverd')).toBeVisible()

    // ── 13. Het restant staat weer in de vulplanning ───────────────────────
    await page.goto('/events/event-demo-ajax/restock')

    // Alles is geleverd behalve de bewuste tekortkoming bij de eerste kiosk.
    const remaining = page
      .locator('p.font-semibold')
      .filter({ hasText: roundProductName! })
      .first()
    await expect(remaining).toBeVisible()
    await expect(
      page.getByText(`Totaal: ${shortfall} `, { exact: false }).first()
    ).toBeVisible()

    // ── 14. Het restant zelf oppakken: pallet pakken en meteen rijden ──────
    await page.goto('/restock-rounds/new')
    await page.getByRole('button', { name: new RegExp(roundProductName!) }).click()
    await page.getByRole('button', { name: /Rijden —/ }).click()

    // Geen tussenschermen: van aanvinken direct naar de kiosk.
    await page.waitForURL(/\/stop\//)
    await expect(page.getByText(/Stop 1 van/)).toBeVisible()
  })
})

/** Slaat de kiosk waar we nu staan over, met een reden. */
async function skipCurrentKiosk(page: Page): Promise<void> {
  const before = page.url()
  await page.getByRole('button', { name: 'Overslaan', exact: true }).click()
  await page.getByRole('radio', { name: 'Kiosk gesloten' }).check()
  await page.getByRole('button', { name: 'Overslaan' }).last().click()
  // De dialoog sluit voordat de navigatie rond is. Wachten tot de URL echt
  // verspringt, anders belandt de volgende klik op dezelfde kiosk en slaan we
  // er per saldo één over.
  await page.waitForURL((url) => url.toString() !== before)
}
