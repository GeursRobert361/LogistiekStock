/**
 * Synchroniseert de authoritative tweede-ringstamdata naar een bestaande
 * database.
 *
 * Waarom niet gewoon `seedDb`: die doet veel meer. Hij raakt de eerste ring,
 * de agenda, de gebruikers en alle normen — en zet daarmee ook wijzigingen
 * terug die iemand bewust in Beheer heeft gemaakt. Voor het bijwerken van deze
 * ene set stamdata is dat te grof gereedschap.
 *
 * Wat dit script wél doet:
 *   · de productcatalogus die deze stamdata nodig heeft
 *   · de kiosken van de authoritative locaties (opschrift, drankopslag)
 *   · hun voorraadnormen, inclusief het uitschakelen van wat er niet meer hoort
 *
 * Wat het nooit doet: eerste ring, evenementen, tellingen, bijvulbehoeften,
 * leveringen, gebruikers, wachtwoorden, agenda. En het verzint nooit een norm
 * door naar een vergelijkbare kiosk te kijken — de bron is uitsluitend de
 * papieren lijst plus de latere notitie.
 *
 * Draaien:
 *   npx tsx scripts/syncSecondRingMasterData.ts            proefdraai, wijzigt niets
 *   npx tsx scripts/syncSecondRingMasterData.ts --apply    voert uit, in één transactie
 */
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Client } from 'pg'
import { loadEnvFile, requireDatabaseUrl } from './env'
import { assertSchemaReady, resolveProductIds, resolveKioskIds } from './lib/resolveSeedIds'
import { demoKiosks, demoStandards } from '../src/lib/seed/demoData'
import { demoProducts } from '../src/lib/seed/catalogue'
import { authoritativeKioskKeys } from '../src/lib/seed/secondRingStandards'
import {
  buildSyncPlan,
  EXPECTED_DRINK_MATRIX,
  EXPECTED_STORAGE_TYPES,
  type CurrentKiosk,
  type CurrentStandard,
  type DesiredKiosk,
  type DesiredStandard,
} from '../src/lib/seed/syncPlan'
import { DrinkStorageType } from '../src/types'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
loadEnvFile(root)

const APPLY = process.argv.includes('--apply')

const PAPER_DRINK_ORDER = [
  'chaudfontaine-blauw',
  'chaudfontaine-rood',
  'fuze-tea',
  'heineken-00',
  'radler',
  'stelz-icetea',
  'bacardi-lemon',
  'jack-daniels',
  'redbull',
  'bacardi-cola',
]

const client = new Client({ connectionString: requireDatabaseUrl() })

/** De kiosken waar deze config gezag over heeft, plus wat ze moeten zijn. */
function desiredKiosks(): DesiredKiosk[] {
  return demoKiosks
    .filter((kiosk) => authoritativeKioskKeys.has(kiosk.id))
    .map((kiosk) => ({
      kioskKey: kiosk.id,
      number: kiosk.number,
      label: kiosk.label,
      drinkStorageType: kiosk.drinkStorageType,
    }))
}

function desiredStandards(): DesiredStandard[] {
  return demoStandards
    .filter((standard) => authoritativeKioskKeys.has(standard.kioskId))
    .map((standard) => ({
      kioskKey: standard.kioskId,
      productId: standard.productId,
      targetQuantityQuarters: standard.targetQuantityQuarters,
    }))
}

async function readCurrentKiosks(): Promise<Map<number, CurrentKiosk>> {
  const { rows } = await client.query<{
    number: number
    label: string | null
    drink_storage_type: string
  }>('select number, label, drink_storage_type from kiosks where deleted_at is null')

  return new Map(
    rows.map((row) => [
      Number(row.number),
      {
        number: Number(row.number),
        label: row.label,
        drinkStorageType: row.drink_storage_type as DrinkStorageType,
      },
    ])
  )
}

async function readCurrentStandards(kioskIds: Map<string, string>): Promise<CurrentStandard[]> {
  const dbIds = [...kioskIds.values()]
  if (dbIds.length === 0) return []

  const keyByDbId = new Map([...kioskIds].map(([key, id]) => [id, key]))
  const productIds = await resolveProductIds(client)
  const seedIdByDbId = new Map([...productIds].map(([seedId, id]) => [id, seedId]))

  const { rows } = await client.query<{
    kiosk_id: string
    product_id: string
    target_quantity_quarters: number
    is_active: boolean
  }>(
    `select kiosk_id, product_id, target_quantity_quarters, is_active
       from kiosk_product_standards where kiosk_id = any($1::uuid[])`,
    [dbIds]
  )

  const current: CurrentStandard[] = []
  for (const row of rows) {
    const kioskKey = keyByDbId.get(row.kiosk_id)
    const productId = seedIdByDbId.get(row.product_id)
    // Een norm voor een product dat niet in de catalogus staat laten we met
    // rust: dat is niet van deze config, dus niet aan ons om uit te schakelen.
    if (!kioskKey || !productId) continue

    current.push({
      kioskKey,
      productId,
      targetQuantityQuarters: Number(row.target_quantity_quarters),
      isActive: row.is_active,
    })
  }
  return current
}

function report(plan: ReturnType<typeof buildSyncPlan>): void {
  if (plan.isEmpty) {
    console.log('De stamdata is al gelijk. Niets te doen.')
    return
  }

  if (plan.kiosks.length > 0) {
    console.log(`\nKiosken (${plan.kiosks.length}):`)
    for (const change of plan.kiosks) {
      console.log(`  ${change.kind === 'nieuw' ? '+' : '~'} ${change.number}: ${change.details.join(', ')}`)
    }
  }

  const perKind = {
    nieuw: plan.standards.filter((s) => s.kind === 'nieuw'),
    gewijzigd: plan.standards.filter((s) => s.kind === 'gewijzigd'),
    uitgeschakeld: plan.standards.filter((s) => s.kind === 'uitgeschakeld'),
  }

  console.log(
    `\nNormen: ${perKind.nieuw.length} nieuw, ${perKind.gewijzigd.length} gewijzigd, ` +
      `${perKind.uitgeschakeld.length} uitgeschakeld`
  )

  for (const change of perKind.gewijzigd) {
    console.log(
      `  ~ ${change.kioskKey} ${change.productId}: ${(change.from ?? 0) / 4} → ${(change.to ?? 0) / 4}`
    )
  }
  for (const change of perKind.uitgeschakeld) {
    console.log(`  - ${change.kioskKey} ${change.productId} (stond op ${(change.from ?? 0) / 4})`)
  }
  if (perKind.nieuw.length > 0) {
    const voorbeeld = perKind.nieuw.slice(0, 5)
    for (const change of voorbeeld) {
      console.log(`  + ${change.kioskKey} ${change.productId} = ${(change.to ?? 0) / 4}`)
    }
    if (perKind.nieuw.length > voorbeeld.length) {
      console.log(`  … en nog ${perKind.nieuw.length - voorbeeld.length}`)
    }
  }
}

async function applyChanges(): Promise<void> {
  // Kiosken eerst: de normen hangen eraan, en een nieuwe kiosk moet bestaan
  // voordat zijn normen weggeschreven kunnen worden.
  for (const kiosk of demoKiosks.filter((k) => authoritativeKioskKeys.has(k.id))) {
    const ring = await client.query<{ id: string }>(
      'select id from rings where name = $1',
      [kiosk.ringId === 'ring-eerste' ? 'Eerste ring' : 'Tweede ring']
    )
    const ringId = ring.rows[0]?.id
    if (!ringId) throw new Error(`Ring van ${kiosk.id} bestaat niet in de database.`)

    await client.query(
      `insert into kiosks (ring_id, number, label, name, sort_order, is_active, drink_storage_type)
       values ($1, $2, $3, $4, $5, true, $6)
       on conflict (ring_id, number) do update
         set label = excluded.label, name = excluded.name,
             sort_order = excluded.sort_order, drink_storage_type = excluded.drink_storage_type`,
      [ringId, kiosk.number, kiosk.label ?? null, kiosk.name ?? null, kiosk.sortOrder,
       kiosk.drinkStorageType]
    )
  }

  // Producten: alleen de velden die bij deze stamdata horen. Prijzen, formaten
  // en drempels blijven van de catalogus en worden hier niet aangeraakt.
  const productIds = await resolveProductIds(client)
  for (const product of demoProducts) {
    const id = productIds.get(product.id)
    if (id) {
      await client.query(
        `update products set name = $1, short_name = $2, count_unit = $3, packaging_unit = $4,
                supplied_from_large_cooler_for_satellite = $5
          where id = $6`,
        [product.name, product.shortName, product.countUnit, product.packagingUnit,
         product.suppliedFromLargeCoolerForSatellite, id]
      )
    } else {
      const category = await client.query<{ id: string }>(
        'select id from product_categories where name = $1',
        [categoryName(product.categoryId)]
      )
      const categoryId = category.rows[0]?.id
      if (!categoryId) throw new Error(`Categorie van ${product.id} bestaat niet.`)

      await client.query(
        `insert into products (category_id, name, short_name, count_unit, packaging_unit,
                               sort_order, is_active, input_step, allow_partial_package,
                               round_type, product_size, estimated_pallet_load,
                               own_round_threshold, priority, refrigerated,
                               supplied_from_large_cooler_for_satellite)
         values ($1,$2,$3,$4,$5,$6,true,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
        [categoryId, product.name, product.shortName, product.countUnit, product.packagingUnit,
         product.sortOrder, String(product.inputStep), product.allowPartialPackage,
         product.roundType, product.productSize, product.estimatedPalletLoad,
         product.ownRoundThreshold, product.priority, product.refrigerated,
         product.suppliedFromLargeCoolerForSatellite]
      )
    }
  }

  const freshProductIds = await resolveProductIds(client)
  const kioskIds = await resolveKioskIds(client, demoKiosks)

  const wanted = new Set<string>()
  for (const standard of desiredStandards()) {
    const kioskId = kioskIds.get(standard.kioskKey)
    const productId = freshProductIds.get(standard.productId)
    if (!kioskId || !productId) {
      throw new Error(`Kan ${standard.kioskKey} / ${standard.productId} niet koppelen.`)
    }
    wanted.add(`${kioskId}|${productId}`)

    await client.query(
      `insert into kiosk_product_standards
         (kiosk_id, product_id, target_quantity_quarters, half_package_threshold_pct, is_active)
       values ($1, $2, $3, 80, true)
       on conflict (kiosk_id, product_id) do update
         set target_quantity_quarters = excluded.target_quantity_quarters, is_active = true`,
      [kioskId, productId, standard.targetQuantityQuarters]
    )
  }

  // Uitschakelen, maar uitsluitend binnen de authoritative kiosken.
  const authoritativeDbIds = [...authoritativeKioskKeys]
    .map((key) => kioskIds.get(key))
    .filter((id): id is string => id !== undefined)

  const { rows: active } = await client.query<{ id: string; kiosk_id: string; product_id: string }>(
    `select id, kiosk_id, product_id from kiosk_product_standards
      where is_active = true and kiosk_id = any($1::uuid[])`,
    [authoritativeDbIds]
  )

  const stale = active
    .filter((row) => !wanted.has(`${row.kiosk_id}|${row.product_id}`))
    .map((row) => row.id)

  if (stale.length > 0) {
    await client.query(
      'update kiosk_product_standards set is_active = false where id = any($1::uuid[])',
      [stale]
    )
  }
}

function categoryName(categoryId: string): string {
  const namen: Record<string, string> = {
    'cat-bierbekers': 'Bierbekers',
    'cat-drank': 'Drank',
    'cat-chips': 'Chips',
    'cat-postmix': 'Post-mix',
    'cat-snoep': 'Snoep',
    'cat-koffie': 'Koffie en thee',
    'cat-verpakkingen': 'Verpakkingen',
    'cat-sauzen': 'Sauzen',
    'cat-schoonmaak': 'Schoonmaak',
  }
  const naam = namen[categoryId]
  if (!naam) throw new Error(`Onbekende categorie ${categoryId}`)
  return naam
}

/**
 * Leest de database opnieuw en controleert de uitkomst.
 *
 * Een sync die zegt dat hij klaar is zonder te kijken wat er staat, is een
 * sync die je op zijn woord moet geloven.
 */
async function verify(): Promise<string[]> {
  const problemen: string[] = []
  const kioskIds = await resolveKioskIds(client, demoKiosks)
  const productIds = await resolveProductIds(client)

  for (const [kioskKey, verwacht] of Object.entries(EXPECTED_DRINK_MATRIX)) {
    const kioskId = kioskIds.get(kioskKey)
    if (!kioskId) {
      problemen.push(`${kioskKey} bestaat niet`)
      continue
    }

    for (const [index, productSeedId] of PAPER_DRINK_ORDER.entries()) {
      const productId = productIds.get(productSeedId)
      const { rows } = await client.query<{ target_quantity_quarters: number }>(
        `select target_quantity_quarters from kiosk_product_standards
          where kiosk_id = $1 and product_id = $2 and is_active = true`,
        [kioskId, productId]
      )
      const gevonden = rows[0] ? Number(rows[0].target_quantity_quarters) / 4 : undefined
      if (gevonden !== verwacht[index]) {
        problemen.push(`${kioskKey} ${productSeedId}: ${gevonden ?? 'ontbreekt'} ≠ ${verwacht[index]}`)
      }
    }
  }

  for (const [kioskKey, verwacht] of Object.entries(EXPECTED_STORAGE_TYPES)) {
    const kioskId = kioskIds.get(kioskKey)
    if (!kioskId) {
      problemen.push(`${kioskKey} bestaat niet`)
      continue
    }
    const { rows } = await client.query<{ drink_storage_type: string }>(
      'select drink_storage_type from kiosks where id = $1',
      [kioskId]
    )
    if (rows[0]?.drink_storage_type !== verwacht) {
      problemen.push(`${kioskKey} drankopslag: ${rows[0]?.drink_storage_type} ≠ ${verwacht}`)
    }
  }

  return problemen
}

async function main(): Promise<void> {
  await client.connect()
  try {
    await assertSchemaReady(client)

    const kioskIds = await resolveKioskIds(client, demoKiosks)
    const plan = buildSyncPlan({
      desiredKiosks: desiredKiosks(),
      currentKiosks: await readCurrentKiosks(),
      desiredStandards: desiredStandards(),
      currentStandards: await readCurrentStandards(
        new Map([...kioskIds].filter(([key]) => authoritativeKioskKeys.has(key)))
      ),
    })

    report(plan)

    if (!APPLY) {
      console.log('\nProefdraai — er is niets gewijzigd.')
      console.log('Draai met --apply om dit door te voeren.')
      return
    }

    if (plan.isEmpty) return

    console.log('\n⚠ Dit wijzigt stamdata in de database waarop dit script is gericht.')
    await client.query('begin')
    try {
      await applyChanges()
      await client.query('commit')
    } catch (error) {
      await client.query('rollback')
      throw error
    }
    console.log('Doorgevoerd.')

    const problemen = await verify()
    if (problemen.length > 0) {
      console.error(`\n✗ Verificatie mislukt (${problemen.length}):`)
      for (const probleem of problemen) console.error(`  ${probleem}`)
      process.exitCode = 1
      return
    }
    console.log('✓ Verificatie geslaagd: drankmatrix en opslagtypes kloppen.')
  } finally {
    await client.end()
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
