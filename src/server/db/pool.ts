import { Pool, type PoolClient, type QueryResultRow } from 'pg'

/**
 * Verbinding met de eigen Postgres. Uitsluitend server-side: dit bestand mag
 * nooit vanuit een client component geïmporteerd worden.
 */

let pool: Pool | null = null

export function getPool(): Pool {
  if (pool) return pool

  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL ontbreekt. In productie zet docker compose hem; lokaal hoort hij in .env.local.'
    )
  }

  pool = new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  })

  pool.on('error', (error) => {
    // Een fout op een idle verbinding mag het proces niet omleggen.
    console.error('[db] Onverwachte fout op een inactieve verbinding.', error)
  })

  return pool
}

export type Row = Record<string, unknown>

/** Voert een query uit en geeft de rijen terug. */
export async function query<T extends QueryResultRow = Row>(
  text: string,
  params: unknown[] = []
): Promise<T[]> {
  const result = await getPool().query<T>(text, params)
  return result.rows
}

/** Eén rij, of null wanneer er niets gevonden is. */
export async function queryOne<T extends QueryResultRow = Row>(
  text: string,
  params: unknown[] = []
): Promise<T | null> {
  const rows = await query<T>(text, params)
  return rows[0] ?? null
}

/** Eén rij die er móet zijn. */
export async function queryRequired<T extends QueryResultRow = Row>(
  text: string,
  params: unknown[] = []
): Promise<T> {
  const row = await queryOne<T>(text, params)
  if (!row) throw new Error('Geen rij gevonden terwijl dat wel werd verwacht.')
  return row
}

/**
 * Voert `fn` uit binnen één transactie. Gooit `fn`, dan wordt alles
 * teruggedraaid — nodig voor het reserveren van voorraad, waar meerdere
 * tabellen samen kloppend moeten blijven.
 */
export async function transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect()
  try {
    await client.query('begin')
    const result = await fn(client)
    await client.query('commit')
    return result
  } catch (error) {
    await client.query('rollback')
    throw error
  } finally {
    client.release()
  }
}

/**
 * Bouwt een `update ... where id = ...`-statement uit de gezette velden.
 * Een lege `row` levert null op: dan valt er niets bij te werken.
 */
export function buildUpdate(
  table: string,
  row: Row,
  id: string
): { text: string; params: unknown[] } | null {
  const columns = Object.keys(row)
  if (columns.length === 0) return null

  const assignments = columns.map((column, index) => `${column} = $${index + 1}`)
  const params = [...Object.values(row), id]

  return {
    text: `update ${table} set ${assignments.join(', ')} where id = $${columns.length + 1} returning *`,
    params,
  }
}

/**
 * Bouwt een `insert ... on conflict do update`-statement.
 * Scheelt in elke repository dezelfde string-plakkerij.
 */
export function buildUpsert(
  table: string,
  row: Row,
  conflictColumns: string[]
): { text: string; params: unknown[] } {
  const columns = Object.keys(row)
  const params = Object.values(row)
  const placeholders = columns.map((_, index) => `$${index + 1}`)

  const updates = columns
    .filter((column) => !conflictColumns.includes(column))
    .map((column) => `${column} = excluded.${column}`)

  const text =
    `insert into ${table} (${columns.join(', ')}) values (${placeholders.join(', ')}) ` +
    `on conflict (${conflictColumns.join(', ')}) do ` +
    (updates.length > 0 ? `update set ${updates.join(', ')}` : 'nothing') +
    ' returning *'

  return { text, params }
}
