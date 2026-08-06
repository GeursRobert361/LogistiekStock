import { test, expect } from '@playwright/test'

test.describe('Authenticatie', () => {
  test('inloggen met demo admin account', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByText('LogistiekStock')).toBeVisible()

    await page.getByLabel('E-mailadres').fill('admin@demo.nl')
    await page.getByLabel('Wachtwoord').fill('demo1234')
    await page.getByRole('button', { name: 'Inloggen' }).click()

    await expect(page).toHaveURL(/\/dashboard/)
    await expect(page.getByText('Hallo, Admin')).toBeVisible()
  })

  test('fout bij verkeerd wachtwoord', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('E-mailadres').fill('admin@demo.nl')
    await page.getByLabel('Wachtwoord').fill('verkeerd')
    await page.getByRole('button', { name: 'Inloggen' }).click()

    await expect(page.getByRole('alert')).toContainText('Ongeldig')
  })

  test('demo-knoppen invullen', async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('button', { name: 'Admin' }).click()
    await expect(page.getByLabel('E-mailadres')).toHaveValue('admin@demo.nl')
    await expect(page.getByLabel('Wachtwoord')).toHaveValue('demo1234')
  })
})
