/**
 * Drukt de normenlijst af zoals hij nu in de seed staat, om hem te kunnen
 * nakijken tegen de papieren bestellijst.
 *
 * Draaien met: npx tsx scripts/showAssortment.ts [kiosknummer...]
 */
import { demoProducts, demoStandards, demoKiosks } from '../src/lib/seed/demoData'
import { KIOSKS_WITH_DRINKS_FRIDGE } from '../src/lib/seed/assortment'
import { kioskTitle } from '../src/lib/kiosk'

const requested = process.argv.slice(2).map(Number).filter(Number.isFinite)
const numbers = requested.length > 0 ? requested : [122, 120, 1201, 118, 110, 112, 116, 121]

const productById = new Map(demoProducts.map((p) => [p.id, p]))

console.log(`${demoProducts.length} producten, ${demoStandards.length} normen totaal\n`)

for (const number of numbers) {
  const kiosk = demoKiosks.find((k) => k.number === number)
  if (!kiosk) {
    console.log(`kiosk ${number}: bestaat niet\n`)
    continue
  }

  const mine = demoStandards.filter((s) => s.kioskId === kiosk.id)
  const fridge = KIOSKS_WITH_DRINKS_FRIDGE.has(number) ? 'met koeling' : 'zonder koeling'

  console.log(`── ${kioskTitle(kiosk)} (${fridge}) — ${mine.length} producten`)
  for (const standard of mine) {
    const product = productById.get(standard.productId)
    if (!product) continue
    const amount = String(standard.targetQuantityQuarters / 4).padStart(3)
    console.log(`   ${product.name.padEnd(24)}${amount} ${product.packagingUnit}`)
  }
  console.log('')
}
