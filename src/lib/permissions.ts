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
  /** De vulplanning: overzicht van alle tekorten en wat er nog te verdelen is. */
  PLAN_RESTOCK: [UserRole.ADMIN, UserRole.PLANNER],
  /**
   * Zelf een pallet samenstellen. Ook de vuller: die staat bij de pallet en
   * weet wat hij pakt — daar hoeft geen planner tussen te zitten.
   */
  COMPOSE_PALLET: [UserRole.ADMIN, UserRole.PLANNER, UserRole.VULLER],
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
const ROUTE_RULES: Array<{ prefix: string; permission: Permission; exact?: boolean }> = [
  // Het beheeroverzicht zelf mag ruimer: het toont alleen de onderdelen waar
  // je rechten voor hebt, en een planner beheert de voorraadnormen.
  { prefix: '/admin', permission: 'MANAGE_STANDARDS', exact: true },
  { prefix: '/admin/standards', permission: 'MANAGE_STANDARDS' },
  { prefix: '/admin/import', permission: 'MANAGE_STANDARDS' },
  // De agenda hoort bij het plannen van evenementen, niet bij de stamdata.
  { prefix: '/admin/agenda', permission: 'MANAGE_EVENTS' },
  { prefix: '/admin', permission: 'MANAGE_MASTER_DATA' },
  { prefix: '/restock-rounds', permission: 'EXECUTE_RESTOCK' },
  { prefix: '/conflicts', permission: 'REVIEW_COUNTS' },
  // Verbruikscijfers zijn planningsinformatie, niet iets voor de vloer.
  { prefix: '/data', permission: 'REVIEW_COUNTS' },
]

/** Rechten die nodig zijn voor een pad, of `null` wanneer er geen regel geldt. */
export function getRequiredPermission(pathname: string): Permission | null {
  const rule = ROUTE_RULES.find((candidate) =>
    candidate.exact
      ? pathname === candidate.prefix
      : pathname === candidate.prefix || pathname.startsWith(`${candidate.prefix}/`)
  )
  if (rule) return rule.permission

  // Telpaden binnen een evenement.
  if (/^\/events\/[^/]+\/count\/review/.test(pathname)) return 'REVIEW_COUNTS'
  if (/^\/events\/[^/]+\/count/.test(pathname)) return 'COUNT'
  if (/^\/events\/[^/]+\/restock/.test(pathname)) return 'PLAN_RESTOCK'

  return null
}
