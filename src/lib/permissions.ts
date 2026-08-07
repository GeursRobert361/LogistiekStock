import { UserRole } from '@/types'

/**
 * Wie mag wat.
 *
 * Navigatie verbergen is geen beveiliging: een teller die /admin/products
 * intypt hoort daar niets te kunnen. Daarom staan de rechten hier centraal en
 * worden ze in de layout op het pad toegepast.
 */
export const PERMISSIONS = {
  /** Evenementen aanmaken en beheren. */
  MANAGE_EVENTS: [UserRole.ADMIN, UserRole.PLANNER],
  /** Tellen op de vloer. */
  COUNT: [UserRole.ADMIN, UserRole.PLANNER, UserRole.TELLER],
  /** Tellingen controleren en goedkeuren. */
  REVIEW_COUNTS: [UserRole.ADMIN, UserRole.PLANNER],
  /** Vulrondes plannen en pallets samenstellen. */
  PLAN_RESTOCK: [UserRole.ADMIN, UserRole.PLANNER],
  /** Vulrondes uitvoeren. */
  EXECUTE_RESTOCK: [UserRole.ADMIN, UserRole.PLANNER, UserRole.VULLER],
  /** Voorraadnormen beheren. */
  MANAGE_STANDARDS: [UserRole.ADMIN, UserRole.PLANNER],
  /** Producten, kiosken, ringen, gebruikers en instellingen beheren. */
  MANAGE_MASTER_DATA: [UserRole.ADMIN],
  /** Storingen melden en bekijken — iedereen op de vloer. */
  INCIDENTS: [UserRole.ADMIN, UserRole.PLANNER, UserRole.TELLER, UserRole.VULLER],
} as const satisfies Record<string, readonly UserRole[]>

export type Permission = keyof typeof PERMISSIONS

export function hasPermission(roles: UserRole[], permission: Permission): boolean {
  return PERMISSIONS[permission].some((role) => roles.includes(role))
}

/**
 * Beveiligde paden, meest specifieke eerst. Een pad zonder regel is voor
 * iedere ingelogde gebruiker toegankelijk.
 */
const ROUTE_RULES: Array<{ prefix: string; permission: Permission }> = [
  { prefix: '/admin/standards', permission: 'MANAGE_STANDARDS' },
  { prefix: '/admin/import', permission: 'MANAGE_STANDARDS' },
  { prefix: '/admin', permission: 'MANAGE_MASTER_DATA' },
  { prefix: '/restock-rounds', permission: 'EXECUTE_RESTOCK' },
]

/** Rechten die nodig zijn voor een pad, of `null` wanneer er geen regel geldt. */
export function getRequiredPermission(pathname: string): Permission | null {
  const rule = ROUTE_RULES.find(
    (candidate) => pathname === candidate.prefix || pathname.startsWith(`${candidate.prefix}/`)
  )
  if (rule) return rule.permission

  // Telpaden binnen een evenement.
  if (/^\/events\/[^/]+\/count\/review/.test(pathname)) return 'REVIEW_COUNTS'
  if (/^\/events\/[^/]+\/count/.test(pathname)) return 'COUNT'
  if (/^\/events\/[^/]+\/restock/.test(pathname)) return 'PLAN_RESTOCK'

  return null
}
