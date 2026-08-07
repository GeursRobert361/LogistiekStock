import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Controleert de Supabase-laag tegen de migraties.
 *
 * Zonder draaiende database is een typefout in een kolomnaam pas in productie
 * zichtbaar. Deze test leest de migratie-SQL en vergelijkt die met de
 * tabel- en kolomnamen die de mappers en repositories gebruiken.
 */

const MIGRATIONS_DIR = join(process.cwd(), 'supabase', 'migrations')
const SUPABASE_DIR = join(process.cwd(), 'src', 'repositories', 'supabase')
const MAPPERS_FILE = join(process.cwd(), 'src', 'server', 'db', 'rowMappers.ts')

interface Schema {
  tables: Map<string, Set<string>>
}

/** Leest `create table` en `alter table … add column` uit de migraties. */
function parseSchema(): Schema {
  const tables = new Map<string, Set<string>>()

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith('.sql'))
    .sort()

  for (const file of files) {
    const sql = stripComments(readFileSync(join(MIGRATIONS_DIR, file), 'utf8'))

    for (const match of sql.matchAll(
      /create\s+table\s+(?:if\s+not\s+exists\s+)?(\w+)\s*\(([\s\S]*?)\n\)\s*;/gi
    )) {
      const [, tableName, body] = match
      const columns = tables.get(tableName!) ?? new Set<string>()

      for (const line of body!.split('\n')) {
        const trimmed = line.trim()
        if (trimmed === '') continue
        // Sla tabelconstraints over: unique(...), primary key(...), check(...)
        if (/^(unique|primary\s+key|foreign\s+key|check|constraint)\b/i.test(trimmed)) continue

        const columnMatch = /^(\w+)\s+/.exec(trimmed)
        if (columnMatch) columns.add(columnMatch[1]!)
      }

      tables.set(tableName!, columns)
    }

    for (const match of sql.matchAll(
      /alter\s+table\s+(\w+)\s+add\s+column\s+(?:if\s+not\s+exists\s+)?(\w+)/gi
    )) {
      const [, tableName, columnName] = match
      const columns = tables.get(tableName!) ?? new Set<string>()
      columns.add(columnName!)
      tables.set(tableName!, columns)
    }
  }

  return { tables }
}

function stripComments(sql: string): string {
  return sql.replace(/--[^\n]*/g, '')
}

/**
 * De bodies van de `*ToRow`-functies: precies daar staan object-sleutels die
 * kolomnamen zijn. De signatuur wordt overgeslagen, anders zouden
 * parameternamen als kolom worden aangezien.
 */
function toRowBodies(source: string): string[] {
  return source
    .split('export function ')
    .filter((chunk) => /^\w+ToRow\b/.test(chunk))
    .map((chunk) => {
      const bodyStart = chunk.indexOf('Row {')
      return bodyStart === -1 ? '' : chunk.slice(bodyStart + 'Row {'.length)
    })
}

function readSupabaseSource(): string {
  return readdirSync(SUPABASE_DIR)
    .filter((file) => file.endsWith('.ts'))
    .map((file) => readFileSync(join(SUPABASE_DIR, file), 'utf8'))
    .join('\n')
}

const schema = parseSchema()
const source = readSupabaseSource()
/** Alleen de mappers vertalen naar kolomnamen; elders zijn object-sleutels gewoon code. */
const mappersSource = readFileSync(MAPPERS_FILE, 'utf8')

describe('migraties', () => {
  it('bevat de tabellen waar de app op leunt', () => {
    const expected = [
      'profiles',
      'user_roles',
      'rings',
      'kiosks',
      'product_categories',
      'products',
      'kiosk_product_standards',
      'events',
      'event_rings',
      'event_kiosks',
      'event_users',
      'count_sessions',
      'kiosk_counts',
      'count_entries',
      'incidents',
      'restock_requirements',
      'restock_rounds',
      'restock_round_items',
      'restock_round_stops',
      'restock_stop_items',
      'restock_deliveries',
      'stock_reservations',
    ]

    for (const table of expected) {
      expect([...schema.tables.keys()]).toContain(table)
    }
  })

  it('kent de kolommen die in migratie 003 en 004 zijn toegevoegd', () => {
    expect(schema.tables.get('restock_rounds')).toContain('round_type')
    expect(schema.tables.get('restock_round_stops')).toContain('skip_reason')
    expect(schema.tables.get('restock_stop_items')).toContain('planned_packages')
  })
})

describe('Supabase-repositories', () => {
  it('gebruikt alleen tabellen die in de migraties bestaan', () => {
    const used = [...source.matchAll(/\.from\('(\w+)'\)/g)].map((match) => match[1]!)
    expect(used.length).toBeGreaterThan(10)

    const unknown = [...new Set(used)].filter((table) => !schema.tables.has(table))
    expect(unknown).toEqual([])
  })

  it('gebruikt alleen kolommen die in de migraties bestaan', () => {
    // Kolomnamen komen uit drie plekken: `row.<kolom>` bij het lezen,
    // object-sleutels in de mappers bij het schrijven, en de kolom-argumenten
    // van querybouwers als .eq() en .order().
    const candidates = new Set<string>()

    for (const match of mappersSource.matchAll(/\brow\.(\w+)/g)) candidates.add(match[1]!)
    for (const body of toRowBodies(mappersSource)) {
      for (const match of body.matchAll(/(?:^|\n)\s+(?:row\.)?(\w+)\s*[:=]\s/g)) {
        candidates.add(match[1]!)
      }
    }
    for (const match of source.matchAll(
      /\.(?:eq|neq|gt|gte|lt|lte|in|order|not)\('(\w+)'/g
    )) {
      candidates.add(match[1]!)
    }

    const allColumns = new Set<string>()
    for (const columns of schema.tables.values()) {
      for (const column of columns) allColumns.add(column)
    }

    // camelCase hoort bij domeintypen, niet bij de database.
    const snakeCaseOnly = [...candidates].filter(
      (name) => /^[a-z][a-z0-9_]*$/.test(name) && !/[A-Z]/.test(name)
    )

    const unknown = snakeCaseOnly.filter((name) => !allColumns.has(name))
    expect(unknown).toEqual([])
  })

  it('verwijst in onConflict alleen naar bestaande kolommen', () => {
    const conflicts = [...source.matchAll(/onConflict:\s*\n?\s*'([\w,\s]+)'/g)].map(
      (match) => match[1]!
    )
    expect(conflicts.length).toBeGreaterThan(5)

    const allColumns = new Set<string>()
    for (const columns of schema.tables.values()) {
      for (const column of columns) allColumns.add(column)
    }

    for (const conflict of conflicts) {
      for (const column of conflict.split(',').map((part) => part.trim())) {
        expect(allColumns, `onConflict-kolom "${column}"`).toContain(column)
      }
    }
  })
})

describe('seed-script', () => {
  const seed = readFileSync(join(process.cwd(), 'scripts', 'seed.ts'), 'utf8')

  it('schrijft alleen naar bestaande tabellen', () => {
    const used = [...seed.matchAll(/\.from\('(\w+)'\)/g)].map((match) => match[1]!)
    const unknown = [...new Set(used)].filter((table) => !schema.tables.has(table))
    expect(unknown).toEqual([])
  })

  it('gebruikt onConflict-kolommen die als unique in het schema staan', () => {
    const sql = readdirSync(MIGRATIONS_DIR)
      .filter((file) => file.endsWith('.sql'))
      .map((file) => stripComments(readFileSync(join(MIGRATIONS_DIR, file), 'utf8')))
      .join('\n')
      .toLowerCase()

    const conflicts = [...seed.matchAll(/onConflict:\s*'([\w,]+)'/g)].map((match) => match[1]!)

    for (const conflict of conflicts) {
      const columns = conflict.split(',').map((part) => part.trim())
      if (columns.length === 1 && columns[0] === 'id') continue // primary key

      // Er moet een unique-constraint of primaire sleutel over deze kolommen zijn.
      const pattern = columns.join(',\\s*')
      const hasUnique =
        new RegExp(`unique\\s*\\(\\s*${pattern}\\s*\\)`).test(sql) ||
        new RegExp(`primary\\s+key\\s*\\(\\s*${pattern}\\s*\\)`).test(sql) ||
        new RegExp(`${columns[0]}\\s+\\w+[^,\\n]*\\bunique\\b`).test(sql)

      expect(hasUnique, `unique-constraint voor (${conflict})`).toBe(true)
    }
  })
})
