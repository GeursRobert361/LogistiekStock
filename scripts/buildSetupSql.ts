/**
 * Plakt alle migraties achter elkaar tot één bestand: supabase/setup.sql.
 *
 * Bedoeld voor de SQL Editor van Supabase, zodat een verse database in één
 * keer klaargezet kan worden zonder psql of database-wachtwoord.
 *
 * Draaien met: npm run db:setup-sql
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const migrationsDir = join(root, 'supabase', 'migrations')

const files = readdirSync(migrationsDir)
  .filter((file) => file.endsWith('.sql'))
  .sort()

const header = `-- ============================================================
-- LogistiekStock — volledige database-opzet
-- ============================================================
-- GEGENEREERD BESTAND — niet handmatig bewerken.
-- Opnieuw maken met: npm run db:setup-sql
--
-- Plak dit in de SQL Editor van Supabase en voer het uit op een verse
-- database. Bevat ${files.length} migraties:
${files.map((file) => `--   ${file}`).join('\n')}
-- ============================================================

`

const body = files
  .map((file) => {
    const sql = readFileSync(join(migrationsDir, file), 'utf8').trimEnd()
    return `\n-- ┌${'─'.repeat(70)}\n-- │ ${file}\n-- └${'─'.repeat(70)}\n\n${sql}\n`
  })
  .join('\n')

const target = join(root, 'supabase', 'setup.sql')
writeFileSync(target, header + body, 'utf8')

console.log(`supabase/setup.sql geschreven (${files.length} migraties)`)
for (const file of files) console.log(`  · ${file}`)
