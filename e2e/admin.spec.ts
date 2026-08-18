import { test, expect, type Page } from '@playwright/test'
import { login, resetAppData } from './helpers'

test.describe('Beheer', () => {
  test.beforeEach(async ({ page }) => {
    await resetAppData(page)
    await login(page, 'admin@demo.nl')
  })

  test('ring toevoegen en terugzien', async ({ page }) => {
    await page.goto('/admin/rings')
    await page.getByRole('button', { name: '+ Nieuw' }).click()

    await page.getByLabel('Naam').fill('Derde ring')
    await page.getByLabel('Omschrijving').fill('Kiosknummers 700-serie')
    await page.getByLabel('Volgorde').fill('3')
    await page.getByRole('button', { name: 'Opslaan' }).click()

    await expect(page.getByText('Derde ring')).toBeVisible()
    await expect(page.getByText('Kiosknummers 700-serie')).toBeVisible()

    // Blijft staan na herladen: het is echt opgeslagen.
    await page.reload()
    await expect(page.getByText('Derde ring')).toBeVisible()
  })

  test('categorie toevoegen en uitschakelen weigeren bij actieve producten', async ({ page }) => {
    await page.goto('/admin/categories')

    await page.getByRole('button', { name: '+ Nieuw' }).click()
    await page.getByLabel('Naam').fill('Testcategorie')
    await page.getByRole('button', { name: 'Opslaan' }).click()
    await expect(page.getByText('Testcategorie')).toBeVisible()

    // Een categorie mét actieve producten mag niet stilletjes uit.
    await page.getByRole('button', { name: /^Drank/ }).click()
    await page.getByRole('checkbox').uncheck()
    await page.getByRole('button', { name: 'Opslaan' }).click()

    await expect(page.getByText(/actieve producten/)).toBeVisible()
  })

  test('kiosk toevoegen, met controle op dubbele nummers', async ({ page }) => {
    await page.goto('/admin/kiosks')
    await page.getByRole('button', { name: '+ Nieuw' }).click()

    // Bestaand nummer wordt geweigerd.
    await page.getByLabel('Nummer').fill('101')
    await page.getByRole('button', { name: 'Opslaan' }).click()
    await expect(page.getByText(/bestaat al in deze ring/)).toBeVisible()

    await page.getByLabel('Nummer').fill('199')
    await page.getByLabel('Naam').fill('Testkiosk')
    await page.getByRole('button', { name: 'Opslaan' }).click()

    await expect(page.getByText('199')).toBeVisible()
    await page.reload()
    await expect(page.getByText('199')).toBeVisible()
  })

  test('product aanmaken en terugvinden in de lijst', async ({ page }) => {
    await page.goto('/admin/products')
    await page.getByRole('button', { name: '+ Nieuw' }).click()

    await page.getByLabel('Naam', { exact: true }).fill('Testproduct')
    await page.getByLabel('Korte naam').fill('Test')
    await page.getByLabel('Teleenheid').fill('pak')
    await page.getByLabel('Verpakkingseenheid').fill('pakken')
    await page.getByRole('button', { name: 'Opslaan' }).click()

    await page.waitForURL(/\/admin\/products$/)
    await expect(page.getByText('Testproduct')).toBeVisible()
  })

  test('voorraadnorm aanpassen en bulk kopiëren', async ({ page }) => {
    await page.goto('/admin/standards')

    await page.getByLabel('Kiosk').selectOption({ label: 'Kiosk 101' })
    const firstNorm = page.getByLabel(/^Norm voor /).first()
    await firstNorm.fill('9')
    await firstNorm.blur()

    await page.reload()
    await page.getByLabel('Kiosk').selectOption({ label: 'Kiosk 101' })
    await expect(page.getByLabel(/^Norm voor /).first()).toHaveValue('9')

    // Kopieer de normen van 101 naar 102.
    await page.getByRole('button', { name: /Normen kopiëren/ }).click()
    await page.getByLabel('Van kiosk').selectOption({ label: 'Kiosk 101' })
    await page.getByRole('button', { name: '102', exact: true }).click()
    await page.getByRole('button', { name: /^Kopiëren/ }).click()

    await expect(page.getByText(/normen gekopieerd/)).toBeVisible()

    await page.getByLabel('Kiosk').selectOption({ label: 'Kiosk 102' })
    await expect(page.getByLabel(/^Norm voor /).first()).toHaveValue('9')
  })

  test('een teller ziet geen conflictpagina', async ({ page }) => {
    await login(page, 'teller1@demo.nl')
    await page.goto('/conflicts')

    await expect(page.getByRole('heading', { name: 'Geen toegang' })).toBeVisible()
  })

  test('een planner ziet de conflictpagina, leeg als er niets is', async ({ page }) => {
    await login(page, 'planner@demo.nl')
    await page.goto('/conflicts')

    await expect(page.getByRole('heading', { name: 'Geen conflicten' })).toBeVisible()
  })
})

test.describe('Startkiosk per ring', () => {
  test.beforeEach(async ({ page }) => {
    await resetAppData(page)
    await login(page, 'admin@demo.nl')
  })

  test('agenda invullen en er een evenement uit kiezen', async ({ page }) => {
    // Morgen, zodat deze regel gegarandeerd de eerstvolgende is.
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)

    await page.goto('/admin/agenda')
    await page.getByRole('button', { name: '+ Nieuw' }).click()
    await page.getByLabel('Naam').fill('Ajax – Sparta')
    await page.getByLabel('Datum').fill(tomorrow)
    await page.getByRole('button', { name: 'Opslaan' }).click()
    await expect(page.getByText('Ajax – Sparta')).toBeVisible()

    // Een nieuw evenement kiest uit de agenda in plaats van overtypen; de
    // eerstvolgende staat meteen goed.
    await page.goto('/events/new')
    await expect(page.getByLabel('Naam')).toHaveValue('Ajax – Sparta')
    await expect(page.getByLabel('Datum')).toHaveValue(tomorrow)

    // Het aantal bezoekers vroeg niemand iets; dat veld is weg.
    await expect(page.getByLabel(/bezoekers/i)).toHaveCount(0)
  })

  test('het dashboard loopt uit zichzelf door naar de volgende wedstrijd', async ({ page }) => {
    // De situatie na een speeldag: het laatste evenement is geweest en er is
    // nog geen nieuw aangemaakt. Het dashboard moet dan de kalender volgen en
    // niet naar de wedstrijd van gisteren blijven wijzen.
    await page.goto('/events/event-demo-ajax')
    await page.getByRole('button', { name: 'Evenement verwijderen' }).click()
    await page.getByRole('button', { name: 'Verwijderen', exact: true }).click()
    await page.waitForURL(/\/events$/)

    await page.goto('/dashboard')
    await expect(page.getByRole('heading', { name: 'Eerstvolgende evenement' })).toBeVisible()
    await expect(page.getByText('Ajax – PSV')).toBeVisible()
    await expect(page.getByText('Uit de agenda')).toBeVisible()

    // Eén tik maakt het evenement aan en zet de telronde klaar.
    await page.getByRole('button', { name: 'Telronde starten' }).click()
    await page.waitForURL(/\/events\/[^/]+\/count\/start/)

    await page.goto('/events')
    await expect(page.getByRole('link', { name: /Ajax – PSV/ })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Komt eraan' })).toBeVisible()
  })

  test('een evenement verwijderen, met alles wat eraan hangt', async ({ page }) => {
    await page.goto('/events/event-demo-ajax')
    await page.getByRole('button', { name: 'Evenement verwijderen' }).click()
    await expect(page.getByText(/telrondes met hun telregels/)).toBeVisible()
    await page.getByRole('button', { name: 'Verwijderen', exact: true }).click()

    await page.waitForURL(/\/events$/)
    await expect(page.locator('a[href="/events/event-demo-ajax"]')).toHaveCount(0)

    // De wedstrijd zelf staat nog op de kalender. Die hoort dus terug te komen
    // als iets dat nog aangemaakt moet worden — het evenement is verwijderd,
    // de speeldag niet afgelast.
    await expect(page.getByText('Ajax – Demo FC')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Nog aan te maken' })).toBeVisible()
  })

  test('een nieuw evenement legt zijn voorganger vast', async ({ page }) => {
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)

    await page.goto('/events/new')
    await page.getByLabel('Naam').fill('Ajax – Vitesse')
    await page.getByLabel('Datum').fill(tomorrow)
    await page.getByRole('button', { name: 'Evenement aanmaken' }).click()
    await page.waitForURL(/\/events\/(?!new$)[^/]+$/)

    // Het demo-evenement staat op een latere datum, dus dat telt niet als
    // voorganger; er is er hier geen.
    await expect(page.getByText(/Vorig evenement/)).toHaveCount(0)
  })

  test('ringbeheer is te vinden via het beheeroverzicht', async ({ page }) => {
    await page.goto('/dashboard')
    await page.getByRole('link', { name: /Alle instellingen/ }).click()
    await page.waitForURL(/\/admin$/)

    await page.getByRole('link', { name: /Ringen/ }).click()
    await page.waitForURL(/\/admin\/rings/)
    await expect(page.getByText('Eerste ring')).toBeVisible()
  })

  test('de ingestelde startkiosk staat in het formulier', async ({ page }) => {
    await page.goto('/admin/rings')
    await page.getByRole('button', { name: /Eerste ring/ }).click()

    // Wat in de gegevens staat, moet ook voorgeselecteerd zijn.
    await expect(page.getByLabel('Startkiosk tellen')).toHaveValue('kiosk-127')
    await expect(page.getByLabel('Startkiosk vullen')).toHaveValue('kiosk-122')
  })

  test('een telronde begint op de ingestelde kiosk', async ({ page }) => {
    await page.goto('/events/event-demo-ajax/count/start')

    // 127 is ingesteld als startkiosk voor tellen; niet 101.
    await expect(page.getByLabel('Startkiosk')).toHaveValue('kiosk-127')
    await expect(page.getByText(/^127 → /)).toBeVisible()
  })

  test('een gewijzigde startkiosk werkt door in de telronde', async ({ page }) => {
    await page.goto('/admin/rings')
    await page.getByRole('button', { name: /Eerste ring/ }).click()
    await page.getByLabel('Startkiosk tellen').selectOption('kiosk-110')
    await page.getByRole('button', { name: 'Opslaan' }).click()

    await page.goto('/events/event-demo-ajax/count/start')
    await expect(page.getByLabel('Startkiosk')).toHaveValue('kiosk-110')
  })
})

/**
 * Opmerkingen over waar de voorraad bij een kiosk ligt.
 *
 * Ze stonden als vaste lijst in de code: een doos die verhuisde wachtte op een
 * deploy. Deze tests bewaken de weg die daarvoor in de plaats komt — van het
 * beheerscherm tot het telscherm waar de teller ernaar kijkt.
 */
/**
 * Kiezen gaat net als op het Kiosken-tab: eerst de ring, dan de tegel.
 *
 * Alle kiosken in één keuzelijst was niet te overzien — vijfenvijftig regels
 * waarvan je er één zoekt.
 */
async function selectKiosk(page: Page, naam: string): Promise<void> {
  await page.getByRole('button', { name: 'Tweede ring', exact: true }).click()
  await page.getByRole('button', { name: new RegExp(`^${naam}`) }).click()
}

test.describe('Opmerkingen bij een kiosk', () => {
  test.beforeEach(async ({ page }) => {
    await resetAppData(page)
    await login(page, 'admin@demo.nl')
  })

  test('toont wat er bij een kiosk hoort te staan', async ({ page }) => {
    await page.goto('/admin/opmerkingen')
    await selectKiosk(page, 'Kiosk 401')

    // 401 heeft er twee: één bij een product, één bij een hele categorie.
    await expect(page.getByText('2 dozen achter in de kiosk')).toBeVisible()
    await expect(page.getByText('3 op de plank, onder elk luik 1 doos')).toBeVisible()
  })

  test('laat in het overzicht zien waar al iets staat', async ({ page }) => {
    // Het raster is het overzicht: zonder telling moet je elke kiosk los
    // openen om te zien of er iets bij staat.
    await page.goto('/admin/opmerkingen')
    await page.getByRole('button', { name: 'Tweede ring', exact: true }).click()

    await expect(page.getByRole('button', { name: /^Kiosk 401, 2 opmerkingen/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /^Kiosk 403, geen opmerkingen/ })).toBeVisible()
  })

  test('opmerking toevoegen, wijzigen en weghalen', async ({ page }) => {
    await page.goto('/admin/opmerkingen')
    await selectKiosk(page, 'Kiosk 403')

    await page.getByRole('button', { name: '+ Nieuw' }).click()
    await page.getByLabel('Hoort bij').selectOption('product:bierbeker-05')
    await page.getByLabel('Opmerking', { exact: true }).fill('Achter de koeling')
    await page.getByRole('button', { name: 'Opslaan' }).click()

    await expect(page.getByText('Achter de koeling')).toBeVisible()

    // Echt opgeslagen, niet alleen op het scherm.
    await page.reload()
    await selectKiosk(page, 'Kiosk 403')
    await expect(page.getByText('Achter de koeling')).toBeVisible()

    await page.getByRole('button', { name: /Achter de koeling/ }).click()
    await page.getByLabel('Opmerking', { exact: true }).fill('Achter de koeling, onderste plank')
    await page.getByRole('button', { name: 'Opslaan' }).click()
    await expect(page.getByText('Achter de koeling, onderste plank')).toBeVisible()

    await page.getByRole('button', { name: /Achter de koeling/ }).click()
    await page.getByRole('button', { name: 'Weghalen' }).click()
    await expect(page.getByText('Achter de koeling')).toHaveCount(0)
  })

  test('een gewijzigde opmerking staat op het telscherm', async ({ page }) => {
    await page.goto('/admin/opmerkingen')
    await selectKiosk(page, 'Kiosk 401')

    await page.getByRole('button', { name: /2 dozen achter in de kiosk/ }).click()
    await page.getByLabel('Opmerking', { exact: true }).fill('Vier dozen achter in de kiosk')
    await page.getByRole('button', { name: 'Opslaan' }).click()
    await expect(page.getByText('Vier dozen achter in de kiosk')).toBeVisible()

    // En dan waar het om gaat: de teller ziet het bij het product zelf.
    await page.goto('/events/event-demo-ajax/count/start')
    await page.getByLabel('Ring').selectOption({ label: 'Tweede ring' })
    await page.getByLabel('Startkiosk').selectOption('kiosk-401')
    await page.getByRole('button', { name: /Telronde starten/ }).click()
    await page.waitForURL(/\/kiosk\/kiosk-401/)

    await expect(page.getByText('Vier dozen achter in de kiosk')).toBeVisible()
  })
})
