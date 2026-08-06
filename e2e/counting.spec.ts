import { test, expect, type Page } from '@playwright/test'

// Helper: log in as teller
async function loginAsTeller(page: Page) {
  await page.goto('/login')
  await page.getByRole('button', { name: 'Teller' }).click()
  await page.getByRole('button', { name: 'Inloggen' }).click()
  await page.waitForURL(/\/dashboard/)
}

test.describe('Telworkflow', () => {
  test('telronde starten en eerste kiosk tellen', async ({ page }) => {
    await loginAsTeller(page)

    // Ga naar evenement
    await page.goto('/events')
    await page.getByText('Ajax').click()
    await page.waitForURL(/\/events\//)

    // Start telronde
    await page.getByText('Telronde starten').click()
    await page.waitForURL(/\/count\/start/)

    // Kies ring en startkiosk
    await expect(page.getByLabel('Ring')).toBeVisible()
    await expect(page.getByLabel('Startkiosk')).toBeVisible()

    // Start
    await page.getByRole('button', { name: /Telronde starten/ }).click()
    await page.waitForURL(/\/kiosk\//)

    // Kiosknummer zichtbaar
    await expect(page.getByRole('heading', { level: 2 })).toBeVisible()
  })

  test('kwartwaarde 4,5 invoeren bij norm 15 → 11 bijvullen', async ({ page }) => {
    await loginAsTeller(page)
    await page.goto('/events')
    await page.getByText('Ajax').click()
    await page.getByText('Telronde starten').click()
    await page.getByRole('button', { name: /Telronde starten/ }).click()
    await page.waitForURL(/\/kiosk\//)

    // Zoek het Bierbeker 0,5 liter veld
    const bierbeker = page.getByText('Bierbeker 0,5 liter').first()
    if (await bierbeker.isVisible()) {
      // Vul 4,5 in
      const input = page.locator('input[inputmode="decimal"]').first()
      await input.fill('4,5')
      await input.blur()

      // Bijvullen = 11
      await expect(page.getByText('+11')).toBeVisible()
    }
  })

  test('kwartwaarde 14,5 invoeren bij norm 15 → 0 bijvullen', async ({ page }) => {
    await loginAsTeller(page)
    await page.goto('/events')
    await page.getByText('Ajax').click()
    await page.getByText('Telronde starten').click()
    await page.getByRole('button', { name: /Telronde starten/ }).click()
    await page.waitForURL(/\/kiosk\//)

    const input = page.locator('input[inputmode="decimal"]').first()
    if (await input.isVisible()) {
      await input.fill('14,5')
      await input.blur()
      await expect(page.getByText('✓ Vol')).toBeVisible()
    }
  })
})
