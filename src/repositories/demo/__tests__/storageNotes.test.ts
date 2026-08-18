import { describe, it, expect, beforeEach } from 'vitest'
import { DemoKioskRepository } from '../DemoKioskRepository'
import { resetDemoTables } from '../demoTables'

/**
 * Opmerkingen bij een kiosk, zoals Beheer › Opmerkingen ze bewerkt.
 *
 * De regels die de database bewaakt — één opmerking per kiosk per product, één
 * per kiosk per categorie, en nooit allebei tegelijk op één regel — moeten in
 * demo-modus net zo hard gelden. Anders werkt het beheerscherm lokaal en klapt
 * het in de ArenA op een constraint.
 */
describe('opmerkingen bij een kiosk', () => {
  const repo = new DemoKioskRepository()

  beforeEach(() => {
    resetDemoTables()
  })

  it('geeft de opmerkingen die er vanaf het begin staan', async () => {
    const notes = await repo.getStorageNotes()

    const bekers = notes.find((n) => n.kioskId === 'kiosk-401' && n.productId === 'bierbeker-05')
    expect(bekers?.note).toBe('2 dozen achter in de kiosk')

    const chips = notes.find((n) => n.kioskId === 'kiosk-426' && n.categoryId === 'cat-chips')
    expect(chips?.note).toBe('3 op de plank, onder elk luik 1 doos')
  })

  it('bewaart een nieuwe opmerking bij een product', async () => {
    const saved = await repo.saveStorageNote({
      kioskId: 'kiosk-402',
      productId: 'bierbeker-05',
      note: 'Onder de trap',
    })

    expect(saved.id).toBeTruthy()
    const notes = await repo.getStorageNotes()
    expect(notes.find((n) => n.id === saved.id)?.note).toBe('Onder de trap')
  })

  it('overschrijft de opmerking die er al stond bij dat product', async () => {
    const before = await repo.getStorageNotes()

    await repo.saveStorageNote({
      kioskId: 'kiosk-401',
      productId: 'bierbeker-05',
      note: '3 dozen achter in de kiosk',
    })

    const after = await repo.getStorageNotes()
    expect(after).toHaveLength(before.length)
    const bekers = after.filter((n) => n.kioskId === 'kiosk-401' && n.productId === 'bierbeker-05')
    expect(bekers).toHaveLength(1)
    expect(bekers[0]!.note).toBe('3 dozen achter in de kiosk')
  })

  it('overschrijft de opmerking die er al stond bij die categorie', async () => {
    await repo.saveStorageNote({
      kioskId: 'kiosk-426',
      categoryId: 'cat-chips',
      note: 'Alles op de plank',
    })

    const chips = (await repo.getStorageNotes()).filter(
      (n) => n.kioskId === 'kiosk-426' && n.categoryId === 'cat-chips'
    )
    expect(chips).toHaveLength(1)
    expect(chips[0]!.note).toBe('Alles op de plank')
  })

  it('houdt product en categorie van dezelfde kiosk uit elkaar', async () => {
    await repo.saveStorageNote({
      kioskId: 'kiosk-401',
      categoryId: 'cat-chips',
      note: 'Alles op de plank',
    })

    const notes = await repo.getStorageNotes()
    expect(
      notes.find((n) => n.kioskId === 'kiosk-401' && n.productId === 'bierbeker-05')?.note
    ).toBe('2 dozen achter in de kiosk')
  })

  it('weigert een opmerking die zowel een product als een categorie noemt', async () => {
    await expect(
      repo.saveStorageNote({
        kioskId: 'kiosk-401',
        productId: 'bierbeker-05',
        categoryId: 'cat-chips',
        note: 'Allebei',
      })
    ).rejects.toThrow()
  })

  it('weigert een opmerking die nergens bij hoort', async () => {
    await expect(repo.saveStorageNote({ kioskId: 'kiosk-401', note: 'Zomaar' })).rejects.toThrow()
  })

  it('weigert een lege opmerking', async () => {
    // Leeg opslaan is "weghalen"; dat gaat via deleteStorageNote, anders staat
    // er een onzichtbaar regeltje in de weg bij het volgende opslaan.
    await expect(
      repo.saveStorageNote({ kioskId: 'kiosk-402', productId: 'bierbeker-05', note: '   ' })
    ).rejects.toThrow()
  })

  it('haalt een opmerking weg', async () => {
    const notes = await repo.getStorageNotes()
    const target = notes.find((n) => n.kioskId === 'kiosk-401' && n.productId === 'bierbeker-05')!

    await repo.deleteStorageNote(target.id)

    const after = await repo.getStorageNotes()
    expect(after.map((n) => n.id)).not.toContain(target.id)
    expect(after).toHaveLength(notes.length - 1)
  })
})
