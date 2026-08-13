import { test, expect } from '@playwright/test'
import { login, resetAppData, DEMO_PASSWORD } from './helpers'

test.describe('Authenticatie', () => {
  test.beforeEach(async ({ page }) => {
    await resetAppData(page)
  })

  test('inloggen met het demo-adminaccount', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('heading', { name: 'StockFlow' })).toBeVisible()

    await page.getByLabel('E-mailadres').fill('admin@demo.nl')
    await page.getByLabel('Wachtwoord').fill(DEMO_PASSWORD)
    await page.getByRole('button', { name: 'Inloggen' }).click()

    await expect(page).toHaveURL(/\/dashboard/)
    await expect(page.getByText('Hallo, Admin')).toBeVisible()
  })

  test('fout bij een verkeerd wachtwoord', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('E-mailadres').fill('admin@demo.nl')
    await page.getByLabel('Wachtwoord').fill('verkeerd')
    await page.getByRole('button', { name: 'Inloggen' }).click()

    await expect(page.getByText('Ongeldig e-mailadres of wachtwoord')).toBeVisible()
  })

  test('demo-knoppen vullen de gegevens in', async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('button', { name: 'Admin', exact: true }).click()

    await expect(page.getByLabel('E-mailadres')).toHaveValue('admin@demo.nl')
    await expect(page.getByLabel('Wachtwoord')).toHaveValue(DEMO_PASSWORD)
  })

  test('een teller kan de beheerpagina niet gebruiken', async ({ page }) => {
    await login(page, 'teller1@demo.nl')

    await page.goto('/admin/products')

    await expect(page.getByRole('heading', { name: 'Geen toegang' })).toBeVisible()
    await expect(page.getByRole('button', { name: '+ Nieuw' })).toHaveCount(0)
  })

  test('een vuller kan de review niet openen', async ({ page }) => {
    await login(page, 'vuller1@demo.nl')

    await page.goto('/events/event-demo-ajax/count/review')

    await expect(page.getByRole('heading', { name: 'Geen toegang' })).toBeVisible()
  })

  test('een planner kan de review wel openen', async ({ page }) => {
    await login(page, 'planner@demo.nl')

    await page.goto('/events/event-demo-ajax/count/review')

    await expect(page.getByRole('heading', { name: 'Geen toegang' })).toHaveCount(0)
  })
})
