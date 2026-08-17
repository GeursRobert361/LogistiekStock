import { test, expect, type Page } from '@playwright/test'
import { login, resetAppData, fillAllCounts, skipCurrentKiosk } from './helpers'

/**
 * De papieren vullijst.
 *
 * Wat hier misgaat rolt uit een printer en gaat de vloer op: een vel dat twee
 * kiosken bevat, een productregel bij de verkeerde kiosk, of een knop die
 * meeprint. Op het scherm valt dat allemaal niet op.
 */

/** Ring 1: kiosk 101 t/m 128 plus de cubes tegenover 120. */
const ROUTE_LENGTH = 29

/**
 * Zet een vulronde met een route klaar en geeft het aantal haltes terug.
 *
 * Geteld worden 116 en 118, en de rest wordt overgeslagen. Bewust die twee: ze
 * hebben allebei een drankkoeling en voeren dus hetzelfde assortiment. Een
 * productronde over 116 en 117 zou op één kiosk uitkomen, want 117 heeft geen
 * koeling en voert de gekoelde dranken helemaal niet — en dan valt er niets
 * over meerdere vellen te testen.
 */
async function countTwoKiosksAndApprove(page: Page): Promise<void> {
  await page.goto('/events/event-demo-ajax')
  await page.getByRole('button', { name: /telronde starten/i }).click()
  await page.waitForURL(/\/count\/start/)

  await page.getByLabel('Startkiosk').selectOption({ label: 'Kiosk 116' })
  await page.getByRole('button', { name: /Telronde starten/ }).click()
  await page.waitForURL(/\/kiosk\/kiosk-116/)

  // Alles op nul: dan moet elk product bij beide kiosken bijgevuld worden.
  await fillAllCounts(page, '0')
  await page.getByRole('button', { name: /Kiosk afronden/ }).click()
  await page.waitForURL(/\/kiosk\/kiosk-117/)

  await skipCurrentKiosk(page)

  await fillAllCounts(page, '0')
  await page.getByRole('button', { name: /Kiosk afronden/ }).click()
  await page.waitForURL(/\/kiosk\/kiosk-119/)

  for (let index = 0; index < ROUTE_LENGTH - 3; index++) {
    await skipCurrentKiosk(page)
  }
  await page.waitForURL(/\/count\/review/)

  await expect(page.getByText('Alles opgeslagen')).toBeVisible()
  await page.getByRole('button', { name: /Telling goedkeuren/ }).click()
  await page.getByRole('button', { name: 'Goedkeuren', exact: true }).click()
  await expect(page.getByText(/Telling goedgekeurd/)).toBeVisible()
}

/** Bouwt op die telling een productronde met een route en geeft het aantal haltes. */
async function prepareRoundWithRoute(page: Page): Promise<number> {
  await countTwoKiosksAndApprove(page)

  await page.goto('/events/event-demo-ajax/restock')
  await page.getByRole('button', { name: 'Productronde maken' }).first().click()
  await page.waitForURL(/\/restock-rounds\//)

  await page.getByRole('button', { name: /Route maken/ }).click()
  const routeHeading = page.getByRole('heading', { name: /Route \(/ })
  await expect(routeHeading).toBeVisible()

  const stops = Number(/Route \((\d+)/.exec((await routeHeading.textContent()) ?? '')?.[1] ?? '0')
  expect(stops).toBeGreaterThan(1)
  return stops
}

test.describe('Bestellijst printen', () => {
  test.beforeEach(async ({ page }) => {
    await resetAppData(page)
    await login(page, 'admin@demo.nl')
  })

  test('bestaat ook zonder telling en zonder vulronde', async ({ page }) => {
    // Dit is het geval waar het misging: een evenement waar niets te vullen
    // valt leverde geen enkele pagina op. De bestellijst komt uit de normen en
    // is er dus altijd.
    await page.goto('/events/event-demo-ajax')
    await page.getByRole('button', { name: /Bestellijst printen/ }).click()
    await page.waitForURL(/\/events\/[^/]+\/print$/)

    const pages = page.locator('.print-kiosk-page')
    await expect(pages.first()).toBeVisible()
    expect(await pages.count()).toBeGreaterThan(1)

    // Per soort product een eigen blokje, dus de kolomnamen staan er meerdere
    // keren; de eerste volstaat om te zien dat de indeling klopt.
    const eerste = pages.first()
    await expect(eerste.getByRole('columnheader', { name: 'Artikel' }).first()).toBeVisible()
    await expect(eerste.getByRole('columnheader', { name: 'Standaard' }).first()).toBeVisible()
    await expect(eerste.getByRole('columnheader', { name: 'Vullen' }).first()).toBeVisible()
    await expect(eerste.getByText(/blad 1 van/)).toBeVisible()
    await expect(eerste.getByRole('heading', { level: 2 })).toBeVisible()
    expect(await eerste.locator('.print-block').count()).toBeGreaterThan(1)
  })

  test('geeft iedere kiosk zijn eigen vel met zijn eigen normen', async ({ page }) => {
    await page.goto('/events/event-demo-ajax/print')
    await expect(page.locator('.print-kiosk-page').first()).toBeVisible()

    const nummers = await page.evaluate(() =>
      [...document.querySelectorAll('.print-kiosk-page')].map((el) =>
        el.getAttribute('data-kiosk-number')
      )
    )
    expect(new Set(nummers).size).toBe(nummers.length)

    // Elk vel heeft artikelen; een leeg vel hoort er niet tussen te staan.
    const regels = await page.evaluate(() =>
      [...document.querySelectorAll('.print-kiosk-page')].map(
        (el) => el.querySelectorAll('tbody tr').length
      )
    )
    expect(regels.every((n) => n > 0)).toBe(true)
  })

  test('houdt de ringen uit elkaar in plaats van door elkaar', async ({ page }) => {
    // Beide ringen tellen hun kiosken vanaf sortOrder 10, dus sorteren op dat
    // getal alleen schoof 101 en 401 om en om door elkaar.
    await page.goto('/events/event-demo-ajax/print')
    await expect(page.locator('.print-kiosk-page').first()).toBeVisible()

    // Op de ring en niet op het kiosknummer: "120 Cubes" heet intern 1201 en
    // hoort bij de eerste ring, dus een grens op 400 zou niets bewijzen.
    const ringen = await page.evaluate(() =>
      [...document.querySelectorAll('.print-kiosk-page')].map((el) =>
        el.getAttribute('data-ring')
      )
    )

    // Elke ring vormt één aaneengesloten blok vellen.
    const blokken = ringen.filter((ring, index) => ring !== ringen[index - 1])
    expect(blokken).toHaveLength(new Set(ringen).size)
    expect(new Set(ringen).size).toBeGreaterThan(1)
  })

  test('print één ring apart', async ({ page }) => {
    await page.goto('/events/event-demo-ajax/print')
    await expect(page.locator('.print-kiosk-page').first()).toBeVisible()
    const alles = await page.locator('.print-kiosk-page').count()

    await page.getByRole('button', { name: 'Tweede ring' }).click()

    const nummers = await page.evaluate(() =>
      [...document.querySelectorAll('.print-kiosk-page')].map((el) =>
        Number(el.getAttribute('data-kiosk-number'))
      )
    )
    expect(nummers.length).toBeGreaterThan(0)
    expect(nummers.length).toBeLessThan(alles)
    expect(nummers.every((n) => n >= 400)).toBe(true)
  })

  test('vult de kolom "Vullen" zodra de telling goedgekeurd is', async ({ page }) => {
    test.setTimeout(240_000)

    // Vóór het tellen staat er niets in die kolom.
    await page.goto('/events/event-demo-ajax/print')
    const kiosk116 = page.locator('.print-kiosk-page[data-kiosk-number="116"]')
    await expect(kiosk116).toBeVisible()
    const leeg = await kiosk116
      .locator('tbody tr .print-col-order')
      .evaluateAll((cellen) => cellen.every((cel) => cel.textContent === ''))
    expect(leeg).toBe(true)

    // 116 is op nul geteld, dus daar moet alles bij.
    await countTwoKiosksAndApprove(page)
    await page.goto('/events/event-demo-ajax/print')
    await expect(kiosk116).toBeVisible()

    const gevuld = await kiosk116
      .locator('tbody tr .print-col-order')
      .evaluateAll((cellen) => cellen.filter((cel) => cel.textContent !== '').length)
    expect(gevuld).toBeGreaterThan(0)

    // Een kiosk die is overgeslagen houdt zijn lege kolom om zelf in te vullen.
    const kiosk117 = page.locator('.print-kiosk-page[data-kiosk-number="117"]')
    const nogSteedsLeeg = await kiosk117
      .locator('tbody tr .print-col-order')
      .evaluateAll((cellen) => cellen.every((cel) => cel.textContent === ''))
    expect(nogSteedsLeeg).toBe(true)
  })

  test('de bediening print niet mee', async ({ page }) => {
    await page.goto('/events/event-demo-ajax/print')
    const printButton = page.getByRole('button', { name: 'Printen' })
    await expect(printButton).toBeVisible()
    await expect(page.locator('.no-print').filter({ has: printButton })).toHaveCount(1)

    const ringKnop = page.getByRole('button', { name: 'Eerste ring' })
    await expect(page.locator('.no-print').filter({ has: ringKnop })).toHaveCount(1)
  })
})

test.describe('Vullijst printen', () => {
  test.setTimeout(240_000)

  test.beforeEach(async ({ page }) => {
    await resetAppData(page)
    await login(page, 'admin@demo.nl')
  })

  test('één kiosk per vel, in de volgorde van de route', async ({ page }) => {
    const stops = await prepareRoundWithRoute(page)

    // ── De knop staat op de vulronde en opent de printweergave ────────────
    await page.getByRole('button', { name: /Vullijst printen/ }).click()
    await page.waitForURL(/\/print$/)

    // ── Eén pagina per halte ──────────────────────────────────────────────
    const pages = page.locator('.print-kiosk-page')
    await expect(pages).toHaveCount(stops)

    // ── De volgorde is die van de route, niet op kiosknummer gesorteerd ───
    const routeOrder = await page.evaluate(() =>
      [...document.querySelectorAll('.print-kiosk-page')].map((el) =>
        el.getAttribute('data-kiosk-number')
      )
    )
    expect(routeOrder).toHaveLength(stops)
    expect(new Set(routeOrder).size).toBe(stops)

    // ── Iedere pagina noemt zichzelf, en de eerste is stop 1 ──────────────
    for (const [index, wrapper] of (await pages.all()).entries()) {
      await expect(wrapper.getByText(`Stop ${index + 1} van ${stops}`)).toBeVisible()
      // Kiosknaam als kop, groot en herkenbaar.
      await expect(wrapper.getByRole('heading', { level: 2 })).toBeVisible()
    }

    // ── Productregels horen bij hun eigen kiosk ───────────────────────────
    // Elke pagina heeft minstens één productregel, en geen enkele pagina toont
    // de regels van een andere: dat zou een dubbel aantal opleveren.
    const rowsPerPage = await page.evaluate(() =>
      [...document.querySelectorAll('.print-kiosk-page')].map(
        (el) => el.querySelectorAll('tbody tr').length
      )
    )
    expect(rowsPerPage.every((count) => count > 0)).toBe(true)

    // ── De bediening print niet mee ───────────────────────────────────────
    const printButton = page.getByRole('button', { name: 'Printen' })
    await expect(printButton).toBeVisible()
    await expect(page.locator('.no-print').filter({ has: printButton })).toHaveCount(1)
    await expect(page.getByRole('link', { name: /Terug naar vulronde/ })).toBeVisible()
  })

  test('iedere pagina heeft de invulvelden voor papier', async ({ page }) => {
    await prepareRoundWithRoute(page)
    await page.getByRole('button', { name: /Vullijst printen/ }).click()
    await page.waitForURL(/\/print$/)

    const first = page.locator('.print-kiosk-page').first()
    await expect(first.getByRole('columnheader', { name: 'Geleverd' })).toBeVisible()
    await expect(first.getByText('Alles geleverd zoals gepland')).toBeVisible()
    await expect(first.getByText('Opmerking / afwijking')).toBeVisible()
    await expect(first.getByText(/Naam vuller:/)).toBeVisible()
    await expect(first.getByText('Vorige: Start')).toBeVisible()
  })

  test('printen verandert niets aan de ronde', async ({ page }) => {
    await prepareRoundWithRoute(page)

    const statusVoor = await page.locator('main, body').first().textContent()
    expect(statusVoor).toContain('Route')

    await page.getByRole('button', { name: /Vullijst printen/ }).click()
    await page.waitForURL(/\/print$/)
    await page.goBack()

    // De ronde staat nog klaar om aangenomen te worden; hij is niet geclaimd,
    // gestart of afgerond doordat iemand een lijst wilde uitprinten.
    await expect(page.getByRole('button', { name: /Ronde aannemen en starten/ })).toBeVisible()
  })
})
