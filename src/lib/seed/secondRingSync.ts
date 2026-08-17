import { DrinkStorageType } from '@/types'
import { demoKiosks, demoStandards } from './demoData'
import { demoProducts } from './catalogue'
import {
  authoritativeKioskKeys,
  CHIP_PRODUCT_IDS,
  CUP_PRODUCT_IDS,
  DISPOSABLE_PRODUCT_IDS,
  LOCAL_DRINK_STOCK_KIOSK_KEYS,
  POSTMIX_PACKAGE_PRODUCT_IDS,
} from './secondRingStandards'
import { assertSchemaReady, resolveKioskIds, resolveProductIds, type SqlClient } from './dbIds'
import {
  buildSyncPlan,
  EXPECTED_CHIP_MATRIX,
  EXPECTED_CUP_MATRIX,
  EXPECTED_DISPOSABLE_MATRIX,
  EXPECTED_DRINK_MATRIX,
  EXPECTED_GFT,
  EXPECTED_KOFFIE,
  EXPECTED_KOOLZUUR,
  EXPECTED_LOCAL_DRINK_STOCK,
  EXPECTED_OPSCHUIMMELK,
  EXPECTED_POSTMIX_MATRIX,
  EXPECTED_STORAGE_TYPES,
  EXPECTED_VUILNISZAKKEN,
  type CurrentKiosk,
  type CurrentStandard,
  type DesiredKiosk,
  type DesiredStandard,
  type StandardChange,
  type SyncPlan,
} from './syncPlan'

/**
 * De tweede-ringstamdata naar een bestaande database brengen.
 *
 * Losgeknipt van het CLI-script zodat dit met een nepdatabase te testen is: dat
 * een proefdraai werkelijk niets schrijft, dat een fout halverwege alles
 * terugdraait en dat de controle achteraf een verkeerde norm ziet, zijn geen
 * dingen die je op hun woord wilt geloven. Het script eromheen doet alleen nog
 * argumenten lezen, verbinden en de foutcode zetten.
 *
 * Wat hier gebeurt en wat niet, staat beschreven bij `runSecondRingSync`.
 */

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

const CATEGORY_NAMES: Record<string, string> = {
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

function categoryName(categoryId: string): string {
  const naam = CATEGORY_NAMES[categoryId]
  if (!naam) throw new Error(`Onbekende categorie ${categoryId}`)
  return naam
}

/** De kiosken waar deze config gezag over heeft, plus wat ze moeten zijn. */
export function desiredKiosks(): DesiredKiosk[] {
  return demoKiosks
    .filter((kiosk) => authoritativeKioskKeys.has(kiosk.id))
    .map((kiosk) => ({
      kioskKey: kiosk.id,
      number: kiosk.number,
      label: kiosk.label,
      drinkStorageType: kiosk.drinkStorageType,
      keepsOwnDrinkStock: kiosk.keepsOwnDrinkStock,
    }))
}

export function desiredStandards(): DesiredStandard[] {
  return demoStandards
    .filter((standard) => authoritativeKioskKeys.has(standard.kioskId))
    .map((standard) => ({
      kioskKey: standard.kioskId,
      productId: standard.productId,
      targetQuantityQuarters: standard.targetQuantityQuarters,
    }))
}

async function readCurrentKiosks(client: SqlClient): Promise<Map<number, CurrentKiosk>> {
  const { rows } = await client.query<{
    number: number
    label: string | null
    drink_storage_type: string
    keeps_own_drink_stock: boolean
  }>(
    `select number, label, drink_storage_type, keeps_own_drink_stock
       from kiosks where deleted_at is null`
  )

  return new Map(
    rows.map((row) => [
      Number(row.number),
      {
        number: Number(row.number),
        label: row.label,
        drinkStorageType: row.drink_storage_type as DrinkStorageType,
        keepsOwnDrinkStock: row.keeps_own_drink_stock === true,
      },
    ])
  )
}

async function readCurrentStandards(
  client: SqlClient,
  kioskIds: Map<string, string>
): Promise<CurrentStandard[]> {
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
    manually_set_at: string | null
  }>(
    `select kiosk_id, product_id, target_quantity_quarters, is_active, manually_set_at
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
      manuallySetAt: row.manually_set_at,
    })
  }
  return current
}

/** Leest wat er nu staat en bepaalt wat er zou veranderen. Schrijft niets. */
export async function planSecondRingSync(client: SqlClient): Promise<SyncPlan> {
  const kioskIds = await resolveKioskIds(client, demoKiosks)

  return buildSyncPlan({
    desiredKiosks: desiredKiosks(),
    currentKiosks: await readCurrentKiosks(client),
    desiredStandards: desiredStandards(),
    // Alleen de authoritative kiosken worden ingelezen; wat daarbuiten staat
    // komt zo niet in het plan en kan dus ook niet uitgeschakeld worden.
    currentStandards: await readCurrentStandards(
      client,
      new Map([...kioskIds].filter(([key]) => authoritativeKioskKeys.has(key)))
    ),
  })
}

export function describePlan(plan: SyncPlan): string[] {
  const handmatig = plan.standards.filter((s) => s.kind === 'handmatig')

  if (plan.isEmpty) {
    return ['De stamdata is al gelijk. Niets te doen.', ...describeManual(handmatig)]
  }

  const regels: string[] = []

  if (plan.kiosks.length > 0) {
    regels.push(`\nKiosken (${plan.kiosks.length}):`)
    for (const change of plan.kiosks) {
      regels.push(
        `  ${change.kind === 'nieuw' ? '+' : '~'} ${change.number}: ${change.details.join(', ')}`
      )
    }
  }

  const perKind = {
    nieuw: plan.standards.filter((s) => s.kind === 'nieuw'),
    gewijzigd: plan.standards.filter((s) => s.kind === 'gewijzigd'),
    uitgeschakeld: plan.standards.filter((s) => s.kind === 'uitgeschakeld'),
  }

  regels.push(
    `\nNormen: ${perKind.nieuw.length} nieuw, ${perKind.gewijzigd.length} gewijzigd, ` +
      `${perKind.uitgeschakeld.length} uitgeschakeld`
  )

  for (const change of perKind.gewijzigd) {
    regels.push(
      `  ~ ${change.kioskKey} ${change.productId}: ${(change.from ?? 0) / 4} → ${(change.to ?? 0) / 4}`
    )
  }
  for (const change of perKind.uitgeschakeld) {
    regels.push(`  - ${change.kioskKey} ${change.productId} (stond op ${(change.from ?? 0) / 4})`)
  }
  if (perKind.nieuw.length > 0) {
    const voorbeeld = perKind.nieuw.slice(0, 5)
    for (const change of voorbeeld) {
      regels.push(`  + ${change.kioskKey} ${change.productId} = ${(change.to ?? 0) / 4}`)
    }
    if (perKind.nieuw.length > voorbeeld.length) {
      regels.push(`  … en nog ${perKind.nieuw.length - voorbeeld.length}`)
    }
  }

  return [...regels, ...describeManual(handmatig)]
}

/**
 * Wat de sync met rust laat omdat het in Beheer is gezet.
 *
 * Dit hoort in de uitvoer en niet alleen in de code: een norm die van de lijst
 * afwijkt is meestal een bewuste correctie, maar soms een vergissing. Zolang
 * het verschil bij elke run genoemd wordt kan iemand dat zien; verzwijgen maakt
 * er stille afwijkende stamdata van.
 */
function describeManual(handmatig: StandardChange[]): string[] {
  if (handmatig.length === 0) return []

  const regels = [
    `\nHandmatig gezet in Beheer (${handmatig.length}) — blijft staan, wijkt af van de lijst:`,
  ]
  for (const change of handmatig) {
    const staat = change.from === undefined ? 'staat uit' : `${change.from / 4}`
    const lijst = change.to === undefined ? 'staat niet op de lijst' : `lijst: ${change.to / 4}`
    regels.push(`  = ${change.kioskKey} ${change.productId}: ${staat} (${lijst})`)
  }
  regels.push('  Terug naar de lijst? Pas de norm in Beheer aan, of maak hem daar leeg.')

  return regels
}

async function applyChanges(client: SqlClient): Promise<void> {
  // Kiosken eerst: de normen hangen eraan, en een nieuwe kiosk moet bestaan
  // voordat zijn normen weggeschreven kunnen worden.
  for (const kiosk of demoKiosks.filter((k) => authoritativeKioskKeys.has(k.id))) {
    const ring = await client.query<{ id: string }>('select id from rings where name = $1', [
      kiosk.ringId === 'ring-eerste' ? 'Eerste ring' : 'Tweede ring',
    ])
    const ringId = ring.rows[0]?.id
    if (!ringId) throw new Error(`Ring van ${kiosk.id} bestaat niet in de database.`)

    await client.query(
      `insert into kiosks (ring_id, number, label, name, sort_order, is_active,
                           drink_storage_type, keeps_own_drink_stock)
       values ($1, $2, $3, $4, $5, true, $6, $7)
       on conflict (ring_id, number) do update
         set label = excluded.label, name = excluded.name,
             sort_order = excluded.sort_order, drink_storage_type = excluded.drink_storage_type,
             keeps_own_drink_stock = excluded.keeps_own_drink_stock`,
      [
        ringId,
        kiosk.number,
        kiosk.label ?? null,
        kiosk.name ?? null,
        kiosk.sortOrder,
        kiosk.drinkStorageType,
        kiosk.keepsOwnDrinkStock,
      ]
    )
  }

  // Producten: alleen de velden die bij deze stamdata horen — hoe een product
  // heet, waarin het geteld wordt en in welke stappen. Formaten, drempels,
  // ronde-indeling en prioriteit blijven van de catalogus en worden hier niet
  // aangeraakt.
  //
  // `input_step` en `allow_partial_package` gingen eerder alleen mee bij het
  // aanmaken van een product. Daardoor bleef een bestaand product in productie
  // op hele verpakkingen staan terwijl de catalogus al halve of kwart stappen
  // zei — de teller kon een halve doos chips dan niet invoeren. Ze horen bij de
  // teleenheid en gaan dus mee bij het bijwerken.
  const productIds = await resolveProductIds(client)
  for (const product of demoProducts) {
    const id = productIds.get(product.id)
    if (id) {
      await client.query(
        `update products set name = $1, short_name = $2, count_unit = $3, packaging_unit = $4,
                supplied_from_large_cooler_for_satellite = $5,
                input_step = $6, allow_partial_package = $7,
                collected_after_event = $8
          where id = $9`,
        [
          product.name,
          product.shortName,
          product.countUnit,
          product.packagingUnit,
          product.suppliedFromLargeCoolerForSatellite,
          String(product.inputStep),
          product.allowPartialPackage,
          product.collectedAfterEvent,
          id,
        ]
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
                               supplied_from_large_cooler_for_satellite,
                               collected_after_event)
         values ($1,$2,$3,$4,$5,$6,true,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
        [
          categoryId,
          product.name,
          product.shortName,
          product.countUnit,
          product.packagingUnit,
          product.sortOrder,
          String(product.inputStep),
          product.allowPartialPackage,
          product.roundType,
          product.productSize,
          product.estimatedPalletLoad,
          product.ownRoundThreshold,
          product.priority,
          product.refrigerated,
          product.suppliedFromLargeCoolerForSatellite,
          product.collectedAfterEvent,
        ]
      )
    }
  }

  const freshProductIds = await resolveProductIds(client)
  const kioskIds = await resolveKioskIds(client, demoKiosks)

  // Normen die in Beheer zijn gezet blijven zoals ze staan. Ze komen van de
  // vloer en niet van de papieren lijst; `planStandardChanges` houdt ze om
  // dezelfde reden buiten het plan. Zonder dat zou de dry-run iets anders
  // beloven dan er gebeurt.
  const { rows: manualRows } = await client.query<{ kiosk_id: string; product_id: string }>(
    `select kiosk_id, product_id from kiosk_product_standards
      where manually_set_at is not null`
  )
  const manual = new Set(manualRows.map((row) => `${row.kiosk_id}|${row.product_id}`))

  const wanted = new Set<string>()
  for (const standard of desiredStandards()) {
    const kioskId = kioskIds.get(standard.kioskKey)
    const productId = freshProductIds.get(standard.productId)
    if (!kioskId || !productId) {
      throw new Error(`Kan ${standard.kioskKey} / ${standard.productId} niet koppelen.`)
    }
    // Wél in `wanted`: anders zou hij hieronder als verouderd worden
    // uitgeschakeld, en dan is "met rust laten" alsnog een wijziging.
    wanted.add(`${kioskId}|${productId}`)
    if (manual.has(`${kioskId}|${productId}`)) continue

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

  const { rows: active } = await client.query<{
    id: string
    kiosk_id: string
    product_id: string
  }>(
    `select id, kiosk_id, product_id from kiosk_product_standards
      where is_active = true and kiosk_id = any($1::uuid[])`,
    [authoritativeDbIds]
  )

  const stale = active
    .filter((row) => !wanted.has(`${row.kiosk_id}|${row.product_id}`))
    // Staat er met de hand een norm voor iets dat de lijst niet noemt, dan is
    // dat een keuze en geen restant.
    .filter((row) => !manual.has(`${row.kiosk_id}|${row.product_id}`))
    .map((row) => row.id)

  if (stale.length > 0) {
    await client.query(
      'update kiosk_product_standards set is_active = false where id = any($1::uuid[])',
      [stale]
    )
  }
}

/**
 * Leest de database opnieuw en controleert de uitkomst.
 *
 * Een sync die zegt dat hij klaar is zonder te kijken wat er staat, is een
 * sync die je op zijn woord moet geloven. Controleert alle normmatrices —
 * drank, bekers, chips, Post-mix, de zeven disposables, GFT en vuilniszakken —
 * inclusief de regels die géén actieve norm horen te hebben, plus de
 * koolzuurnormen die geen enkele latere lijst mocht wissen, de opslagtypes en
 * het vinkje voor eigen drankvoorraad. Geeft de problemen terug; leeg betekent
 * goed.
 */
export async function verifySecondRing(client: SqlClient): Promise<string[]> {
  const problemen: string[] = []
  const kioskIds = await resolveKioskIds(client, demoKiosks)
  const productIds = await resolveProductIds(client)

  // Een norm die in Beheer is gezet hoort bewust af te wijken van de lijst. Die
  // hier als probleem melden zou betekenen dat de sync faalt op precies het
  // gedrag dat hij zelf toepast.
  const { rows: manualRows } = await client.query<{ kiosk_id: string; product_id: string }>(
    `select kiosk_id, product_id from kiosk_product_standards where manually_set_at is not null`
  )
  const manual = new Set(manualRows.map((row) => `${row.kiosk_id}|${row.product_id}`))

  /** De actieve norm in hele verpakkingen, of undefined als hij niet actief is. */
  async function activeStandard(
    kioskId: string,
    productSeedId: string
  ): Promise<number | undefined> {
    const { rows } = await client.query<{ target_quantity_quarters: number }>(
      `select target_quantity_quarters from kiosk_product_standards
        where kiosk_id = $1 and product_id = $2 and is_active = true`,
      [kioskId, productIds.get(productSeedId)]
    )
    return rows[0] ? Number(rows[0].target_quantity_quarters) / 4 : undefined
  }

  /**
   * Eén matrix van normen langslopen.
   *
   * `null` in de verwachting betekent "hoort geen actieve norm te hebben". Dat
   * is een uitkomst om te controleren en niet om over te slaan: een rij die er
   * nog actief staat — desnoods op nul — is precies wat een expliciete 0 op de
   * handmatige lijst wilde uitsluiten.
   */
  async function checkMatrix(
    matrix: Record<string, Array<number | null>>,
    volgorde: readonly string[]
  ): Promise<void> {
    for (const [kioskKey, verwacht] of Object.entries(matrix)) {
      const kioskId = kioskIds.get(kioskKey)
      if (!kioskId) {
        problemen.push(`${kioskKey} bestaat niet`)
        continue
      }

      for (const [index, productSeedId] of volgorde.entries()) {
        if (manual.has(`${kioskId}|${productIds.get(productSeedId)}`)) continue

        const gevonden = await activeStandard(kioskId, productSeedId)
        const hoort = verwacht[index]

        if (hoort === null) {
          if (gevonden !== undefined) {
            problemen.push(
              `${kioskKey} ${productSeedId}: ${gevonden}, hoort geen actieve norm te zijn`
            )
          }
          continue
        }

        if (gevonden !== hoort) {
          problemen.push(`${kioskKey} ${productSeedId}: ${gevonden ?? 'ontbreekt'} ≠ ${hoort}`)
        }
      }
    }
  }

  await checkMatrix(EXPECTED_DRINK_MATRIX, PAPER_DRINK_ORDER)
  await checkMatrix(EXPECTED_CUP_MATRIX, CUP_PRODUCT_IDS)
  await checkMatrix(EXPECTED_CHIP_MATRIX, CHIP_PRODUCT_IDS)
  await checkMatrix(EXPECTED_POSTMIX_MATRIX, POSTMIX_PACKAGE_PRODUCT_IDS)
  await checkMatrix(EXPECTED_DISPOSABLE_MATRIX, DISPOSABLE_PRODUCT_IDS)
  await checkMatrix(EXPECTED_GFT, ['gft-bak'])
  await checkMatrix(EXPECTED_VUILNISZAKKEN, ['vuilniszakken'])
  await checkMatrix(EXPECTED_OPSCHUIMMELK, ['opschuimmelk'])
  await checkMatrix(EXPECTED_KOFFIE, ['koffie'])

  // Koolzuur komt op de Post-mixlijst nergens voor en moet daar dus ook niet
  // door verdwijnen. Hetzelfde geldt voor de nieuwe Ziggo-lijst, die koolzuur
  // ook niet noemt: weglating is geen deactivering.
  await checkMatrix(
    Object.fromEntries(Object.entries(EXPECTED_KOOLZUUR).map(([key, aantal]) => [key, [aantal]])),
    ['koolzuur']
  )

  for (const [kioskKey, verwacht] of Object.entries(EXPECTED_STORAGE_TYPES)) {
    const kioskId = kioskIds.get(kioskKey)
    if (!kioskId) {
      problemen.push(`${kioskKey} bestaat niet`)
      continue
    }
    const { rows } = await client.query<{
      drink_storage_type: string
      keeps_own_drink_stock: boolean
    }>('select drink_storage_type, keeps_own_drink_stock from kiosks where id = $1', [kioskId])

    if (rows[0]?.drink_storage_type !== verwacht) {
      problemen.push(`${kioskKey} drankopslag: ${rows[0]?.drink_storage_type} ≠ ${verwacht}`)
    }

    const eigenVoorraad = rows[0]?.keeps_own_drink_stock === true
    const hoortEigenVoorraad = EXPECTED_LOCAL_DRINK_STOCK[kioskKey] ?? false
    if (eigenVoorraad !== hoortEigenVoorraad) {
      problemen.push(
        `${kioskKey} eigen drankvoorraad: ${eigenVoorraad} ≠ ${hoortEigenVoorraad}`
      )
    }
  }

  // De uitzondering hoort in de database te staan waar de config hem heeft, en
  // nergens anders: dit vinkje zet de satellietbescherming uit.
  for (const kioskKey of LOCAL_DRINK_STOCK_KIOSK_KEYS) {
    if (EXPECTED_LOCAL_DRINK_STOCK[kioskKey] !== true) {
      problemen.push(`${kioskKey} staat als eigen drankvoorraad in de config maar niet in de controle`)
    }
  }

  return problemen
}

export interface SyncOutcome {
  plan: SyncPlan
  /** Of er werkelijk iets is weggeschreven. */
  applied: boolean
  /** Wat de controle achteraf zag; leeg is goed. Alleen gevuld na toepassen. */
  problems: string[]
}

/**
 * Synchroniseert de authoritative tweede-ringstamdata.
 *
 * Zonder `apply` is dit een proefdraai: er wordt alleen gelezen. Met `apply`
 * gaat alles in één transactie; gaat er iets mis, dan draait de hele sync terug
 * en blijft de database zoals hij was.
 *
 * Raakt uitsluitend de kiosken uit `authoritativeKioskKeys`, de producten die
 * hun normen nodig hebben, en die normen zelf. Nooit de eerste ring, evenementen,
 * tellingen, bijvulbehoeften, leveringen, gebruikers of de agenda. En nooit een
 * norm van een andere kiosk als terugval — de bron is de papieren lijst plus de
 * latere notitie, verder niets.
 */
export async function runSecondRingSync(
  client: SqlClient,
  options: { apply: boolean; log?: (line: string) => void }
): Promise<SyncOutcome> {
  const log = options.log ?? (() => {})

  await assertSchemaReady(client)

  const plan = await planSecondRingSync(client)
  for (const regel of describePlan(plan)) log(regel)

  if (!options.apply) {
    log('\nProefdraai — er is niets gewijzigd.')
    log('Draai met --apply om dit door te voeren.')
    return { plan, applied: false, problems: [] }
  }

  if (plan.isEmpty) return { plan, applied: false, problems: [] }

  log('\n⚠ Dit wijzigt stamdata in de database waarop dit script is gericht.')
  await client.query('begin')
  try {
    await applyChanges(client)
    await client.query('commit')
  } catch (error) {
    await client.query('rollback')
    throw error
  }
  log('Doorgevoerd.')

  return { plan, applied: true, problems: await verifySecondRing(client) }
}
