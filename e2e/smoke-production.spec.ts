import { test, expect } from '@playwright/test'

/**
 * Rooktest tegen een draaiende productieomgeving. Leest alleen; schrijft niets
 * naar de database.
 *
 * Draaien met:
 *   BASE_URL=https://stock.niettegeloven.com npx playwright test e2e/smoke-production.spec.ts
 *
 * Staat los van de andere e2e-tests: die gaan uit van de demodata met vaste
 * id's, en die bestaan in productie niet.
 */
test.describe('Productie', () => {
  test.skip(!process.env.BASE_URL, 'Alleen met BASE_URL tegen een echte omgeving')

  test('inloggen en dashboard laden uit de database', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('E-mailadres').fill('admin@demo.nl')
    await page.getByLabel('Wachtwoord').fill('demo1234')
    await page.getByRole('button', { name: 'Inloggen' }).click()

    await page.waitForURL(/\/dashboard/)
    await expect(page.getByText('Hallo, Admin')).toBeVisible()
    await page.screenshot({ path: 'design/prod-01-dashboard.png', fullPage: true })

    // Kiosken komen uit de database, niet uit de demodata in de browser.
    await page.goto('/admin/kiosks')
    await expect(page.getByText('Kiosk 101')).toBeVisible()
    await page.screenshot({ path: 'design/prod-02-kiosken.png', fullPage: true })

    // Voorraadnormen zijn geseed.
    await page.goto('/admin/standards')
    await page.getByLabel('Kiosk').selectOption({ index: 0 })
    await expect(page.getByLabel(/^Norm voor /).first()).not.toHaveValue('')
    await page.screenshot({ path: 'design/prod-03-normen.png', fullPage: true })
  })

  test('de sessie overleeft een herlaadactie', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('E-mailadres').fill('planner@demo.nl')
    await page.getByLabel('Wachtwoord').fill('demo1234')
    await page.getByRole('button', { name: 'Inloggen' }).click()
    await page.waitForURL(/\/dashboard/)

    await page.reload()
    await expect(page.getByText('Hallo, Planner')).toBeVisible()
  })

  test('een teller komt niet op de beheerpagina', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('E-mailadres').fill('teller1@demo.nl')
    await page.getByLabel('Wachtwoord').fill('demo1234')
    await page.getByRole('button', { name: 'Inloggen' }).click()
    await page.waitForURL(/\/dashboard/)

    await page.goto('/admin/products')
    await expect(page.getByRole('heading', { name: 'Geen toegang' })).toBeVisible()
  })
})
