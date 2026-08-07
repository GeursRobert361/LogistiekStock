/**
 * Vult een verse Supabase-database met stamdata: ringen, kiosken, categorieën,
 * producten en voorraadnormen. Optioneel ook de demo-gebruikers.
 *
 * Draaien met:
 *   npm run seed
 *
 * Vereist in .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY   (service role — nooit in de browser gebruiken)
 *
 * Het script is idempotent: opnieuw draaien werkt bestaande rijen bij in
 * plaats van dubbele aan te maken.
 */
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import {
  demoRings,
  demoKiosks,
  demoCategories,
  demoProducts,
  demoStandards,
  demoProfiles,
  DEMO_PASSWORDS,
  RING1_ID,
  RING2_ID,
} from '../src/lib/seed/demoData'

// ─── Omgeving ────────────────────────────────────────────────────────────────

function loadEnvLocal(): void {
  const path = join(dirname(fileURLToPath(import.meta.url)), '..', '.env.local')
  let contents: string
  try {
    contents = readFileSync(path, 'utf8')
  } catch {
    return // .env.local is optioneel wanneer de variabelen al in de shell staan
  }

  for (const line of contents.split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line)
    if (!match) continue
    const [, key, rawValue] = match
    if (process.env[key!]) continue
    process.env[key!] = rawValue!.replace(/^["']|["']$/g, '')
  }
}

loadEnvLocal()

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.error(
    'Ontbrekende configuratie. Zet NEXT_PUBLIC_SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY\n' +
      'in .env.local (dat bestand staat in .gitignore).'
  )
  process.exit(1)
}

const db: SupabaseClient = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const SEED_USERS = process.argv.includes('--users')

// ─── Hulpmiddelen ────────────────────────────────────────────────────────────

/**
 * De demo-id's zijn leesbare strings ('ring-eerste'); Postgres wil uuid's.
 * We houden een vertaaltabel bij op basis van de natuurlijke sleutels.
 */
const ringIds = new Map<string, string>()
const kioskIds = new Map<string, string>()
const categoryIds = new Map<string, string>()
const productIds = new Map<string, string>()

function fail(step: string, error: { message: string } | null): void {
  if (!error) return
  console.error(`✗ ${step}: ${error.message}`)
  process.exit(1)
}

async function upsert(
  table: string,
  rows: Array<Record<string, unknown>>,
  onConflict: string
): Promise<Array<Record<string, unknown>>> {
  const { data, error } = await db.from(table).upsert(rows, { onConflict }).select()
  fail(`${table} wegschrijven`, error)
  return (data ?? []) as Array<Record<string, unknown>>
}

// ─── Stappen ─────────────────────────────────────────────────────────────────

/**
 * Voegt toe of werkt bij op basis van de naam.
 *
 * Nodig voor tabellen zonder unique-constraint op naam (`rings`, `products`):
 * daar kan `upsert(onConflict)` niet op vertrouwen.
 */
async function upsertByName(
  table: string,
  rows: Array<Record<string, unknown>>
): Promise<Map<string, string>> {
  const { data: existing, error } = await db.from(table).select('id, name')
  fail(`${table} lezen`, error)

  const idByName = new Map(
    (existing ?? []).map((row) => [String(row.name), String(row.id)])
  )

  const toInsert = rows.filter((row) => !idByName.has(String(row.name)))
  if (toInsert.length > 0) {
    const { data, error: insertError } = await db.from(table).insert(toInsert).select('id, name')
    fail(`${table} toevoegen`, insertError)
    for (const row of data ?? []) idByName.set(String(row.name), String(row.id))
  }

  for (const row of rows.filter((candidate) => idByName.has(String(candidate.name)))) {
    const { error: updateError } = await db
      .from(table)
      .update(row)
      .eq('id', idByName.get(String(row.name))!)
    fail(`${table} bijwerken (${String(row.name)})`, updateError)
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
  const rows = await upsert(
    'kiosks',
    demoKiosks.map((kiosk) => ({
      ring_id: ringIds.get(kiosk.ringId),
      number: kiosk.number,
      name: kiosk.name ?? null,
      sort_order: kiosk.sortOrder,
      is_active: kiosk.isActive,
    })),
    'ring_id,number'
  )

  for (const row of rows) {
    const demo = demoKiosks.find(
      (kiosk) => kiosk.number === row.number && ringIds.get(kiosk.ringId) === row.ring_id
    )
    if (demo) kioskIds.set(demo.id, String(row.id))
  }
  console.log(`✓ ${rows.length} kiosken`)
}

async function seedCategories(): Promise<void> {
  const rows = await upsert(
    'product_categories',
    demoCategories.map((category) => ({
      name: category.name,
      sort_order: category.sortOrder,
      is_active: category.isActive,
    })),
    'name'
  )

  for (const row of rows) {
    const demo = demoCategories.find((category) => category.name === row.name)
    if (demo) categoryIds.set(demo.id, String(row.id))
  }
  console.log(`✓ ${rows.length} categorieën`)
}

async function seedProducts(): Promise<void> {
  const asRow = (product: (typeof demoProducts)[number]) => ({
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
  })

  const idByName = await upsertByName('products', demoProducts.map(asRow))

  for (const product of demoProducts) {
    const id = idByName.get(product.name)
    if (id) productIds.set(product.id, id)
  }
  console.log(`✓ ${demoProducts.length} producten`)
}

async function seedStandards(): Promise<void> {
  const rows = demoStandards
    .map((standard) => ({
      kiosk_id: kioskIds.get(standard.kioskId),
      product_id: productIds.get(standard.productId),
      target_quantity_quarters: standard.targetQuantityQuarters,
      half_package_threshold_pct: standard.halfPackageThresholdPercentage,
      is_active: standard.isActive,
    }))
    .filter((row) => row.kiosk_id && row.product_id)

  // In blokken, anders wordt de payload te groot.
  const chunkSize = 500
  for (let index = 0; index < rows.length; index += chunkSize) {
    await upsert('kiosk_product_standards', rows.slice(index, index + chunkSize), 'kiosk_id,product_id')
  }
  console.log(`✓ ${rows.length} voorraadnormen`)
}

/**
 * Maakt de demo-gebruikers aan in Supabase Auth met bijbehorend profiel en
 * rollen. Alleen met --users, en uitsluitend bedoeld voor test- en
 * acceptatieomgevingen.
 */
async function seedUsers(): Promise<void> {
  for (const profile of demoProfiles) {
    const password = DEMO_PASSWORDS[profile.email]
    if (!password) continue

    const { data: created, error: createError } = await db.auth.admin.createUser({
      email: profile.email,
      password,
      email_confirm: true,
    })

    let userId = created?.user?.id
    if (createError) {
      if (!createError.message.toLowerCase().includes('already')) {
        fail(`gebruiker ${profile.email}`, createError)
      }
      // Bestond al: id opzoeken.
      const { data: list } = await db.auth.admin.listUsers()
      userId = list?.users.find((user) => user.email === profile.email)?.id
    }
    if (!userId) {
      console.warn(`! ${profile.email} overgeslagen (geen id gevonden)`)
      continue
    }

    fail(
      `profiel ${profile.email}`,
      (
        await db.from('profiles').upsert(
          {
            id: userId,
            email: profile.email,
            display_name: profile.displayName,
            is_active: profile.isActive,
          },
          { onConflict: 'id' }
        )
      ).error
    )

    for (const role of profile.roles) {
      fail(
        `rol ${role} voor ${profile.email}`,
        (
          await db
            .from('user_roles')
            .upsert({ profile_id: userId, role }, { onConflict: 'profile_id,role' })
        ).error
      )
    }
  }
  console.log(`✓ ${demoProfiles.length} gebruikers`)
}

// ─── Uitvoeren ───────────────────────────────────────────────────────────────

/**
 * Controleert vooraf of de migraties gedraaid zijn. Zonder deze check krijg
 * je een PostgREST-fout over een ontbrekend schema, en dat leest niet als
 * "je moet eerst setup.sql uitvoeren".
 */
async function checkSchema(): Promise<void> {
  const required = ['rings', 'kiosks', 'products', 'restock_stop_items']
  const missing: string[] = []

  for (const table of required) {
    const { error } = await db.from(table).select('id').limit(1)
    if (error) missing.push(table)
  }

  if (missing.length === 0) return

  console.error(
    `De database mist ${missing.length === required.length ? 'het schema' : 'tabellen'}: ` +
      `${missing.join(', ')}.\n\n` +
      'Voer eerst supabase/setup.sql uit in de SQL Editor van Supabase.\n' +
      '(Opnieuw genereren kan met: npm run db:setup-sql)'
  )
  process.exit(1)
}

async function main(): Promise<void> {
  console.log(`Seeden naar ${url}\n`)

  await checkSchema()
  await seedRings()
  await seedKiosks()
  await seedCategories()
  await seedProducts()
  await seedStandards()

  if (SEED_USERS) {
    await seedUsers()
  } else {
    console.log('· gebruikers overgeslagen (draai met --users om ze aan te maken)')
  }

  console.log(
    `\nKlaar. Ringen: ${ringIds.size}, kiosken: ${kioskIds.size}, ` +
      `producten: ${productIds.size}.`
  )
  console.log(`Ring-id's: ${RING1_ID} → ${ringIds.get(RING1_ID)}, ${RING2_ID} → ${ringIds.get(RING2_ID)}`)
}

main().catch((error: unknown) => {
  console.error('Seeden mislukt.', error)
  process.exit(1)
})
