/**
 * Vult de database met stamdata: ringen, kiosken, categorieën, producten,
 * voorraadnormen en de gebruikers.
 *
 * Draaien met:
 *   npm run seed                    stamdata
 *   npm run seed -- --users         plus de gebruikers
 *   npm run seed -- --users --reset-passwords   wachtwoorden terugzetten
 *
 * Idempotent: opnieuw draaien werkt bestaande rijen bij.
 */
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Client } from 'pg'
import bcrypt from 'bcryptjs'
import { loadEnvFile, requireDatabaseUrl } from './env'
import {
  demoRings,
  demoKiosks,
  demoCategories,
  demoProducts,
  demoStandards,
  demoProfiles,
  demoAgenda,
  DEMO_PASSWORDS,
} from '../src/lib/seed/demoData'
import { authoritativeKioskKeys } from '../src/lib/seed/secondRingStandards'
import { resolveProductIds } from '../src/lib/seed/dbIds'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
loadEnvFile(root)

const WITH_USERS = process.argv.includes('--users')
const RESET_PASSWORDS = process.argv.includes('--reset-passwords')

const client = new Client({ connectionString: requireDatabaseUrl() })

const ringIds = new Map<string, string>()
const kioskIds = new Map<string, string>()
const categoryIds = new Map<string, string>()
const productIds = new Map<string, string>()

async function checkSchema(): Promise<void> {
  const { rows } = await client.query<{ count: string }>(
    `select count(*)::text as count from information_schema.tables
     where table_schema = 'public' and table_name in ('rings','kiosks','products','sessions')`
  )
  if (Number(rows[0]!.count) < 4) {
    console.error(
      'De database is nog niet ingericht.\n\nVoer eerst de migraties uit: npm run db:migrate'
    )
    process.exit(1)
  }
}

/** Voegt toe of werkt bij op naam; geeft naam → id terug. */
async function upsertByName(
  table: string,
  rows: Array<Record<string, unknown>>,
  options: { hasSoftDelete?: boolean } = {}
): Promise<Map<string, string>> {
  /*
   * Eén naam kan meer dan één rij hebben: een product dat in Beheer is
   * verwijderd blijft bestaan met een deleted_at, en een latere seed zet er een
   * nieuwe naast. De levende rij is dan degene met de normen en de tellingen.
   *
   * Zonder expliciete volgorde bepaalt het toeval welke rij deze functie
   * oppakt, en met de verkeerde keuze belanden de normen aan het verwijderde
   * product terwijl het echte los komt te staan. Levende rijen daarom
   * achteraan, zodat ze de eerdere in de map overschrijven.
   */
  const existing = await client.query<{ id: string; name: string }>(
    options.hasSoftDelete
      ? `select id, name from ${table} order by (deleted_at is null)`
      : `select id, name from ${table}`
  )
  const idByName = new Map(existing.rows.map((row) => [row.name, row.id]))

  for (const row of rows) {
    const name = String(row.name)
    const columns = Object.keys(row)

    if (idByName.has(name)) {
      const assignments = columns.map((column, index) => `${column} = $${index + 1}`)
      await client.query(`update ${table} set ${assignments.join(', ')} where id = $${columns.length + 1}`, [
        ...Object.values(row),
        idByName.get(name),
      ])
    } else {
      const inserted = await client.query<{ id: string }>(
        `insert into ${table} (${columns.join(', ')}) values (${columns
          .map((_, index) => `$${index + 1}`)
          .join(', ')}) returning id`,
        Object.values(row)
      )
      idByName.set(name, inserted.rows[0]!.id)
    }
  }

  return idByName
}

async function seedRings(): Promise<void> {
  const idByName = await upsertByName(
    'rings',
    demoRings.map((ring) => ({
      name: ring.name,
      description: ring.description ?? null,
      is_active: ring.isActive,
      sort_order: ring.sortOrder,
    }))
  )
  for (const ring of demoRings) {
    const id = idByName.get(ring.name)
    if (id) ringIds.set(ring.id, id)
  }
  console.log(`✓ ${demoRings.length} ringen`)
}

async function seedKiosks(): Promise<void> {
  for (const kiosk of demoKiosks) {
    const ringId = ringIds.get(kiosk.ringId)
    if (!ringId) continue

    // De bronkiosk van een satelliet blijft hier buiten: die is nog niet
    // vastgesteld, en een seed die er een zou raden legt een verkeerde relatie
    // vast die daarna moeilijk te herkennen is.
    const result = await client.query<{ id: string }>(
      `insert into kiosks (ring_id, number, label, name, sort_order, is_active,
                           drink_storage_type, keeps_own_drink_stock)
       values ($1, $2, $3, $4, $5, $6, $7, $8)
       on conflict (ring_id, number) do update
         set label = excluded.label, name = excluded.name,
             sort_order = excluded.sort_order, is_active = excluded.is_active,
             drink_storage_type = excluded.drink_storage_type,
             keeps_own_drink_stock = excluded.keeps_own_drink_stock
       returning id`,
      [
        ringId,
        kiosk.number,
        kiosk.label ?? null,
        kiosk.name ?? null,
        kiosk.sortOrder,
        kiosk.isActive,
        kiosk.drinkStorageType,
        kiosk.keepsOwnDrinkStock,
      ]
    )
    kioskIds.set(kiosk.id, result.rows[0]!.id)
  }
  console.log(`✓ ${kioskIds.size} kiosken`)
}

/**
 * Zet de standaard startkiosken per ring. Moet ná de kiosken, want die moeten
 * eerst bestaan. Een kiosk die niet bestaat wordt overgeslagen en gemeld —
 * beter dan stilzwijgend niets instellen.
 */
async function seedRingStartKiosks(): Promise<void> {
  for (const ring of demoRings) {
    const ringId = ringIds.get(ring.id)
    if (!ringId) continue

    const countStart = ring.countStartKioskId ? kioskIds.get(ring.countStartKioskId) : null
    const restockStart = ring.restockStartKioskId ? kioskIds.get(ring.restockStartKioskId) : null

    for (const [label, wanted, resolved] of [
      ['tellen', ring.countStartKioskId, countStart],
      ['vullen', ring.restockStartKioskId, restockStart],
    ] as const) {
      if (wanted && !resolved) {
        console.warn(`  ! ${ring.name}: startkiosk ${label} (${wanted}) bestaat niet — overgeslagen`)
      }
    }

    await client.query(
      'update rings set count_start_kiosk_id = $1, restock_start_kiosk_id = $2 where id = $3',
      [countStart ?? null, restockStart ?? null, ringId]
    )
  }
  console.log('✓ startkiosken per ring')
}

async function seedAgenda(): Promise<void> {
  for (const entry of demoAgenda) {
    await client.query(
      `insert into event_agenda (name, date, event_type, notes)
       values ($1, $2, $3, $4)
       on conflict (date, name) do update
         set event_type = excluded.event_type, notes = excluded.notes`,
      [entry.name, entry.date, entry.eventType, entry.notes ?? null]
    )
  }
  console.log(`✓ ${demoAgenda.length} agendaregels`)
}

async function seedCategories(): Promise<void> {
  const idByName = await upsertByName(
    'product_categories',
    demoCategories.map((category) => ({
      name: category.name,
      sort_order: category.sortOrder,
      is_active: category.isActive,
    }))
  )
  for (const category of demoCategories) {
    const id = idByName.get(category.name)
    if (id) categoryIds.set(category.id, id)
  }
  console.log(`✓ ${demoCategories.length} categorieën`)
}

async function seedProducts(): Promise<void> {
  const idByName = await upsertByName(
    'products',
    demoProducts.map((product) => ({
      category_id: categoryIds.get(product.categoryId),
      name: product.name,
      short_name: product.shortName,
      count_unit: product.countUnit,
      packaging_unit: product.packagingUnit,
      sort_order: product.sortOrder,
      is_active: product.isActive,
      input_step: String(product.inputStep),
      allow_partial_package: product.allowPartialPackage,
      round_type: product.roundType,
      product_size: product.productSize,
      estimated_pallet_load: product.estimatedPalletLoad,
      own_round_threshold: product.ownRoundThreshold,
      priority: product.priority,
      refrigerated: product.refrigerated,
      supplied_from_large_cooler_for_satellite: product.suppliedFromLargeCoolerForSatellite,
      collected_after_event: product.collectedAfterEvent,
    })),
    { hasSoftDelete: true }
  )
  // Dezelfde koppeling als de tweede-ringsync gebruikt: één regel voor het
  // omgaan met verwijderde naamgenoten, zodat de twee scripts niet elk hun
  // eigen antwoord geven op dezelfde vraag.
  for (const [seedId, dbId] of await resolveProductIds(client)) {
    productIds.set(seedId, dbId)
  }

  // Producten die niet meer in de catalogus staan gaan uit, niet weg: er
  // kunnen tellingen aan hangen die je wilt kunnen terugzien.
  const deactivated = await client.query(
    'update products set is_active = false where is_active = true and name <> all($1::text[])',
    [demoProducts.map((product) => product.name)]
  )
  if ((deactivated.rowCount ?? 0) > 0) {
    console.log(`  · ${deactivated.rowCount} product(en) uit de oude catalogus uitgeschakeld`)
  }

  console.log(`✓ ${demoProducts.length} producten`)
}

async function seedStandards(): Promise<void> {
  let count = 0
  for (const standard of demoStandards) {
    const kioskId = kioskIds.get(standard.kioskId)
    const productId = productIds.get(standard.productId)
    if (!kioskId || !productId) continue

    await client.query(
      `insert into kiosk_product_standards
         (kiosk_id, product_id, target_quantity_quarters, half_package_threshold_pct, is_active)
       values ($1, $2, $3, $4, $5)
       on conflict (kiosk_id, product_id) do update
         set target_quantity_quarters = excluded.target_quantity_quarters,
             half_package_threshold_pct = excluded.half_package_threshold_pct,
             is_active = excluded.is_active`,
      [
        kioskId,
        productId,
        standard.targetQuantityQuarters,
        standard.halfPackageThresholdPercentage,
        standard.isActive,
      ]
    )
    count++
  }

  /*
   * Normen voor producten die een kiosk niet meer voert gaan uit, zodat ze niet
   * meer geteld hoeven te worden.
   *
   * Maar alleen bij de kiosken waarover deze seed werkelijk iets te zeggen
   * heeft. Eerder liep deze stap over álle actieve normen in de database, en
   * dat is gevaarlijk zodra de seed niet meer de enige bron is: een norm die
   * iemand in Beheer heeft toegevoegd, of een locatie waarvoor nog geen lijst
   * is aangeleverd, zou stilzwijgend uitgeschakeld worden. Wat we niet
   * beheren, laten we staan.
   */
  const authoritativeKioskDbIds = new Set(
    [...authoritativeKioskKeys]
      .map((key) => kioskIds.get(key))
      .filter((id): id is string => id !== undefined)
  )

  if (authoritativeKioskDbIds.size === 0) {
    console.log(`✓ ${count} voorraadnormen`)
    return
  }

  // Wat de config wél wil hebben, als paren van database-id's.
  const wanted = new Set(
    demoStandards
      .map((s) => {
        const kioskId = kioskIds.get(s.kioskId)
        const productId = productIds.get(s.productId)
        return kioskId && productId ? `${kioskId}|${productId}` : null
      })
      .filter((key): key is string => key !== null)
  )

  const stale = await client.query<{ id: string; kiosk_id: string; product_id: string }>(
    `select id, kiosk_id, product_id
       from kiosk_product_standards
      where is_active = true and kiosk_id = any($1::uuid[])`,
    [[...authoritativeKioskDbIds]]
  )

  const toDeactivate = stale.rows
    .filter((row) => !wanted.has(`${row.kiosk_id}|${row.product_id}`))
    .map((row) => row.id)

  if (toDeactivate.length > 0) {
    await client.query(
      'update kiosk_product_standards set is_active = false where id = any($1::uuid[])',
      [toDeactivate]
    )
    console.log(`  · ${toDeactivate.length} verouderde normen uitgeschakeld`)
  }

  console.log(`✓ ${count} voorraadnormen`)
}

async function seedUsers(): Promise<void> {
  for (const profile of demoProfiles) {
    const password = DEMO_PASSWORDS[profile.email]
    if (!password) continue

    const existing = await client.query<{ id: string }>(
      'select id from profiles where lower(email) = lower($1)',
      [profile.email]
    )

    let profileId: string
    if (existing.rows.length > 0) {
      profileId = existing.rows[0]!.id
      // Bestaand wachtwoord blijft staan, tenzij er expliciet om gevraagd wordt.
      if (RESET_PASSWORDS) {
        await client.query('update profiles set password_hash = $1 where id = $2', [
          await bcrypt.hash(password, 12),
          profileId,
        ])
      }
      await client.query(
        'update profiles set display_name = $1, is_active = $2 where id = $3',
        [profile.displayName, profile.isActive, profileId]
      )
    } else {
      const inserted = await client.query<{ id: string }>(
        `insert into profiles (email, password_hash, display_name, is_active)
         values ($1, $2, $3, $4) returning id`,
        [profile.email, await bcrypt.hash(password, 12), profile.displayName, profile.isActive]
      )
      profileId = inserted.rows[0]!.id
    }

    for (const role of profile.roles) {
      await client.query(
        `insert into user_roles (profile_id, role) values ($1, $2)
         on conflict (profile_id, role) do nothing`,
        [profileId, role]
      )
    }
  }
  console.log(`✓ ${demoProfiles.length} gebruikers`)
  if (!RESET_PASSWORDS) {
    console.log('  (bestaande wachtwoorden ongemoeid; --reset-passwords zet ze terug)')
  }
}

async function main(): Promise<void> {
  await client.connect()
  try {
    await checkSchema()
    await seedRings()
    await seedKiosks()
    await seedRingStartKiosks()
    await seedAgenda()
    await seedCategories()
    await seedProducts()
    await seedStandards()

    if (WITH_USERS) {
      await seedUsers()
    } else {
      console.log('· gebruikers overgeslagen (draai met --users om ze aan te maken)')
    }

    console.log('\nKlaar.')
  } finally {
    await client.end()
  }
}

main().catch((error: unknown) => {
  console.error('\nSeeden mislukt.', error)
  process.exit(1)
})
