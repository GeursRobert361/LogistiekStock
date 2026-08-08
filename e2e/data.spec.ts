import { test, expect, type Page } from '@playwright/test'
import { login, resetAppData, fillAllCounts } from './helpers'

/**
 * Verbruik is niet direct te meten: het volgt uit twee tellingen met een
 * vulronde ertussen. Deze test legt die ketting neer en kijkt of het getal
 * klopt dat er dan uit komt.
 */
test.describe('Data', () => {
  test.setTimeout(240_000)

  test.beforeEach(async ({ page }) => {
    await resetAppData(page)
    await login(page, 'admin@demo.nl')
  })

  test('de teller ziet het datatabblad niet', async ({ page }) => {
    await login(page, 'teller1@demo.nl')
    await expect(page.getByRole('link', { name: 'Data' })).toHaveCount(0)

    await page.goto('/data')
    await expect(page.getByText(/geen toegang/i)).toBeVisible()
  })

  test('het tabblad is te bereiken en meldt eerlijk dat er nog niets is', async ({ page }) => {
    await page.goto('/dashboard')
    await page.getByRole('link', { name: 'Data' }).click()
    await page.waitForURL(/\/data/)

    // Eén evenement, dus geen opvolger om het verbruik mee af te sluiten.
    await expect(page.getByText(/Nog geen verbruik/)).toBeVisible()
  })

  test('verbruik verschijnt zodra er voor het volgende evenement is geteld', async ({ page }) => {
    // Twee evenementen met één open kiosk: dan is een telronde één stop en
    // gaat deze test over het verbruik in plaats van over het tellen.
    const firstUrl = await createEventWithOnlyKiosk116(page, 'Ajax – Eerste', daysFromNow(1))
    await countOnlyKiosk(page, firstUrl, '2')
    await approve(page, firstUrl)

    const secondUrl = await createEventWithOnlyKiosk116(page, 'Ajax – Tweede', daysFromNow(3))
    // Het legt zijn voorganger vast.
    await expect(page.getByText(/Vorig evenement: Ajax – Eerste/)).toBeVisible()

    // Er staat nog 1 van elk, dus er ging er 1 doorheen.
    await countOnlyKiosk(page, secondUrl, '1')
    await approve(page, secondUrl)

    // ── Het datatabblad toont het verschil ───────────────────────────────
    await page.goto(`/data?event=${firstUrl.split('/').pop()}`)
    await expect(page.getByText(/gemeten met de telling van/)).toBeVisible()

    // Zonder vulronde ertussen: 2 geteld, 1 over, dus 1 verbruikt per product.
    const water = page.getByRole('button', { name: /Chaudfontaine Blauw/ })
    await expect(water).toBeVisible()
    await expect(water).toContainText('1')

    // Per kiosk uitklappen laat zien waar het vandaan komt.
    await water.click()
    await expect(page.getByText('Kiosk 116')).toBeVisible()

    // En de andere weergave bestaat ook.
    await page.getByText('Per kiosk', { exact: true }).click()
    await expect(page.getByRole('button', { name: /Kiosk 116/ })).toBeVisible()
  })
})

function daysFromNow(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10)
}

/** Evenement met alleen kiosk 116 open; de rest wordt dichtgezet. */
async function createEventWithOnlyKiosk116(
  page: Page,
  name: string,
  date: string
): Promise<string> {
  await page.goto('/events/new')
  await page.getByLabel('Naam').fill(name)
  await page.getByLabel('Datum').fill(date)

  // Alleen de eerste ring; dat scheelt de helft van het dichtzetten.
  await page.getByText('Tweede ring', { exact: true }).click()

  for (const label of RING1_LABELS) {
    if (label === '116') continue
    await page.getByRole('button', { name: label, exact: true }).click()
  }
  await expect(page.getByText('1 kiosken open')).toBeVisible()

  await page.getByRole('button', { name: 'Evenement aanmaken' }).click()
  // Niet /events/new: dat pad matcht anders zichzelf en dan loopt de test
  // vrolijk verder op het formulier.
  await page.waitForURL(/\/events\/(?!new$)[^/]+$/)
  return page.url()
}

const RING1_LABELS = [
  ...Array.from({ length: 28 }, (_, index) => String(101 + index)),
  '120 Cubes',
]

async function countOnlyKiosk(page: Page, eventUrl: string, value: string) {
  await page.goto(`${eventUrl}/count/start`)
  await page.getByRole('button', { name: /Telronde starten/ }).click()
  await page.waitForURL(/\/kiosk\//)
  await fillAllCounts(page, value)
  await page.getByRole('button', { name: /Kiosk afronden/ }).click()
  await page.waitForURL(/\/count\/review/)
}

/** Keurt de telronde van dit evenement goed. */
async function approve(page: Page, eventUrl: string) {
  await page.goto(`${eventUrl}/count/review`)
  await page.getByRole('button', { name: /Telling goedkeuren/ }).click()
  await page.getByRole('button', { name: 'Goedkeuren', exact: true }).click()
  await expect(page.getByText(/Telling goedgekeurd\. \d+ bijvulregels/)).toBeVisible()
}
