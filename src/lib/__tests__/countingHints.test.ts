import { describe, it, expect } from 'vitest'
import { countingHints, countingHintFor } from '../countingHints'
import { demoCategories } from '@/lib/seed/catalogue'
import { POSTMIX_COUNTING_RULE } from '@/lib/seed/secondRingStandards'

/**
 * De telinstructie bij een categorie.
 *
 * De koppeling loopt via de categorienaam, en dat is waar dit stil kan breken:
 * hernoem "Post-mix" in de catalogus en de instructie verdwijnt zonder dat er
 * iets stukgaat. Vandaar een test op de koppeling in plaats van vertrouwen.
 */

describe('countingHintFor', () => {
  it('geeft de telinstructie van Post-mix', () => {
    const hint = countingHintFor('Post-mix')

    expect(hint).toBeDefined()
    expect(hint?.lines[0]).toMatch(/reservepakken buiten het rek/)
  })

  it('zwijgt bij een categorie zonder instructie', () => {
    expect(countingHintFor('Chips')).toBeUndefined()
    expect(countingHintFor('Bierbekers')).toBeUndefined()
    expect(countingHintFor(null)).toBeUndefined()
  })
})

describe('de instructies zelf', () => {
  it('verwijzen naar bestaande categorienamen', () => {
    const namen = new Set(demoCategories.map((c) => c.name))
    for (const hint of countingHints) {
      expect(namen.has(hint.categoryName), hint.categoryName).toBe(true)
    }
  })

  it('noemen bij Post-mix de vier regels van de bron', () => {
    const regels = countingHintFor('Post-mix')!.lines.join(' ')

    expect(regels).toMatch(/reservepakken buiten het rek/i)
    expect(regels).toMatch(/lege pakken/i)
    expect(regels).toMatch(new RegExp(`${POSTMIX_COUNTING_RULE.connectedPackageEmptyBelowPct}%`))
    expect(regels).toMatch(/FIFO/)
  })

  it('zeggen hetzelfde als de regel bij de stamdata', () => {
    // De instructie op het scherm en de regel in de seedcode horen niet uit
    // elkaar te lopen; twee versies van dezelfde afspraak worden er vroeg of
    // laat twee die iets anders zeggen.
    expect(POSTMIX_COUNTING_RULE.countsReservePackagesOnly).toBe(true)
    expect(POSTMIX_COUNTING_RULE.refillOrder).toBe('FIFO')
  })
})
