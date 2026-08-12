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
 * Het werk zelf staat in `src/lib/seed/secondRingSync.ts`, waar het met een
 * nepdatabase te testen is. Hier alleen argumenten, verbinding en foutcode.
 *
 * Draaien:
 *   npx tsx scripts/syncSecondRingMasterData.ts            proefdraai, wijzigt niets
 *   npx tsx scripts/syncSecondRingMasterData.ts --apply    voert uit, in één transactie
 */
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Client } from 'pg'
import { loadEnvFile, requireDatabaseUrl } from './env'
import { runSecondRingSync } from '../src/lib/seed/secondRingSync'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
loadEnvFile(root)

const APPLY = process.argv.includes('--apply')

const client = new Client({ connectionString: requireDatabaseUrl() })

async function main(): Promise<void> {
  await client.connect()
  try {
    const { applied, problems } = await runSecondRingSync(client, {
      apply: APPLY,
      log: (line) => console.log(line),
    })

    if (problems.length > 0) {
      console.error(`\n✗ Verificatie mislukt (${problems.length}):`)
      for (const probleem of problems) console.error(`  ${probleem}`)
      process.exitCode = 1
      return
    }
    if (applied) {
      console.log('✓ Verificatie geslaagd: drank, bekers en opslagtypes kloppen.')
    }
  } finally {
    await client.end()
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
