import { describe, it, expect } from 'vitest'
import { getRequiredPermission, hasPermission } from '../permissions'
import { UserRole } from '@/types'

const TELLER = [UserRole.TELLER]
const VULLER = [UserRole.VULLER]
const PLANNER = [UserRole.PLANNER]
const ADMIN = [UserRole.ADMIN]

describe('getRequiredPermission', () => {
  it('beschermt beheerpagina’s', () => {
    expect(getRequiredPermission('/admin/products')).toBe('MANAGE_MASTER_DATA')
    expect(getRequiredPermission('/admin/users')).toBe('MANAGE_MASTER_DATA')
  })

  it('laat normen door de planner beheren', () => {
    expect(getRequiredPermission('/admin/standards')).toBe('MANAGE_STANDARDS')
    expect(getRequiredPermission('/admin/import')).toBe('MANAGE_STANDARDS')
  })

  it('herkent tel- en reviewpaden binnen een evenement', () => {
    expect(getRequiredPermission('/events/event-1/count/start')).toBe('COUNT')
    expect(getRequiredPermission('/events/event-1/count/s1/kiosk/k1')).toBe('COUNT')
    expect(getRequiredPermission('/events/event-1/count/review')).toBe('REVIEW_COUNTS')
    expect(getRequiredPermission('/events/event-1/restock')).toBe('PLAN_RESTOCK')
  })

  it('laat vrije paden ongemoeid', () => {
    expect(getRequiredPermission('/dashboard')).toBeNull()
    expect(getRequiredPermission('/events')).toBeNull()
    expect(getRequiredPermission('/incidents')).toBeNull()
  })
})

describe('rolrechten', () => {
  it('een teller kan geen beheerpagina gebruiken', () => {
    const permission = getRequiredPermission('/admin/products')!
    expect(hasPermission(TELLER, permission)).toBe(false)
  })

  it('een teller kan wel tellen en storingen melden', () => {
    expect(hasPermission(TELLER, 'COUNT')).toBe(true)
    expect(hasPermission(TELLER, 'INCIDENTS')).toBe(true)
  })

  it('een vuller kan geen telling goedkeuren', () => {
    expect(hasPermission(VULLER, 'REVIEW_COUNTS')).toBe(false)
    expect(hasPermission(VULLER, 'COUNT')).toBe(false)
  })

  it('een vuller kan wel vulrondes uitvoeren en storingen zien', () => {
    expect(hasPermission(VULLER, 'EXECUTE_RESTOCK')).toBe(true)
    expect(hasPermission(VULLER, 'INCIDENTS')).toBe(true)
  })

  it('een planner kan reviewen en plannen, maar geen stamdata beheren', () => {
    expect(hasPermission(PLANNER, 'REVIEW_COUNTS')).toBe(true)
    expect(hasPermission(PLANNER, 'PLAN_RESTOCK')).toBe(true)
    expect(hasPermission(PLANNER, 'MANAGE_STANDARDS')).toBe(true)
    expect(hasPermission(PLANNER, 'MANAGE_MASTER_DATA')).toBe(false)
  })

  it('een admin heeft overal toegang', () => {
    const allPermissions = [
      'MANAGE_EVENTS',
      'COUNT',
      'REVIEW_COUNTS',
      'PLAN_RESTOCK',
      'EXECUTE_RESTOCK',
      'MANAGE_STANDARDS',
      'MANAGE_MASTER_DATA',
      'INCIDENTS',
    ] as const

    for (const permission of allPermissions) {
      expect(hasPermission(ADMIN, permission)).toBe(true)
    }
  })
})

describe('beheeroverzicht', () => {
  it('is bereikbaar voor een planner, de onderdelen erbinnen niet allemaal', () => {
    expect(getRequiredPermission('/admin')).toBe('MANAGE_STANDARDS')
    expect(hasPermission(PLANNER, getRequiredPermission('/admin')!)).toBe(true)

    // Binnen het overzicht blijft stamdata voor de admin.
    expect(getRequiredPermission('/admin/products')).toBe('MANAGE_MASTER_DATA')
    expect(hasPermission(PLANNER, 'MANAGE_MASTER_DATA')).toBe(false)
  })

  it('houdt een teller er helemaal buiten', () => {
    expect(hasPermission(TELLER, getRequiredPermission('/admin')!)).toBe(false)
  })

  it('laat ringen alleen voor de admin', () => {
    expect(getRequiredPermission('/admin/rings')).toBe('MANAGE_MASTER_DATA')
  })
})
