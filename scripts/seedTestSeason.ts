/**
 * Zet een reeks afgeronde testevenementen klaar, zodat het datatabblad iets
 * te laten zien heeft.
 *
 * Draaien met:
 *   npm run seed:testseason              vier evenementen in de eerste ring
 *   npm run seed:testseason -- --ring 2  tweede ring
 *   npm run seed:testseason -- --events 6
 *   npm run seed:testseason -- --remove  alles weer opruimen
 *
 * De keten die het nabootst is precies die van de vloer:
 *
 *   tellen vóór het evenement → aanvullen tot de norm → publiek → opnieuw
 *   tellen vóór het volgende evenement
 *
 * Wat er tussen twee tellingen verdwijnt ís het verbruik. Daarom worden de
 * getallen vooruit doorgerekend: het restant van de ene wedstrijd is de
 * telling van de volgende. Anders staan er cijfers die nergens op slaan.
 *
 * Verbruik is niet willekeurig. Drank loopt hard, schoonmaak nauwelijks, en
 * een kiosk aan de drukke kant verkoopt meer dan eentje in een hoek — maar
 * wel reproduceerbaar: dezelfde seed geeft dezelfde cijfers.
 */
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Client } from 'pg'
import { v5 as uuidv5 } from 'uuid'
import { loadEnvFile, requireDatabaseUrl } from './env'
import { calculateRestockQuantity } from '../src/domain/counting/calculateRestock'
import { generateCircularKioskRoute } from '../src/domain/routing/kioskRoute'
import { fromQuarterUnits, toQuarterUnits } from '../src/lib/quarterUnits'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
loadEnvFile(root)

const NAMESPACE = 'b3f1c7a2-9d84-4e51-8c6b-2a7f0e5d1934'
const REMOVE = process.argv.includes('--remove')

function argValue(name: string, fallback: number): number {
  const index = process.argv.indexOf(name)
  if (index === -1) return fallback
  const value = Number(process.argv[index + 1])
  return Number.isFinite(value) ? value : fallback
}

const RING_NUMBER = argValue('--ring', 1)
const EVENT_COUNT = Math.max(2, Math.min(10, argValue('--events', 4)))

const client = new Client({ connectionString: requireDatabaseUrl() })

interface Row {
  [key: string]: unknown
}

/** Namen voor de testreeks, zodat ze in de lijst herkenbaar zijn. */
const OPPONENTS = [
  'Testreeks 1 – Sparta',
  'Testreeks 2 – NEC',
  'Testreeks 3 – Utrecht',
  'Testreeks 4 – Groningen',
  'Testreeks 5 – Willem II',
  'Testreeks 6 – Excelsior',
  'Testreeks 7 – Zwolle',
  'Testreeks 8 – Almere',
  'Testreeks 9 – Heracles',
  'Testreeks 10 – Volendam',
]

/**
 * Welk deel van de norm er tijdens een wedstrijd doorheen gaat.
 *
 * Reproduceerbaar uit de namen: dezelfde kiosk verkoopt bij elke wedstrijd
 * ongeveer evenveel, met wat verschil per wedstrijd. Zo is er over meerdere
 * evenementen een patroon te zien in plaats van ruis.
 */
function usageFraction(
  categoryName: string,
  kioskSortOrder: number,
  eventIndex: number
): number {
  const base =
    categoryName === 'Drank' || categoryName === 'Bierbekers'
      ? 0.75
      : categoryName === 'Post-mix' || categoryName === 'Chips' || categoryName === 'Snoep'
        ? 0.55
        : categoryName === 'Koffie en thee'
          ? 0.4
          : categoryName === 'Schoonmaak'
            ? 0.2
            : 0.35

  // Vaste afwijking per kiosk (−10% tot +10%) en per wedstrijd (−8% tot +8%).
  const perKiosk = ((kioskSortOrder % 7) - 3) / 30
  const perEvent = ((eventIndex % 5) - 2) / 25

  return Math.min(0.95, Math.max(0.05, base + perKiosk + perEvent))
}

async function getRing(): Promise<Row> {
  const { rows } = await client.query<Row>(
    'select * from rings order by sort_order offset $1 limit 1',
    [RING_NUMBER - 1]
  )
  if (rows.length === 0) throw new Error(`Ring ${RING_NUMBER} bestaat niet.`)
  return rows[0]!
}

async function getProfile(role: string): Promise<string> {
  const { rows } = await client.query<Row>(
    `select p.id from profiles p
     join user_roles r on r.profile_id = p.id and r.role = $1
     limit 1`,
    [role]
  )
  const id = rows[0]?.id
  if (!id) throw new Error(`Geen gebruiker met rol ${role}. Draai eerst: npm run seed -- --users`)
  return String(id)
}

/** Datum van evenement `index`, oplopend richting vandaag. */
function eventDate(index: number): string {
  const daysAgo = (EVENT_COUNT - index) * 7
  const date = new Date(Date.now() - daysAgo * 86_400_000)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

function eventId(index: number): string {
  return uuidv5(`test-season-event:${RING_NUMBER}:${index}`, NAMESPACE)
}

async function remove(): Promise<void> {
  const ids = Array.from({ length: 10 }, (_, index) => eventId(index))
  const result = await client.query('delete from events where id = any($1::uuid[])', [ids])
  console.log(`✓ ${result.rowCount} testevenementen verwijderd, met alles wat eraan hing`)
}

async function main(): Promise<void> {
  await client.connect()
  try {
    if (REMOVE) {
      await remove()
      return
    }

    const ring = await getRing()
    const ringId = String(ring.id)
    const [tellerId, vullerId, adminId] = await Promise.all([
      getProfile('TELLER'),
      getProfile('VULLER'),
      getProfile('ADMIN'),
    ])

    const { rows: kiosks } = await client.query<Row>(
      `select id, sort_order from kiosks
       where ring_id = $1 and is_active = true and deleted_at is null
       order by sort_order`,
      [ringId]
    )
    if (kiosks.length === 0) throw new Error('Deze ring heeft geen kiosken.')

    const { rows: standards } = await client.query<Row>(
      `select s.kiosk_id, s.product_id, s.target_quantity_quarters,
              s.half_package_threshold_pct, c.name as category_name
       from kiosk_product_standards s
       join products p on p.id = s.product_id and p.is_active = true and p.deleted_at is null
       join product_categories c on c.id = p.category_id
       join kiosks k on k.id = s.kiosk_id
       where k.ring_id = $1 and s.is_active = true`,
      [ringId]
    )
    if (standards.length === 0) throw new Error('Deze ring heeft geen voorraadnormen.')

    console.log(`Ring: ${String(ring.name)}`)
    console.log(`${kiosks.length} kiosken, ${standards.length} normen`)
    console.log(`${EVENT_COUNT} evenementen\n`)

    const route = generateCircularKioskRoute({
      kiosks: kiosks.map((k) => ({
        id: String(k.id),
        sortOrder: Number(k.sort_order),
        isActive: true,
      })),
      startKioskId: String(ring.count_start_kiosk_id ?? kiosks[0]!.id),
      direction: 'ascending' as never,
    })

    const sortOrderByKiosk = new Map(kiosks.map((k) => [String(k.id), Number(k.sort_order)]))

    /**
     * Wat er bij de volgende telling nog staat, per kiosk en product, in
     * kwarteenheden. Begint op ongeveer een derde van de norm: de kiosken
     * staan niet leeg aan het begin van de reeks.
     */
    const leftover = new Map<string, number>()
    for (const standard of standards) {
      const target = Number(standard.target_quantity_quarters)
      leftover.set(`${String(standard.kiosk_id)}:${String(standard.product_id)}`, Math.round(target / 3 / 4) * 4)
    }

    await client.query('begin')

    for (let index = 0; index < EVENT_COUNT; index++) {
      const id = eventId(index)
      const name = OPPONENTS[index] ?? `Testreeks ${index + 1}`
      const date = eventDate(index)
      const previousId = index > 0 ? eventId(index - 1) : null

      await client.query(
        `insert into events (id, name, date, event_type, status, previous_event_id, notes, created_by_id)
         values ($1, $2, $3, 'VOETBAL', 'COMPLETED', $4, 'Testdata voor het datatabblad', $5)
         on conflict (id) do update
           set name = excluded.name, date = excluded.date,
               previous_event_id = excluded.previous_event_id`,
        [id, name, date, previousId, adminId]
      )
      await client.query(
        `insert into event_rings (event_id, ring_id) values ($1, $2)
         on conflict do nothing`,
        [id, ringId]
      )
      for (const kiosk of kiosks) {
        await client.query(
          `insert into event_kiosks (event_id, kiosk_id, is_open) values ($1, $2, true)
           on conflict (event_id, kiosk_id) do nothing`,
          [id, kiosk.id]
        )
      }

      // ── Telling: wat er van de vorige wedstrijd is overgebleven ──────────
      const sessionId = uuidv5(`session:${id}`, NAMESPACE)
      await client.query(
        `insert into count_sessions
           (id, user_id, event_id, ring_id, start_kiosk_id, direction, kiosk_route,
            started_at, completed_at, status, sync_status)
         values ($1, $2, $3, $4, $5, 'ascending', $6, now(), now(), 'APPROVED', 'SYNCED')
         on conflict (id) do update set status = 'APPROVED'`,
        [sessionId, tellerId, id, ringId, route[0]!.id, JSON.stringify(route.map((k) => k.id))]
      )

      const kioskCountIds = new Map<string, string>()
      for (const kiosk of kiosks) {
        const kioskCountId = uuidv5(`kiosk-count:${sessionId}:${String(kiosk.id)}`, NAMESPACE)
        kioskCountIds.set(String(kiosk.id), kioskCountId)
        await client.query(
          `insert into kiosk_counts
             (id, count_session_id, kiosk_id, started_at, completed_at, counter_id, status)
           values ($1, $2, $3, now(), now(), $4, 'COMPLETED')
           on conflict (count_session_id, kiosk_id) do update set status = 'COMPLETED'`,
          [kioskCountId, sessionId, kiosk.id, tellerId]
        )
      }

      // ── Per norm: tellen, bijvullen, verbruiken ──────────────────────────
      const restockByKiosk = new Map<string, Array<{ productId: string; packages: number }>>()
      let entryCount = 0

      for (const standard of standards) {
        const kioskId = String(standard.kiosk_id)
        const productId = String(standard.product_id)
        const composite = `${kioskId}:${productId}`
        const targetQuarters = Number(standard.target_quantity_quarters)
        const countedQuarters = leftover.get(composite) ?? 0

        const result = calculateRestockQuantity({
          targetQuantity: fromQuarterUnits(targetQuarters),
          countedQuantity: fromQuarterUnits(countedQuarters),
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
             restock_quantity_packages = excluded.restock_quantity_packages`,
          [
            uuidv5(`entry:${kioskCountIds.get(kioskId)}:${productId}`, NAMESPACE),
            kioskCountIds.get(kioskId),
            productId,
            targetQuarters,
            countedQuarters,
            toQuarterUnits(result.effectiveQuantity),
            result.restockQuantity,
            result.appliedFractionRule,
            tellerId,
          ]
        )
        entryCount++

        if (result.restockQuantity > 0) {
          await client.query(
            `insert into restock_requirements
               (event_id, kiosk_id, product_id, required_packages, reserved_packages, delivered_packages)
             values ($1, $2, $3, $4, $4, $4)
             on conflict (event_id, kiosk_id, product_id) do update set
               required_packages = excluded.required_packages,
               reserved_packages = excluded.reserved_packages,
               delivered_packages = excluded.delivered_packages`,
            [id, kioskId, productId, result.restockQuantity]
          )
          const forKiosk = restockByKiosk.get(kioskId) ?? []
          forKiosk.push({ productId, packages: result.restockQuantity })
          restockByKiosk.set(kioskId, forKiosk)
        }

        // Bij aanvang staat de kiosk op de telling plus wat er is gebracht.
        const atKickoff = countedQuarters + toQuarterUnits(result.restockQuantity)

        // En dan gaat het publiek los.
        const fraction = usageFraction(
          String(standard.category_name),
          sortOrderByKiosk.get(kioskId) ?? 0,
          index
        )
        const consumed = Math.round((atKickoff * fraction) / 1) // hele kwarten
        leftover.set(composite, Math.max(0, atKickoff - consumed))
      }

      // ── Vulronde: alles is geleverd zoals gepland ────────────────────────
      const roundId = uuidv5(`round:${id}`, NAMESPACE)
      await client.query(
        `insert into restock_rounds
           (id, event_id, ring_id, name, status, created_by_id, assigned_user_id,
            claimed_at, started_at, completed_at)
         values ($1, $2, $3, 'Testronde', 'COMPLETED', $4, $5, now(), now(), now())
         on conflict (id) do update set status = 'COMPLETED'`,
        [roundId, id, ringId, adminId, vullerId]
      )

      let deliveryCount = 0
      let stopOrder = 0
      for (const [kioskId, items] of restockByKiosk) {
        const stopId = uuidv5(`stop:${roundId}:${kioskId}`, NAMESPACE)
        await client.query(
          `insert into restock_round_stops (id, restock_round_id, kiosk_id, sort_order, completed_at)
           values ($1, $2, $3, $4, now())
           on conflict (id) do update set completed_at = now()`,
          [stopId, roundId, kioskId, stopOrder++]
        )

        for (const item of items) {
          await client.query(
            `insert into restock_stop_items (restock_round_stop_id, product_id, planned_packages)
             values ($1, $2, $3)
             on conflict (restock_round_stop_id, product_id) do update
               set planned_packages = excluded.planned_packages`,
            [stopId, item.productId, item.packages]
          )
          await client.query(
            `insert into restock_deliveries
               (id, restock_round_stop_id, product_id, planned_packages, delivered_packages,
                not_delivered_packages, delivered_at, delivered_by_id)
             values ($1, $2, $3, $4, $4, 0, now(), $5)
             on conflict (id) do nothing`,
            [
              uuidv5(`delivery:${stopId}:${item.productId}`, NAMESPACE),
              stopId,
              item.productId,
              item.packages,
              vullerId,
            ]
          )
          deliveryCount++
        }
      }

      console.log(
        `✓ ${name} (${date}) — ${entryCount} telregels, ${deliveryCount} leveringen`
      )
    }

    await client.query('commit')

    console.log('\nTe zien onder Data. Het verbruik van het laatste evenement')
    console.log('verschijnt zodra daarna opnieuw geteld is.')
    console.log('Opruimen kan met: npm run seed:testseason -- --remove')
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
