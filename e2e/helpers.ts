import type { Page } from '@playwright/test'

export const DEMO_PASSWORD = 'demo1234'

export async function login(page: Page, email: string): Promise<void> {
  await page.goto('/login')
  await page.getByLabel('E-mailadres').fill(email)
  await page.getByLabel('Wachtwoord').fill(DEMO_PASSWORD)
  await page.getByRole('button', { name: 'Inloggen' }).click()
  await page.waitForURL(/\/dashboard/)
}

/**
 * Demo-data staat in localStorage en IndexedDB. Tussen tests wissen we beide,
 * zodat een test niet op de resten van een vorige leunt.
 */
export async function resetAppData(page: Page): Promise<void> {
  await page.goto('/login')
  await page.evaluate(async () => {
    localStorage.clear()
    sessionStorage.clear()
    const databases = (await indexedDB.databases?.()) ?? []
    await Promise.all(
      databases
        .filter((database) => database.name)
        .map(
          (database) =>
            new Promise((resolve) => {
              const request = indexedDB.deleteDatabase(database.name!)
              request.onsuccess = resolve
              request.onerror = resolve
              request.onblocked = resolve
            })
        )
    )
  })
}

/** Vult elk zichtbaar telveld op deze kiosk met `value`. */
export async function fillAllCounts(page: Page, value: string): Promise<void> {
  const inputs = page.locator('input[inputmode="decimal"]')
  // Wachten tot het scherm klaar is met laden; anders vullen we nul velden.
  await inputs.first().waitFor({ state: 'visible' })
  const count = await inputs.count()
  for (let index = 0; index < count; index++) {
    const input = inputs.nth(index)
    await input.fill(value)
    await input.blur()
  }
}
