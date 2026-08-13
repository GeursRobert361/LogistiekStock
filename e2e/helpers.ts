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

/**
 * Telt elk product op deze kiosk op `value`.
 *
 * Loopt over de productregels en niet over de invoervelden, want die zijn er
 * niet overal: klein spul heeft snelknoppen en geen veld. Per regel dus eerst
 * de knop, dan het veld, en desnoods "Meer…" om er alsnog een te krijgen — dat
 * dekt elk product, ongeacht welke invoer het toevallig heeft.
 */
export async function fillAllCounts(page: Page, value: string): Promise<void> {
  const rows = page.locator('[id^="product-"]')
  // Wachten tot het scherm klaar is met laden; anders tellen we nul producten.
  await rows.first().waitFor({ state: 'visible' })

  const count = await rows.count()
  for (let index = 0; index < count; index++) {
    const row = rows.nth(index)

    const quickButton = row.getByRole('button', { name: new RegExp(`^Tel ${value} `) })
    if ((await quickButton.count()) > 0) {
      await quickButton.click()
      continue
    }

    // Geen snelknop voor dit getal: het handmatige veld, dat bij een product
    // met snelknoppen eerst opengeklapt moet worden.
    const input = row.locator('input[inputmode="decimal"]')
    if ((await input.count()) === 0) {
      await row.getByRole('button', { name: 'Meer invoeren' }).click()
    }
    await input.fill(value)
    await input.blur()
  }
}
