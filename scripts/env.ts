import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Leest .env.local in process.env, zonder een extra pakket. Bestaande
 * omgevingsvariabelen winnen, zodat je een script eenmalig kunt overrulen.
 */
export function loadEnvFile(root: string, file = '.env.local'): void {
  let contents: string
  try {
    contents = readFileSync(join(root, file), 'utf8')
  } catch {
    return // optioneel: op de server staan de variabelen al in de omgeving
  }

  for (const line of contents.split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line)
    if (!match) continue
    const [, key, rawValue] = match
    if (process.env[key!]) continue
    process.env[key!] = rawValue!.replace(/^["']|["']$/g, '')
  }
}

export function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error(
      'DATABASE_URL ontbreekt.\n\n' +
        'Lokaal: zet hem in .env.local, bijvoorbeeld\n' +
        '  DATABASE_URL=postgres://logistiek:wachtwoord@localhost:5433/logistiek\n\n' +
        'Op de server wordt hij door docker compose gezet.'
    )
    process.exit(1)
  }
  return url
}
