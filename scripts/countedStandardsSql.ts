/**
 * Drukt SQL af die de getelde normen in een bestaande database zet.
 *
 * `npm run seed` kan dit ook, maar niet op de server: de container bevat
 * alleen de standalone build (geen scripts/, geen tsx) en de db-container
 * heeft geen poort naar buiten. En seeden doet meer dan nodig — het zet ook
 * normen terug die iemand in Beheer met de hand heeft aangepast.
 *
 * Dit script raakt alleen de combinaties kiosk/product aan die daadwerkelijk
 * geteld zijn. Alles wat niet geteld is blijft staan zoals het staat.
 *
 * Draaien met:
 *   npx tsx scripts/countedStandardsSql.ts > normen.sql
 *
 * En op de server, in één transactie:
 *   docker compose exec -T db psql -U logistiek -d logistiek \
 *     -v ON_ERROR_STOP=1 --single-transaction < normen.sql
 */
import { COUNTED_DRINK_STANDARDS } from '../src/lib/seed/assortment'
import { demoProducts } from '../src/lib/seed/demoData'

const nameBySeedId = new Map(demoProducts.map((product) => [product.id, product.name]))

const out: string[] = [
  '-- Getelde normen. Gegenereerd door scripts/countedStandardsSql.ts.',
  '',
]

for (const [kioskNumber, products] of Object.entries(COUNTED_DRINK_STANDARDS)) {
  out.push(`-- kiosk ${kioskNumber}`)

  for (const [seedId, packages] of Object.entries(products)) {
    const name = nameBySeedId.get(seedId)
    if (!name) throw new Error(`Onbekend product "${seedId}" in de getelde normen.`)
    // De namen komen uit onze eigen catalogus; een apostrof erin zou de SQL
    // breken, dus dat melden we liever dan dat we het proberen te ontwijken.
    if (name.includes("'")) throw new Error(`Productnaam met apostrof: "${name}".`)

    out.push(
      `insert into kiosk_product_standards
     (kiosk_id, product_id, target_quantity_quarters, half_package_threshold_pct, is_active)
select k.id, p.id, ${packages * 4}, 80, true
  from kiosks k, products p
 where k.number = ${kioskNumber} and p.name = '${name}'
    on conflict (kiosk_id, product_id) do update
   set target_quantity_quarters = excluded.target_quantity_quarters,
       is_active = true;`
    )
  }

  out.push('')
}

console.log(out.join('\n'))
