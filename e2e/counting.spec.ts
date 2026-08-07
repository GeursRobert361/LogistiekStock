import { test, expect, type Page } from '@playwright/test'
import { login, resetAppData, fillAllCounts } from './helpers'

/** Start een telronde in de eerste ring, oplopend vanaf kiosk 123. */
async function startCountAtKiosk123(page: Page) {
  await page.goto('/events/event-demo-ajax/count/start')
  await page.getByLabel('Startkiosk').selectOption({ label: 'Kiosk 123' })
  await page.getByRole('button', { name: /Telronde starten/ }).click()
  await page.waitForURL(/\/kiosk\//)
}

test.describe('Telflow', () => {
  test.beforeEach(async ({ page }) => {
    await resetAppData(page)
    await login(page, 'teller1@demo.nl')
  })

  test('start bij kiosk 123 en toont de route oplopend', async ({ page }) => {
    await startCountAtKiosk123(page)

    await expect(page.getByRole('heading', { level: 2 })).toHaveText('123')
    await expect(page.getByText(/Stop 1 van 28/)).toBeVisible()
  })

  test('een niet-geteld product is niet hetzelfde als nul', async ({ page }) => {
    await startCountAtKiosk123(page)

    // Onaangeraakt: geen bijvuladvies, wel de status "Nog tellen".
    await expect(page.getByText('Nog tellen').first()).toBeVisible()
    const firstInput = page.locator('input[inputmode="decimal"]').first()
    await expect(firstInput).toHaveValue('')

    // Expliciet 0 levert wél een advies op.
    await page.getByRole('button', { name: '0', exact: true }).first().click()
    await expect(firstInput).toHaveValue('0')
    await expect(page.getByText('Bijvullen +15').first()).toBeVisible()
  })

  test('4,5 bij norm 15 geeft 11 bijvullen', async ({ page }) => {
    await startCountAtKiosk123(page)

    const input = page.locator('input[inputmode="decimal"]').first()
    await input.fill('4,5')
    await input.blur()

    await expect(page.getByText('Bijvullen +11').first()).toBeVisible()
    await expect(page.getByText(/Effectief 4 → bijvullen/).first()).toBeVisible()
  })

  test('14,5 bij norm 15 geeft 0 bijvullen', async ({ page }) => {
    await startCountAtKiosk123(page)

    const input = page.locator('input[inputmode="decimal"]').first()
    await input.fill('14,5')
    await input.blur()

    await expect(page.getByText('✓ Vol').first()).toBeVisible()
  })

  test('afronden kan niet zolang er producten ontbreken', async ({ page }) => {
    await startCountAtKiosk123(page)

    const completeButton = page.getByRole('button', { name: /Kiosk afronden/ })
    await expect(completeButton).toBeDisabled()
    await expect(page.getByText(/Nog \d+ producten te tellen/)).toBeVisible()

    await fillAllCounts(page, '2')

    await expect(completeButton).toBeEnabled()
    await expect(page.getByText(/Nog \d+ producten te tellen/)).toHaveCount(0)
  })

  test('afronden gaat door naar de volgende kiosk in de route', async ({ page }) => {
    await startCountAtKiosk123(page)
    await fillAllCounts(page, '3')

    await page.getByRole('button', { name: /Kiosk afronden/ }).click()
    await page.waitForURL(/\/kiosk\/kiosk-124/)

    await expect(page.getByRole('heading', { level: 2 })).toHaveText('124')
    await expect(page.getByText(/Stop 2 van 28/)).toBeVisible()
  })

  test('de laatst ingevoerde waarde gaat niet verloren bij direct afronden', async ({ page }) => {
    await startCountAtKiosk123(page)
    await fillAllCounts(page, '3')

    // Nog één wijziging en meteen doorklikken.
    const input = page.locator('input[inputmode="decimal"]').first()
    await input.fill('7')
    await page.getByRole('button', { name: /Kiosk afronden/ }).click()
    await page.waitForURL(/\/kiosk\/kiosk-124/)

    // Terug naar 123: de 7 moet er nog staan.
    await page.goBack()
    await page.waitForURL(/\/kiosk\/kiosk-123/)
    await expect(page.locator('input[inputmode="decimal"]').first()).toHaveValue('7')
  })

  test('overslaan vraagt om een reden', async ({ page }) => {
    await startCountAtKiosk123(page)

    await page.getByRole('button', { name: 'Overslaan' }).click()
    await page.getByRole('button', { name: 'Overslaan' }).last().click()

    await expect(page.getByText('Kies een reden om deze kiosk over te slaan.')).toBeVisible()

    await page.getByRole('radio', { name: 'Kiosk gesloten' }).check()
    await page.getByRole('button', { name: 'Overslaan' }).last().click()

    await page.waitForURL(/\/kiosk\/kiosk-124/)
  })

  test('een kiosknotitie blijft bewaard', async ({ page }) => {
    await startCountAtKiosk123(page)

    await page.getByRole('button', { name: /Notitie toevoegen/ }).click()
    const notes = page.getByLabel('Notitie bij deze kiosk')
    await notes.fill('Koeling links defect')
    await notes.blur()

    await page.reload()
    await expect(page.getByLabel('Notitie bij deze kiosk')).toHaveValue('Koeling links defect')
  })
})

test.describe('Offline', () => {
  test.beforeEach(async ({ page }) => {
    await resetAppData(page)
    await login(page, 'teller1@demo.nl')
  })

  test('een herlaadactie zonder verbinding houdt de telling vast', async ({ page, context }) => {
    await startCountAtKiosk123(page)

    // De service worker moet de pagina één keer online gezien hebben.
    await page.evaluate(() => navigator.serviceWorker.ready)
    await page.reload()
    await page.locator('input[inputmode="decimal"]').first().waitFor()

    const input = page.locator('input[inputmode="decimal"]').first()
    await input.fill('4,5')
    await input.blur()
    await expect(page.getByText('Bijvullen +11').first()).toBeVisible()

    // Verbinding eruit en de pagina opnieuw laden.
    await context.setOffline(true)
    await page.reload()

    await expect(page.locator('input[inputmode="decimal"]').first()).toHaveValue('4,5')
    await expect(page.getByText('Bijvullen +11').first()).toBeVisible()

    // Offline verder tellen kan gewoon.
    const second = page.locator('input[inputmode="decimal"]').nth(1)
    await second.fill('2')
    await second.blur()

    await context.setOffline(false)
    await page.reload()

    await expect(page.locator('input[inputmode="decimal"]').first()).toHaveValue('4,5')
    await expect(page.locator('input[inputmode="decimal"]').nth(1)).toHaveValue('2')
  })
})
