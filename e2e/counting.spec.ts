import { test, expect, type Page } from '@playwright/test'
import { login, resetAppData, fillAllCounts } from './helpers'

/**
 * Kiosk 116 heeft een drankkoeling, en daar staat Chaudfontaine Blauw op
 * norm 15 — handig om de afrondingsregels doorheen te halen. Kiosken zonder
 * koeling voeren die producten helemaal niet.
 */
const KIOSK = 116
const WATER = '#product-chaudfontaine-blauw'

/** Start een telronde in de eerste ring, oplopend vanaf de gegeven kiosk. */
async function startCountAt(page: Page, kioskNumber: number) {
  await page.goto('/events/event-demo-ajax/count/start')
  await page.getByLabel('Startkiosk').selectOption({ label: `Kiosk ${kioskNumber}` })
  await page.getByRole('button', { name: /Telronde starten/ }).click()
  await page.waitForURL(/\/kiosk\//)
}

/** Het invoerveld van één product, op id in plaats van op volgorde. */
function inputFor(page: Page, productSelector: string) {
  return page.locator(productSelector).locator('input[inputmode="decimal"]')
}

test.describe('Telflow', () => {
  test.beforeEach(async ({ page }) => {
    await resetAppData(page)
    await login(page, 'teller1@demo.nl')
  })

  test('start standaard op de kiosk waar je de lift uitkomt', async ({ page }) => {
    await page.goto('/events/event-demo-ajax/count/start')

    // 127 staat als startkiosk voor tellen op de eerste ring.
    await expect(page.getByLabel('Startkiosk')).toHaveValue('kiosk-127')
  })

  test('start bij de gekozen kiosk en toont de route', async ({ page }) => {
    await startCountAt(page, KIOSK)

    await expect(page.getByRole('heading', { level: 2 })).toHaveText(String(KIOSK))
    await expect(page.getByText(/Stop 1 van 29/)).toBeVisible()
  })

  test('de cubes tegenover 120 zijn een eigen telpunt met eigen assortiment', async ({ page }) => {
    await page.goto('/events/event-demo-ajax/count/start')
    await page.getByLabel('Startkiosk').selectOption({ label: '120 Cubes' })
    await page.getByRole('button', { name: /Telronde starten/ }).click()
    await page.waitForURL(/\/kiosk\/kiosk-120-cubes/)

    // Het bord toont het opschrift van de vloer, niet het interne nummer 1201.
    await expect(page.getByRole('heading', { level: 2 })).toHaveText('120 Cubes')

    // Daar staan hotdogs en kroketten, en geen tap.
    await expect(page.locator('#product-hotdog-broodjes')).toBeVisible()
    await expect(page.locator('#product-kroketten')).toBeVisible()
    await expect(page.locator('#product-bierbeker-05')).toHaveCount(0)
  })

  test('een niet-geteld product is niet hetzelfde als nul', async ({ page }) => {
    await startCountAt(page, KIOSK)

    const water = page.locator(WATER)
    await expect(water.getByText('Nog tellen')).toBeVisible()
    await expect(inputFor(page, WATER)).toHaveValue('')

    // Expliciet 0 levert wél een advies op: de hele norm moet erbij.
    await water.getByRole('button', { name: '0', exact: true }).click()
    await expect(inputFor(page, WATER)).toHaveValue('0')
    await expect(water.getByText('+15')).toBeVisible()
  })

  test('4,5 bij norm 15 geeft 11 bijvullen', async ({ page }) => {
    await startCountAt(page, KIOSK)

    const input = inputFor(page, WATER)
    await input.fill('4,5')
    await input.blur()

    await expect(page.locator(WATER).getByText('+11')).toBeVisible()
    await expect(page.locator(WATER).getByText(/Effectief 4 — bijvullen/)).toBeVisible()
  })

  test('14,5 bij norm 15 geeft 0 bijvullen', async ({ page }) => {
    await startCountAt(page, KIOSK)

    const input = inputFor(page, WATER)
    await input.fill('14,5')
    await input.blur()

    await expect(page.locator(WATER).getByText('Vol', { exact: true })).toBeVisible()
  })

  test('afronden kan niet zolang er producten ontbreken', async ({ page }) => {
    await startCountAt(page, KIOSK)

    const completeButton = page.getByRole('button', { name: /Kiosk afronden/ })
    await expect(completeButton).toBeDisabled()
    await expect(page.getByText(/Nog \d+ producten te tellen/)).toBeVisible()

    await fillAllCounts(page, '2')

    await expect(completeButton).toBeEnabled()
    await expect(page.getByText(/Nog \d+ producten te tellen/)).toHaveCount(0)
  })

  test('afronden gaat door naar de volgende kiosk in de route', async ({ page }) => {
    await startCountAt(page, KIOSK)
    await fillAllCounts(page, '3')

    await page.getByRole('button', { name: /Kiosk afronden/ }).click()
    await page.waitForURL(/\/kiosk\/kiosk-117/)

    await expect(page.getByRole('heading', { level: 2 })).toHaveText('117')
    await expect(page.getByText(/Stop 2 van 29/)).toBeVisible()
  })

  test('de laatst ingevoerde waarde gaat niet verloren bij direct afronden', async ({ page }) => {
    await startCountAt(page, KIOSK)
    await fillAllCounts(page, '3')

    // Nog één wijziging en meteen doorklikken.
    const input = inputFor(page, WATER)
    await input.fill('7')
    await page.getByRole('button', { name: /Kiosk afronden/ }).click()
    await page.waitForURL(/\/kiosk\/kiosk-117/)

    await page.goBack()
    await page.waitForURL(new RegExp(`/kiosk/kiosk-${KIOSK}`))
    await expect(inputFor(page, WATER)).toHaveValue('7')
  })

  test('overslaan vraagt om een reden', async ({ page }) => {
    await startCountAt(page, KIOSK)

    await page.getByRole('button', { name: 'Overslaan' }).click()
    await page.getByRole('button', { name: 'Overslaan' }).last().click()

    await expect(page.getByText('Kies een reden om deze kiosk over te slaan.')).toBeVisible()

    await page.getByRole('radio', { name: 'Kiosk gesloten' }).check()
    await page.getByRole('button', { name: 'Overslaan' }).last().click()

    await page.waitForURL(/\/kiosk\/kiosk-117/)
  })

  test('een kiosknotitie blijft bewaard', async ({ page }) => {
    await startCountAt(page, KIOSK)

    await page.getByRole('button', { name: /Notitie toevoegen/ }).click()
    const notes = page.getByLabel('Notitie bij deze kiosk')
    await notes.fill('Koeling links defect')
    await notes.blur()

    await page.reload()
    await expect(page.getByLabel('Notitie bij deze kiosk')).toHaveValue('Koeling links defect')
  })
})

test.describe('Assortiment per kiosk', () => {
  test.beforeEach(async ({ page }) => {
    await resetAppData(page)
    await login(page, 'teller1@demo.nl')
  })

  test('een kiosk met koeling telt de gekoelde drank', async ({ page }) => {
    await startCountAt(page, 116)

    await expect(page.locator(WATER)).toBeVisible()
    await expect(page.getByText('Fuze Tea')).toBeVisible()
  })

  test('een kiosk zonder koeling telt die drank helemaal niet', async ({ page }) => {
    await startCountAt(page, 121)

    await expect(page.locator(WATER)).toHaveCount(0)
    await expect(page.getByText('Fuze Tea')).toHaveCount(0)
    // De rest staat er wel gewoon.
    await expect(page.getByText('Bierbekers 0,5')).toBeVisible()
    await expect(page.getByText('Chips Blauw')).toBeVisible()
  })
})

test.describe('Offline', () => {
  test.beforeEach(async ({ page }) => {
    await resetAppData(page)
    await login(page, 'teller1@demo.nl')
  })

  test('een herlaadactie zonder verbinding houdt de telling vast', async ({ page, context }) => {
    await startCountAt(page, KIOSK)

    // De service worker moet de pagina één keer online gezien hebben.
    await page.evaluate(() => navigator.serviceWorker.ready)
    await page.reload()
    await inputFor(page, WATER).waitFor()

    const input = inputFor(page, WATER)
    await input.fill('4,5')
    await input.blur()
    await expect(page.locator(WATER).getByText('+11')).toBeVisible()

    await context.setOffline(true)
    await page.reload()

    await expect(inputFor(page, WATER)).toHaveValue('4,5')
    await expect(page.locator(WATER).getByText('+11')).toBeVisible()

    await context.setOffline(false)
    await page.reload()
    await expect(inputFor(page, WATER)).toHaveValue('4,5')
  })
})
