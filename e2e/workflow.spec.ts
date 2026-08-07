import { test, expect, type Page } from '@playwright/test'
import { login, resetAppData, fillAllCounts } from './helpers'

/**
 * De volledige operationele keten in één test: evenement → telronde → review →
 * goedkeuren → vulplanning → pallet laden → afleveren → restant terug in de
 * planning.
 */
test.describe('Volledige workflow', () => {
  test.slow()

  test.beforeEach(async ({ page }) => {
    await resetAppData(page)
    await login(page, 'admin@demo.nl')
  })

  test('van telling tot gedeeltelijke levering en terug in de planning', async ({ page }) => {
    // ── 1. Telronde starten bij kiosk 123, oplopend ────────────────────────
    await page.goto('/events/event-demo-ajax')
    await page.getByRole('button', { name: /telronde starten/i }).click()
    await page.waitForURL(/\/count\/start/)

    await page.getByLabel('Startkiosk').selectOption({ label: 'Kiosk 123' })
    await page.getByRole('button', { name: /Telronde starten/ }).click()
    await page.waitForURL(/\/kiosk\/kiosk-123/)

    await expect(page.getByRole('heading', { level: 2 })).toHaveText('123')
    await expect(page.getByText(/Stop 1 van 28/)).toBeVisible()

    // ── 2. Kiosk 123 tellen: expliciet 0 en een kwartwaarde ────────────────
    await fillAllCounts(page, '1')

    await page.getByRole('button', { name: '0', exact: true }).first().click()
    await expect(page.getByText('Bijvullen +15').first()).toBeVisible()

    const firstInput = page.locator('input[inputmode="decimal"]').first()
    await firstInput.fill('4,5')
    await firstInput.blur()
    await expect(page.getByText('Bijvullen +11').first()).toBeVisible()

    await page.getByRole('button', { name: /Kiosk afronden/ }).click()
    await page.waitForURL(/\/kiosk\/kiosk-124/)

    // ── 3. Kiosk 124 tellen ────────────────────────────────────────────────
    await fillAllCounts(page, '2')
    await page.getByRole('button', { name: /Kiosk afronden/ }).click()
    await page.waitForURL(/\/kiosk\/kiosk-125/)

    // ── 4. De rest van de ring bewust overslaan ────────────────────────────
    for (let index = 0; index < 26; index++) {
      await skipCurrentKiosk(page)
    }

    // Laatste kiosk afgehandeld → de telronde is ingediend.
    await page.waitForURL(/\/count\/review/)

    // ── 5. Review kent de hele route ───────────────────────────────────────
    await expect(page.getByText('2 van 28 kiosken afgerond')).toBeVisible()
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
  })
})

/** Slaat de kiosk waar we nu staan over, met een reden. */
async function skipCurrentKiosk(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Overslaan', exact: true }).click()
  await page.getByRole('radio', { name: 'Kiosk gesloten' }).check()
  await page.getByRole('button', { name: 'Overslaan' }).last().click()
  // Wachten tot de dialoog weg is en de volgende pagina staat.
  await expect(page.getByRole('radio', { name: 'Kiosk gesloten' })).toHaveCount(0)
}
