import { demoProducts } from './catalogue'

/**
 * Koppelt de sleutels uit de seed aan de UUID's van de database.
 *
 * De seed werkt met leesbare id's als `fuze-tea`; de database heeft eigen
 * UUID's. Die koppeling loopt via de naam, en dat is precies waar het misgaat
 * als je niet oppast: een product dat in Beheer is verwijderd blijft bestaan
 * met een `deleted_at`, en een latere seed zet er een nieuwe naast. Dan zijn er
 * twee rijen met dezelfde naam.
 *
 * Gedeeld tussen `seedDb` en de tweede-ringsync, zodat die twee niet elk hun
 * eigen antwoord op dezelfde vraag geven.
 */

/**
 * Het stukje `pg.Client` dat deze code gebruikt.
 *
 * Zo klein gehouden omdat het de sync testbaar maakt zonder database: een
 * neptclient hoeft alleen `query` te hebben. De echte `Client` past er vanzelf
 * in.
 */
export interface SqlClient {
  query<T extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: unknown[]
  ): Promise<{ rows: T[]; rowCount?: number | null }>
}

/**
 * Levende rijen winnen van verwijderde.
 *
 * `order by (deleted_at is null)` zet false (verwijderd) eerst en true
 * (levend) achteraan, zodat de levende rij de eerdere in de map overschrijft.
 */
export async function resolveProductIds(client: SqlClient): Promise<Map<string, string>> {
  const { rows } = await client.query<{ id: string; name: string }>(
    'select id, name from products order by (deleted_at is null)'
  )

  const idByName = new Map(rows.map((row) => [row.name, row.id]))
  const productIds = new Map<string, string>()

  for (const product of demoProducts) {
    const id = idByName.get(product.name)
    if (id) productIds.set(product.id, id)
  }
  return productIds
}

/** Kiosken zijn uniek op ring plus nummer; die koppeling is eenduidig. */
export async function resolveKioskIds(
  client: SqlClient,
  kiosks: Array<{ id: string; number: number }>
): Promise<Map<string, string>> {
  const { rows } = await client.query<{ id: string; number: number }>(
    'select id, number from kiosks where deleted_at is null'
  )

  const idByNumber = new Map(rows.map((row) => [Number(row.number), row.id]))
  const kioskIds = new Map<string, string>()

  for (const kiosk of kiosks) {
    const id = idByNumber.get(kiosk.number)
    if (id) kioskIds.set(kiosk.id, id)
  }
  return kioskIds
}

/**
 * Controleert of het schema de kolommen heeft die deze stamdata nodig heeft.
 *
 * Half synchroniseren op een verouderd schema levert een half bijgewerkte
 * database op, en dat is lastiger terug te draaien dan helemaal niet beginnen.
 */
export async function assertSchemaReady(client: SqlClient): Promise<void> {
  const required: Array<[string, string]> = [
    ['kiosks', 'drink_storage_type'],
    ['kiosks', 'drink_source_kiosk_id'],
    ['kiosks', 'keeps_own_drink_stock'],
    ['products', 'supplied_from_large_cooler_for_satellite'],
  ]

  const { rows } = await client.query<{ table_name: string; column_name: string }>(
    `select table_name, column_name from information_schema.columns
      where table_schema = 'public' and table_name = any($1::text[])`,
    [[...new Set(required.map(([table]) => table))]]
  )

  const present = new Set(rows.map((row) => `${row.table_name}.${row.column_name}`))
  const missing = required
    .map(([table, column]) => `${table}.${column}`)
    .filter((key) => !present.has(key))

  if (missing.length > 0) {
    throw new Error(`Het schema mist ${missing.join(', ')}. Voer eerst npm run db:migrate uit.`)
  }
}
