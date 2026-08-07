/**
 * Voert de migraties uit db/migrations uit tegen de Postgres van dit project.
 *
 * Draaien met: npm run db:migrate
 *
 * Houdt bij wat er al gedraaid is in de tabel `schema_migrations`, zodat
 * herhaald draaien veilig is. Elke migratie loopt in een transactie: gaat er
 * iets mis, dan blijft de database staan zoals hij was.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Client } from 'pg'
import { loadEnvFile, requireDatabaseUrl } from './env'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const migrationsDir = join(root, 'db', 'migrations')

loadEnvFile(root)

async function main(): Promise<void> {
  const connectionString = requireDatabaseUrl()
  const client = new Client({ connectionString })

  await client.connect()
  console.log(`Verbonden met ${connectionString.replace(/:[^:@]*@/, ':***@')}\n`)

  try {
    await client.query(`
      create table if not exists schema_migrations (
        name       text primary key,
        applied_at timestamptz not null default now()
      )
    `)

    const applied = new Set(
      (await client.query<{ name: string }>('select name from schema_migrations')).rows.map(
        (row) => row.name
      )
    )

    const files = readdirSync(migrationsDir)
      .filter((file) => file.endsWith('.sql'))
      .sort()

    let ran = 0
    for (const file of files) {
      if (applied.has(file)) {
        console.log(`· ${file} (al gedraaid)`)
        continue
      }

      const sql = readFileSync(join(migrationsDir, file), 'utf8')
      await client.query('begin')
      try {
        await client.query(sql)
        await client.query('insert into schema_migrations (name) values ($1)', [file])
        await client.query('commit')
        console.log(`✓ ${file}`)
        ran++
      } catch (error) {
        await client.query('rollback')
        console.error(`✗ ${file} — teruggedraaid`)
        throw error
      }
    }

    console.log(
      ran === 0 ? '\nDatabase was al bij.' : `\n${ran} migratie${ran === 1 ? '' : 's'} uitgevoerd.`
    )
  } finally {
    await client.end()
  }
}

main().catch((error: unknown) => {
  console.error('\nMigreren mislukt.', error)
  process.exit(1)
})
