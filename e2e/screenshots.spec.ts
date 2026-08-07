import { test } from '@playwright/test'
import { login, resetAppData, fillAllCounts } from './helpers'

/**
 * Maakt screenshots van de belangrijkste schermen. Geen assertions — dit is
 * gereedschap om het ontwerp te beoordelen, niet om gedrag te bewaken.
 * Draaien met: npx playwright test e2e/screenshots.spec.ts
 */
test.describe('Schermafbeeldingen', () => {
  test('operationele schermen', async ({ page }) => {
    await resetAppData(page)

    await page.goto('/login')
    await page.screenshot({ path: 'design/01-login.png', fullPage: true })

    await login(page, 'admin@demo.nl')
    await page.screenshot({ path: 'design/02-dashboard.png', fullPage: true })

    await page.goto('/events/event-demo-ajax/count/start')
    await page.getByLabel('Startkiosk').selectOption({ label: 'Kiosk 123' })
    await page.getByRole('button', { name: /Telronde starten/ }).click()
    await page.waitForURL(/\/kiosk\//)
    await page.locator('input[inputmode="decimal"]').first().waitFor()
    await page.screenshot({ path: 'design/03-tellen-leeg.png' })

    const input = page.locator('input[inputmode="decimal"]').first()
    await input.fill('4,5')
    await input.blur()
    await page.locator('input[inputmode="decimal"]').nth(1).fill('0')
    await page.locator('input[inputmode="decimal"]').nth(1).blur()
    await page.screenshot({ path: 'design/04-tellen-gevuld.png' })

    await fillAllCounts(page, '3')
    await page.screenshot({ path: 'design/05-tellen-compleet.png', fullPage: true })

    await page.goto('/events/event-demo-ajax/count/review')
    await page.screenshot({ path: 'design/06-review.png', fullPage: true })

    await page.goto('/admin/products')
    await page.screenshot({ path: 'design/07-beheer.png', fullPage: true })
  })
})
