import { query } from '@/server/db/pool'
import { mapProfile } from '@/server/db/rowMappers'
import { UserRole, type Profile } from '@/types'
import { kioskRepository } from './kiosk'
import { productRepository } from './product'
import { eventRepository } from './event'
import { countRepository } from './count'
import { restockRepository } from './restock'
import { incidentRepository } from './incident'

/**
 * De server-side repositories, op naam. Het API-eindpunt zoekt hier op wat de
 * client aanvraagt — na de rechtencontrole, nooit ervoor.
 */
export const serverRepositories = {
  auth: {
    async listProfiles(): Promise<Profile[]> {
      const [profileRows, roleRows] = await Promise.all([
        query('select * from profiles order by display_name'),
        query<{ profile_id: string; role: string }>('select profile_id, role from user_roles'),
      ])

      const rolesByProfile = new Map<string, UserRole[]>()
      for (const row of roleRows) {
        const role = row.role as UserRole
        if (!Object.values(UserRole).includes(role)) continue
        rolesByProfile.set(row.profile_id, [...(rolesByProfile.get(row.profile_id) ?? []), role])
      }

      return profileRows.map((row) => mapProfile(row, rolesByProfile.get(String(row.id)) ?? []))
    },
  },
  kiosk: kioskRepository,
  product: productRepository,
  event: eventRepository,
  count: countRepository,
  restock: restockRepository,
  incident: incidentRepository,
} as const

export type ServerResource = keyof typeof serverRepositories
