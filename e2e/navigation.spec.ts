import { test, expect } from '@playwright/test'
import { login, resetAppData } from './helpers'

/**
 * De onderbalk op het kleinste scherm dat we ondersteunen.
 *
 * Een admin ziet zes items. Of dat te krap wordt is geen smaakkwestie: het is
 * te meten. Deze test legt vast wat er moet kloppen, zodat een zevende item of
 * een langer label meteen opvalt in plaats van pas op de vloer.
 */

/** Kleinste breedte die we aanhouden — een iPhone SE staand. */
const SMALLEST = { width: 320, height: 568 }

/** WCAG 2.5.5 (AAA) houdt 44 × 44 CSS-pixels aan als ondergrens. */
const MINIMUM_TARGET = 44

test.describe('Onderbalk op een klein scherm', () => {
  test.use({ viewport: SMALLEST })

  test.beforeEach(async ({ page }) => {
    await resetAppData(page)
    await login(page, 'admin@demo.nl')
  })

  test('houdt bruikbare aanraakvlakken voor alle items', async ({ page }) => {
    const items = page.getByRole('navigation', { name: 'Hoofdnavigatie' }).getByRole('link')
    const count = await items.count()
    expect(count).toBeGreaterThan(0)

    for (let index = 0; index < count; index++) {
      const box = await items.nth(index).boundingBox()
      expect(box, `item ${index} heeft geen afmeting`).not.toBeNull()
      expect(box!.width, `item ${index} is te smal`).toBeGreaterThanOrEqual(MINIMUM_TARGET)
      expect(box!.height, `item ${index} is te laag`).toBeGreaterThanOrEqual(MINIMUM_TARGET)
    }
  })

  test('laat de balk niet buiten het scherm lopen', async ({ page }) => {
    const nav = page.getByRole('navigation', { name: 'Hoofdnavigatie' })
    const box = await nav.boundingBox()

    expect(box!.width).toBeLessThanOrEqual(SMALLEST.width)

    // Geen horizontale schuifbalk: dan valt er een item buiten beeld.
    const overflows = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    )
    expect(overflows).toBe(false)
  })

  test('houdt de labels op één regel leesbaar', async ({ page }) => {
    const labels = page
      .getByRole('navigation', { name: 'Hoofdnavigatie' })
      .getByRole('link')
      .locator('span')

    const count = await labels.count()
    for (let index = 0; index < count; index++) {
      const label = labels.nth(index)
      const wrapped = await label.evaluate((element) => {
        const style = window.getComputedStyle(element)
        const lineHeight = parseFloat(style.lineHeight) || element.clientHeight
        // Meer dan één regelhoogte betekent dat het label is afgebroken.
        return element.getBoundingClientRect().height > lineHeight * 1.5
      })
      expect(wrapped, `label ${await label.textContent()} breekt af`).toBe(false)
    }
  })
})
