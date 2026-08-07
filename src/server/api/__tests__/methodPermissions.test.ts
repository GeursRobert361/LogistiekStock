import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { METHOD_PERMISSIONS, CLIENT_ONLY_METHODS, getMethodRule } from '../methodPermissions'
import { PERMISSIONS, hasPermission } from '@/lib/permissions'
import { UserRole } from '@/types'

/**
 * De API is één ingang die naar de repositories dispatcht. Deze tests bewaken
 * dat elke methode een bewuste rechtenregel heeft — anders zou een nieuwe
 * repository-methode via /api/rpc bereikbaar zijn zonder dat iemand daar over
 * nagedacht heeft.
 */

const INTERFACES_DIR = join(process.cwd(), 'src', 'repositories', 'interfaces')

/** Leest de methodenamen uit een repository-interface. */
function readInterfaceMethods(file: string): string[] {
  const source = readFileSync(join(INTERFACES_DIR, file), 'utf8')
  const body = source.slice(source.indexOf('export interface I'))

  return [...body.matchAll(/^\s{2}(\w+)\??\(/gm)]
    .map((match) => match[1]!)
    // Alleen echte methodes, geen typedefinities eromheen.
    .filter((name) => name !== 'constructor')
}

const RESOURCE_BY_INTERFACE: Record<string, string> = {
  'IAuthRepository.ts': 'auth',
  'IKioskRepository.ts': 'kiosk',
  'IProductRepository.ts': 'product',
  'IEventRepository.ts': 'event',
  'ICountRepository.ts': 'count',
  'IRestockRepository.ts': 'restock',
  'IIncidentRepository.ts': 'incident',
}

describe('rechtentabel', () => {
  it('dekt elke methode van elke repository-interface', () => {
    const files = readdirSync(INTERFACES_DIR).filter((file) => file.endsWith('.ts'))
    expect(files.length).toBe(Object.keys(RESOURCE_BY_INTERFACE).length)

    const ongedekt: string[] = []

    for (const file of files) {
      const resource = RESOURCE_BY_INTERFACE[file]
      expect(resource, `onbekende interface ${file}`).toBeDefined()

      for (const method of readInterfaceMethods(file)) {
        const key = `${resource}.${method}`
        if (CLIENT_ONLY_METHODS.has(key)) continue
        if (!METHOD_PERMISSIONS[key]) ongedekt.push(key)
      }
    }

    expect(ongedekt).toEqual([])
  })

  it('kent geen regels voor methodes die niet bestaan', () => {
    const bestaande = new Set<string>()
    for (const [file, resource] of Object.entries(RESOURCE_BY_INTERFACE)) {
      for (const method of readInterfaceMethods(file)) {
        bestaande.add(`${resource}.${method}`)
      }
    }

    const verweesd = Object.keys(METHOD_PERMISSIONS).filter((key) => !bestaande.has(key))
    expect(verweesd).toEqual([])
  })

  it('weigert een onbekende methode', () => {
    expect(getMethodRule('kiosk', 'dropDatabase')).toBeNull()
    expect(getMethodRule('onzin', 'getRings')).toBeNull()
  })

  it('gebruikt alleen rechten die bestaan', () => {
    const geldig = new Set<string>([...Object.keys(PERMISSIONS), 'AUTHENTICATED'])
    for (const [key, rule] of Object.entries(METHOD_PERMISSIONS)) {
      expect(geldig, `regel voor ${key}`).toContain(rule)
    }
  })
})

describe('rechten per rol via de API', () => {
  const TELLER = [UserRole.TELLER]
  const VULLER = [UserRole.VULLER]
  const PLANNER = [UserRole.PLANNER]

  /** Bootst na wat het API-eindpunt doet. */
  function mag(roles: UserRole[], resource: string, method: string): boolean {
    const rule = getMethodRule(resource, method)
    if (!rule) return false
    return rule === 'AUTHENTICATED' || hasPermission(roles, rule)
  }

  it('laat een teller tellen maar geen producten beheren', () => {
    expect(mag(TELLER, 'count', 'upsertCountEntry')).toBe(true)
    expect(mag(TELLER, 'product', 'updateProduct')).toBe(false)
    expect(mag(TELLER, 'product', 'upsertStandard')).toBe(false)
  })

  it('laat een teller wel stamdata lezen — die heeft hij nodig om te tellen', () => {
    expect(mag(TELLER, 'product', 'getProducts')).toBe(true)
    expect(mag(TELLER, 'product', 'getStandards')).toBe(true)
    expect(mag(TELLER, 'kiosk', 'getKiosks')).toBe(true)
  })

  it('laat een vuller zijn ronde afmaken', () => {
    // Precies de keten die in de RLS-variant vastliep.
    expect(mag(VULLER, 'restock', 'updateRound')).toBe(true)
    expect(mag(VULLER, 'restock', 'createDelivery')).toBe(true)
    expect(mag(VULLER, 'restock', 'updateRequirement')).toBe(true)
    expect(mag(VULLER, 'restock', 'releaseReservation')).toBe(true)
  })

  it('laat een vuller geen telling schrijven of goedkeuren', () => {
    expect(mag(VULLER, 'count', 'upsertCountEntry')).toBe(false)
    expect(mag(VULLER, 'restock', 'bulkUpsertRequirements')).toBe(false)
  })

  it('laat een planner normen en planning doen, maar geen stamdata', () => {
    expect(mag(PLANNER, 'product', 'upsertStandard')).toBe(true)
    expect(mag(PLANNER, 'restock', 'createRound')).toBe(true)
    expect(mag(PLANNER, 'product', 'createProduct')).toBe(false)
  })

  it('laat niemand zonder rol iets schrijven', () => {
    expect(mag([], 'count', 'upsertCountEntry')).toBe(false)
    expect(mag([], 'product', 'updateProduct')).toBe(false)
    // Lezen mag wel: elke ingelogde gebruiker heeft de stamdata nodig.
    expect(mag([], 'kiosk', 'getKiosks')).toBe(true)
  })
})
