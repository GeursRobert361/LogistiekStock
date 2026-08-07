/**
 * Zet een volledige, goedgekeurde testtelling klaar zodat de vulplanning
 * gevuld is om naar te kijken.
 *
 * Draaien met:
 *   npm run seed:testcount              telling voor de eerste ring
 *   npm run seed:testcount -- --ring 2  tweede ring
 *   npm run seed:testcount -- --remove  alles weer opruimen
 *
 * De getelde aantallen zijn niet willekeurig: ze lopen alle afrondingsregels
 * langs (vol, leeg, .25, .50 onder en boven de 80%-grens, .75), zodat de
 * bijvullijst laat zien wat de regels doen in plaats van alleen dat er iets
 * staat.
 *
 * Dit is testdata. De telronde krijgt een vast, afgeleid id zodat opnieuw
 * draaien niets dubbel maakt en --remove precies weet wat het weg mag halen.
 */
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Client } from 'pg'
import { v5 as uuidv5 } from 'uuid'
import { loadEnvFile, requireDatabaseUrl } from './env'
import { calculateRestockQuantity } from '../src/domain/counting/calculateRestock'
import { generateCircularKioskRoute } from '../src/domain/routing/kioskRoute'
import { fromQuarterUnits } from '../src/lib/quarterUnits'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
loadEnvFile(root)

const NAMESPACE = '7c9e9d1e-2b3a-4f6d-9c1a-0d2f4b6a8c31'
const REMOVE = process.argv.includes('--remove')
const ringArgIndex = process.argv.indexOf('--ring')
const RING_NUMBER = ringArgIndex === -1 ? 1 : Number(process.argv[ringArgIndex + 1] ?? 1)

const client = new Client({ connectionString: requireDatabaseUrl() })

interface Row {
  [key: string]: unknown
}

/**
 * Hoeveel er geteld wordt, als fractie van de norm. Elk patroon laat een
 * andere regel zien; de keuze rouleert per kiosk en product.
 */
const PATTERNS: Array<{ label: string; counted: (target: number) => number }> = [
  { label: 'vol', counted: (t) => t },
  { label: 'leeg', counted: () => 0 },
  { label: 'ruim halfvol', counted: (t) => Math.floor(t / 2) + 0.5 },
  { label: 'bijna vol, halve erbij', counted: (t) => Math.max(0, t - 1) + 0.5 },
  { label: 'kwart erbij', counted: (t) => Math.max(0, Math.floor(t * 0.4)) + 0.25 },
  { label: 'driekwart erbij', counted: (t) => Math.max(0, Math.floor(t * 0.6)) + 0.75 },
  { label: 'ruim een derde', counted: (t) => Math.floor(t / 3) },
]

async function getRing(): Promise<Row> {
  const { rows } = await client.query<Row>(
    'select * from rings order by sort_order offset $1 limit 1',
    [RING_NUMBER - 1]
  )
  if (rows.length === 0) throw new Error(`Ring ${RING_NUMBER} bestaat niet.`)
  return rows[0]!
}

async function getEvent(): Promise<Row> {
  const { rows } = await client.query<Row>(
    "select * from events where status <> 'ARCHIVED' order by date desc limit 1"
  )
  if (rows.length === 0) {
    throw new Error('Er is geen evenement. Maak er eerst een aan in de app.')
  }
  return rows[0]!
}

async function remove(eventId: string, sessionId: string): Promise<void> {
  // count_entries en kiosk_counts hangen met cascade aan de telronde.
  const session = await client.query('delete from count_sessions where id = $1', [sessionId])
  const reservations = await client.query(
    `delete from stock_reservations where restock_requirement_id in
       (select id from restock_requirements where event_id = $1)`,
    [eventId]
  )
  const rounds = await client.query('delete from restock_rounds where event_id = $1', [eventId])
  const requirements = await client.query('delete from restock_requirements where event_id = $1', [
    eventId,
  ])

  console.log(`✓ ${session.rowCount} testtelronde verwijderd (met kiosktellingen en telregels)`)
  console.log(`✓ ${requirements.rowCount} bijvulregels verwijderd`)
  console.log(`✓ ${rounds.rowCount} vulrondes en ${reservations.rowCount} reserveringen verwijderd`)
}

async function main(): Promise<void> {
  await client.connect()
  try {
    const event = await getEvent()
    const ring = await getRing()
    const eventId = String(event.id)
    const sessionId = uuidv5(`test-count:${eventId}:${String(ring.id)}`, NAMESPACE)

    console.log(`Evenement: ${String(event.name)}`)
    console.log(`Ring: ${String(ring.name)}\n`)

    if (REMOVE) {
      await remove(eventId, sessionId)
      return
    }

    // Een kiosk die na het aanmaken van het evenement is toegevoegd hangt er
    // nog niet aan; zonder deze koppeling valt hij buiten de telling.
    const linked = await client.query(
      `insert into event_kiosks (event_id, kiosk_id, is_open)
       select $1, k.id, true from kiosks k
       where k.ring_id = $2 and k.is_active = true and k.deleted_at is null
       on conflict (event_id, kiosk_id) do nothing`,
      [eventId, ring.id]
    )
    if ((linked.rowCount ?? 0) > 0) {
      console.log(`· ${linked.rowCount} kiosk(en) alsnog aan het evenement gekoppeld`)
    }

    const { rows: kiosks } = await client.query<Row>(
      `select k.* from kiosks k
       join event_kiosks ek on ek.kiosk_id = k.id and ek.event_id = $1 and ek.is_open = true
       where k.ring_id = $2 and k.is_active = true
       order by k.sort_order`,
      [eventId, ring.id]
    )
    if (kiosks.length === 0) throw new Error('Deze ring heeft geen open kiosken.')

    const { rows: teller } = await client.query<Row>(
      `select p.id from profiles p
       join user_roles r on r.profile_id = p.id and r.role = 'TELLER'
       limit 1`
    )
    const counterId = String(teller[0]?.id ?? '')
    if (!counterId) throw new Error('Geen teller gevonden. Draai eerst: npm run seed -- --users')

    // Route vanaf de ingestelde startkiosk van de ring.
    const route = generateCircularKioskRoute({
      kiosks: kiosks.map((k) => ({
        id: String(k.id),
        sortOrder: Number(k.sort_order),
        isActive: true,
      })),
      startKioskId: String(ring.count_start_kiosk_id ?? kiosks[0]!.id),
      direction: 'ascending' as never,
    })

    await client.query('begin')

    await client.query(
      `insert into count_sessions
         (id, user_id, event_id, ring_id, start_kiosk_id, direction, kiosk_route,
          started_at, completed_at, status, sync_status)
       values ($1, $2, $3, $4, $5, 'ascending', $6, now(), now(), 'APPROVED', 'SYNCED')
       on conflict (id) do update set status = 'APPROVED', completed_at = now()`,
      [
        sessionId,
        counterId,
        eventId,
        ring.id,
        route[0]!.id,
        JSON.stringify(route.map((k) => k.id)),
      ]
    )

    let entryCount = 0
    let shortageCount = 0
    const requirements = new Map<string, { kioskId: string; productId: string; packages: number }>()

    for (const [kioskIndex, routeKiosk] of route.entries()) {
      const kioskCountId = uuidv5(`kiosk-count:${sessionId}:${routeKiosk.id}`, NAMESPACE)

      await client.query(
        `insert into kiosk_counts
           (id, count_session_id, kiosk_id, started_at, completed_at, counter_id, status)
         values ($1, $2, $3, now(), now(), $4, 'COMPLETED')
         on conflict (count_session_id, kiosk_id) do update set status = 'COMPLETED'`,
        [kioskCountId, sessionId, routeKiosk.id, counterId]
      )

      const { rows: standards } = await client.query<Row>(
        `select s.*, p.name as product_name from kiosk_product_standards s
         join products p on p.id = s.product_id
         where s.kiosk_id = $1 and s.is_active = true and p.is_active = true
         order by p.sort_order`,
        [routeKiosk.id]
      )

      for (const [productIndex, standard] of standards.entries()) {
        const targetQuarters = Number(standard.target_quantity_quarters)
        const target = fromQuarterUnits(targetQuarters)
        const pattern = PATTERNS[(kioskIndex + productIndex) % PATTERNS.length]!
        const counted = Math.max(0, pattern.counted(target))

        const result = calculateRestockQuantity({
          targetQuantity: target,
          countedQuantity: counted,
          halfPackageThresholdPercentage: Number(standard.half_package_threshold_pct),
        })

        await client.query(
          `insert into count_entries
             (id, kiosk_count_id, product_id, target_quantity_quarters,
              counted_quantity_quarters, effective_quantity_quarters,
              restock_quantity_packages, applied_fraction_rule, last_modified_by_id)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           on conflict (kiosk_count_id, product_id) do update set
             counted_quantity_quarters = excluded.counted_quantity_quarters,
             effective_quantity_quarters = excluded.effective_quantity_quarters,
             restock_quantity_packages = excluded.restock_quantity_packages,
             applied_fraction_rule = excluded.applied_fraction_rule`,
          [
            uuidv5(`count-entry:${kioskCountId}:${String(standard.product_id)}`, NAMESPACE),
            kioskCountId,
            standard.product_id,
            targetQuarters,
            Math.round(counted * 4),
            Math.round(result.effectiveQuantity * 4),
            result.restockQuantity,
            result.appliedFractionRule,
            counterId,
          ]
        )
        entryCount++

        if (result.restockQuantity > 0) {
          shortageCount++
          requirements.set(`${routeKiosk.id}:${String(standard.product_id)}`, {
            kioskId: routeKiosk.id,
            productId: String(standard.product_id),
            packages: result.restockQuantity,
          })
        }
      }
    }

    // Goedkeuren levert de bijvulregels op — dezelfde stap die de app zet.
    for (const requirement of requirements.values()) {
      await client.query(
        `insert into restock_requirements
           (event_id, kiosk_id, product_id, required_packages, reserved_packages, delivered_packages)
         values ($1, $2, $3, $4, 0, 0)
         on conflict (event_id, kiosk_id, product_id) do update set
           required_packages = excluded.required_packages`,
        [eventId, requirement.kioskId, requirement.productId, requirement.packages]
      )
    }

    await client.query("update events set status = 'READY_FOR_RESTOCK' where id = $1", [eventId])
    await client.query('commit')

    const totalPackages = [...requirements.values()].reduce((sum, r) => sum + r.packages, 0)

    console.log(`✓ ${route.length} kiosken geteld`)
    console.log(`✓ ${entryCount} telregels, waarvan ${shortageCount} met een tekort`)
    console.log(`✓ ${requirements.size} bijvulregels, samen ${totalPackages} verpakkingen`)
    console.log('\nTe zien onder Vulplanning bij het evenement.')
    console.log('Opruimen kan met: npm run seed:testcount -- --remove')
  } catch (error) {
    await client.query('rollback').catch(() => undefined)
    throw error
  } finally {
    await client.end()
  }
}

main().catch((error: unknown) => {
  console.error('\nMislukt.', error)
  process.exit(1)
})
