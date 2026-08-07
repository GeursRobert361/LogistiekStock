import { describe, it, expect, beforeEach } from 'vitest'
import { DemoProductRepository } from '../DemoProductRepository'
import { demoTables, resetDemoTables } from '../demoTables'

/**
 * Verwijderen is niet hetzelfde als uitschakelen.
 *
 * Uitschakelen haalt een product uit de tellijsten maar laat het in het beheer
 * staan — handig voor iets dat volgende wedstrijd terugkomt. Verwijderen haalt
 * het overal weg. De rij blijft wel bestaan: er hangen tellingen en leveringen
 * aan die anders niet meer te lezen zijn.
 */
describe('product verwijderen', () => {
  const repo = new DemoProductRepository()

  beforeEach(() => {
    resetDemoTables()
  })

  it('haalt het product uit alle lijsten, ook uit die met inactieve', async () => {
    const before = await repo.getProducts({ activeOnly: false })
    const target = before[0]!

    await repo.deleteProduct(target.id)

    const after = await repo.getProducts({ activeOnly: false })
    expect(after.map((p) => p.id)).not.toContain(target.id)
    expect(after).toHaveLength(before.length - 1)
  })

  it('laat een uitgeschakeld product wél in het beheer staan', async () => {
    const products = await repo.getProducts()
    const target = products[0]!

    await repo.updateProduct(target.id, { isActive: false })

    expect((await repo.getProducts()).map((p) => p.id)).not.toContain(target.id)
    expect((await repo.getProducts({ activeOnly: false })).map((p) => p.id)).toContain(target.id)
  })

  it('zet de normen bij de kiosken uit, zodat het niet via een telronde terugkomt', async () => {
    const products = await repo.getProducts()
    const target = products[0]!
    const kioskId = demoTables.standards.filter((s) => s.productId === target.id)[0]!.kioskId

    expect((await repo.getStandards(kioskId)).map((s) => s.productId)).toContain(target.id)

    await repo.deleteProduct(target.id)

    expect((await repo.getStandards(kioskId)).map((s) => s.productId)).not.toContain(target.id)
  })

  it('bewaart de rij, zodat oude tellingen leesbaar blijven', async () => {
    const products = await repo.getProducts()
    const target = products[0]!

    await repo.deleteProduct(target.id)

    const stored = await repo.getProductById(target.id)
    expect(stored?.name).toBe(target.name)
    expect(stored?.deletedAt).toBeTruthy()
  })
})
