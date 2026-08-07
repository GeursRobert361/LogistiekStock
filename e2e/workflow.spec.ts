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
    await expect(page.getByRole('heading', { name: 'Op de pallet zetten' })).toBeVisible()

    // ── 9. Stapellijst bevestigen ──────────────────────────────────────────
    // Wat er op de pallet moet staat er al; er valt niets in te vullen.
    await expect(page.locator('input[inputmode="numeric"]')).toHaveCount(0)
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
        // Het te leveren aantal staat groot in beeld en vult het invoerveld.
        await expect(page.getByText('Te leveren').first()).toBeVisible()
        await page.getByRole('button', { name: 'Anders' }).first().click()

        const deliveredInput = page.getByLabel('Geleverd').first()
        const planned = Number(await deliveredInput.inputValue())
        expect(planned).toBeGreaterThan(1)
        shortfall = 1

        await deliveredInput.fill(String(planned - shortfall))
        await page
          .getByLabel('Reden van afwijking')
          .selectOption('onvoldoende_magazijnvoorraad')
        await page.getByRole('button', { name: 'Bevestigen' }).click()

        await expect(
          page.getByText(`✓ ${planned - shortfall} van ${planned} geleverd`)
        ).toBeVisible()
      } else {
        await page.getByRole('button', { name: 'Alles geleverd' }).first().click()
        // Hetzelfde getal aan beide kanten: "16 van 8" betekent dat de levering
        // dubbel is weggeschreven.
        await expect(page.getByText(/✓ (\d+) van \1 geleverd/).first()).toBeVisible()
      }

      await page.getByRole('button', { name: /Kiosk klaar/ }).click()

      if (stopNumber === stopCount) {
        await expect(page.getByRole('button', { name: /Vulronde afronden/ })).toBeVisible()
      }
    }

    // ── 12. Ronde afsluiten ────────────────────────────────────────────────
    await page.getByRole('button', { name: /Vulronde afronden/ }).click()
    await page.getByRole('button', { name: 'Afronden', exact: true }).click()

    // Klaar met deze pallet: terug naar het vulmenu, niet nog een scherm over
    // de ronde die net af is.
    await page.waitForURL(/\/restock-rounds$/)
    await expect(page.getByText('Deels geleverd').first()).toBeVisible()

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

    // ── 15. Ronde stoppen zonder hem af te maken ───────────────────────────
    const roundUrl = /\/restock-rounds\/[^/]+$/
    await page.getByRole('link', { name: 'Terug' }).click()
    await page.waitForURL(roundUrl)

    await page.getByRole('button', { name: 'Ronde stoppen' }).click()
    await expect(page.getByText(/staat nog open|staan nog open/)).toBeVisible()
    await page.getByRole('button', { name: 'Stoppen', exact: true }).click()

    await page.waitForURL(/\/restock-rounds$/)
    await expect(page.getByText('Deels geleverd').first()).toBeVisible()

    // En het werk staat weer klaar voor een volgende pallet.
    await page.goto('/restock-rounds/new')
    await expect(page.getByRole('button', { name: new RegExp(roundProductName!) })).toBeVisible()
  })
})

/** Slaat de kiosk waar we nu staan over, met een reden. */
async function skipCurrentKiosk(page: Page): Promise<void> {
  const plate = page.getByRole('heading', { level: 2 })
  const before = await plate.textContent()

  await page.getByRole('button', { name: 'Overslaan', exact: true }).click()
  await page.getByRole('radio', { name: 'Kiosk gesloten' }).check()
  await page.getByRole('button', { name: 'Overslaan' }).last().click()

  // Tijdens het doorklikken blijft de vorige kiosk nog even in beeld — mét
  // werkende knoppen. Pas doorgaan als het bord echt een andere kiosk toont,
  // anders belandt de volgende klik op dezelfde kiosk en blijft er één staan.
  // Na de laatste kiosk is er geen bord meer: dan staan we op de review.
  await expect
    .poll(async () =>
      page.url().includes('/count/review') ? 'review' : await plate.textContent()
    )
    .not.toBe(before)
}
