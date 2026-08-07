import { test, expect } from '@playwright/test'
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
