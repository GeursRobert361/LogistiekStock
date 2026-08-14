import { test, expect, type Page } from '@playwright/test'
import { login, resetAppData, fillAllCounts } from './helpers'

/**
 * Kiosk 116 heeft een drankkoeling, en daar staat Water Blauw op
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

/**
 * Start een telronde in de tweede ring bij een telpunt met een eigen opschrift.
 *
 * De kiosklijst volgt de gekozen ring, en niet elk telpunt heet "Kiosk <n>":
 * "Ziggo Platform" en "420 Bar" staan onder hun eigen naam.
 */
async function startSecondRingCountAt(page: Page, keuze: string, kioskId: string) {
  await page.goto('/events/event-demo-ajax/count/start')
  await page.getByLabel('Ring').selectOption({ label: 'Tweede ring' })
  await page.getByLabel('Startkiosk').selectOption({ label: keuze })
  await page.getByRole('button', { name: /Telronde starten/ }).click()
  await page.waitForURL(new RegExp(`/kiosk/${kioskId}`))
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

    // Verpakking, saus en schoonmaak — het eten zelf loopt via de keuken en
    // staat dus niet op de logistieke lijst. Een tap staat er ook niet.
    await expect(page.locator('#product-square-bakjes')).toBeVisible()
    await expect(page.locator('#product-mayo-flessen')).toBeVisible()
    await expect(page.locator('#product-bierbeker-05')).toHaveCount(0)
    await expect(page.locator('#product-kroketten')).toHaveCount(0)
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

  test('klein spul heeft snelknoppen, grote drank het gewone veld', async ({ page }) => {
    await startCountAt(page, KIOSK)

    // Koffie: nul tot een handvol, dus knoppen tot vijf en geen invoerveld.
    const koffie = page.locator('#product-koffie')
    for (const aantal of [0, 1, 2, 3, 4, 5]) {
      await expect(koffie.getByRole('button', { name: new RegExp(`^Tel ${aantal} `) })).toBeVisible()
    }
    await expect(koffie.getByRole('button', { name: 'Meer invoeren' })).toBeVisible()
    await expect(koffie.locator('input[inputmode="decimal"]')).toHaveCount(0)

    // Chips: zeven knoppen plus de halve doos.
    const chips = page.locator('#product-chips-oranje')
    await expect(chips.getByRole('button', { name: /^Tel 6 / })).toBeVisible()
    await expect(chips.getByRole('button', { name: 'Halve verpakking toevoegen' })).toBeVisible()

    // Water Blauw loopt tot dertig; daar blijft het gewone veld staan.
    await expect(inputFor(page, WATER)).toBeVisible()
    await expect(page.locator(WATER).getByRole('button', { name: /^Tel 4 / })).toHaveCount(0)
  })

  test('een snelknop telt, en wissen zet terug op niet-geteld', async ({ page }) => {
    await startCountAt(page, KIOSK)
    const koffie = page.locator('#product-koffie')

    await expect(koffie.getByText('Nog tellen')).toBeVisible()

    // Nul is een echte telling: het product is daarna niet meer "nog tellen".
    await koffie.getByRole('button', { name: /^Tel 0 / }).click()
    await expect(koffie.getByText('Nog tellen')).toHaveCount(0)
    await expect(koffie.getByRole('button', { name: /^Tel 0 / })).toHaveAttribute(
      'aria-pressed',
      'true'
    )

    await koffie.getByRole('button', { name: /^Tel 4 / }).click()
    await expect(koffie.getByText(/aanwezig/)).toContainText('4')

    // En wissen brengt hem terug naar nooit geteld — niet naar nul.
    await koffie.getByRole('button', { name: 'Wissen' }).click()
    await expect(koffie.getByText('Nog tellen')).toBeVisible()
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

  test('een satelliet in de tweede ring telt geen drank maar wel de rest', async ({ page }) => {
    // 402 heeft geen koeling. Hier stond elk drankproduct op norm 1 als
    // assortimentsindicatie; dat leverde regels op die niemand kon tellen.
    await startSecondRingCountAt(page, 'Kiosk 402', 'kiosk-402')

    await expect(page.locator(WATER)).toHaveCount(0)
    await expect(page.locator('#product-redbull')).toHaveCount(0)
    await expect(page.locator('#product-bacardi-cola')).toHaveCount(0)

    await expect(page.locator('#product-bierbeker-05')).toBeVisible()
    await expect(page.locator('#product-chips-blauw')).toBeVisible()
    await expect(page.locator('#product-koffie')).toBeVisible()
    await expect(page.locator('#product-tork-rol')).toBeVisible()
  })

  test('toont de eenheid waarin er werkelijk geteld wordt', async ({ page }) => {
    await startCountAt(page, KIOSK)

    // Bekers en trays, niet rollen en pakken.
    await expect(page.locator('#product-bierbeker-05')).toContainText('dozen')
    await expect(page.locator('#product-heineken-00')).toContainText('trays')
  })

  test('Ziggo Platform telt zijn eigen drank, ondanks dat het een satelliet is', async ({
    page,
  }) => {
    // De uitzondering: geen grote koeling, maar wel een eigen stocklijst met
    // echte dranknormen. Die moeten op het telscherm staan.
    await startSecondRingCountAt(page, 'Ziggo Platform', 'kiosk-ziggo-platform')

    await expect(page.locator(WATER)).toBeVisible()
    await expect(page.locator('#product-fuze-tea')).toBeVisible()
    await expect(page.locator('#product-redbull')).toBeVisible()

    // En de rest van zijn eigen lijst.
    await expect(page.locator('#product-bierbeker-03')).toBeVisible()
    await expect(page.locator('#product-sixpacks')).toBeVisible()
  })

  test('een GFT-bak staat op geen enkele tellijst', async ({ page }) => {
    // 416 heeft wél een GFT-norm, maar de bak is na het vorige evenement
    // opgehaald: er staat niets om te tellen. Hij hoort thuis op de vullijst.
    await startSecondRingCountAt(page, 'Kiosk 416', 'kiosk-416')
    await expect(page.locator('#product-gft-bak')).toHaveCount(0)

    // De rest van de schoonmaak staat er gewoon.
    await expect(page.locator('#product-tork-rol')).toBeVisible()
    await expect(page.locator('#product-vuilniszakken')).toBeVisible()
  })

  test('een GFT-norm houdt het afronden niet tegen', async ({ page }) => {
    // Zolang de bak op de tellijst zou staan, blijft de kiosk onafgerond bij
    // een teller die hem niet kan vinden.
    await startSecondRingCountAt(page, 'Kiosk 416', 'kiosk-416')
    await fillAllCounts(page, '2')

    await expect(page.getByRole('button', { name: /Kiosk afronden/ })).toBeEnabled()
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
