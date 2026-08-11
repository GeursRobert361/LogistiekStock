import { query, queryOne } from '@/server/db/pool'
import { mapProfile } from '@/server/db/rowMappers'
import { hashPassword } from '@/server/auth/session'
import { BusinessRuleError, ValidationError } from '@/server/api/errors'
import {
  assertEmailAvailable,
  assertMayDeactivate,
  assertMaySetRoles,
  normalizeEmail,
  UserGuardError,
  type GuardTarget,
} from '@/domain/users/guards'
import { UserRole, type Profile } from '@/types'

/**
 * Gebruikersbeheer.
 *
 * De grendels uit `domain/users/guards` worden hier aangeroepen en niet in het
 * formulier: dit is de plek waar ze niet te omzeilen zijn. Een verborgen knop
 * houdt niemand tegen die de RPC-aanroep zelf nabouwt.
 */

function toGuardError(error: unknown): never {
  if (error instanceof UserGuardError) throw new BusinessRuleError(error.message)
  throw error
}

async function loadRolesByProfile(): Promise<Map<string, UserRole[]>> {
  const rows = await query<{ profile_id: string; role: string }>(
    'select profile_id, role from user_roles'
  )

  const byProfile = new Map<string, UserRole[]>()
  for (const row of rows) {
    const role = row.role as UserRole
    if (!Object.values(UserRole).includes(role)) continue
    byProfile.set(row.profile_id, [...(byProfile.get(row.profile_id) ?? []), role])
  }
  return byProfile
}

async function loadProfile(id: string): Promise<GuardTarget & { email: string }> {
  const row = await queryOne<{ id: string; email: string; is_active: boolean }>(
    'select id, email, is_active from profiles where id = $1',
    [id]
  )
  if (!row) throw new ValidationError('Deze gebruiker bestaat niet.')

  const roles = (await loadRolesByProfile()).get(String(row.id)) ?? []
  return { id: String(row.id), email: row.email, isActive: row.is_active, roles }
}

/**
 * Actieve beheerders, want alleen die kunnen inloggen. Een inactieve beheerder
 * is geen vervanger en mag dus niet meetellen als er één overblijft.
 */
async function countActiveAdmins(): Promise<number> {
  const row = await queryOne<{ aantal: string }>(
    `select count(*) as aantal
       from profiles p
       join user_roles r on r.profile_id = p.id
      where p.is_active = true and r.role = 'ADMIN'`
  )
  return Number(row?.aantal ?? 0)
}

async function allEmails(): Promise<string[]> {
  const rows = await query<{ email: string }>('select email from profiles')
  return rows.map((row) => row.email)
}

async function replaceRoles(profileId: string, roles: UserRole[]): Promise<void> {
  await query('delete from user_roles where profile_id = $1', [profileId])
  for (const role of roles) {
    await query('insert into user_roles (profile_id, role) values ($1, $2)', [profileId, role])
  }
}

/**
 * Sessies opruimen na een wachtwoordwijziging.
 *
 * Een sessie hangt aan een token in de tabel, niet aan het wachtwoord — zonder
 * dit blijft iemand die al ingelogd was gewoon binnen na een reset, en dan
 * heeft de reset niets gedaan waar hij voor bedoeld was.
 */
async function dropSessions(profileId: string): Promise<void> {
  await query('delete from sessions where profile_id = $1', [profileId])
}

async function readProfile(id: string): Promise<Profile> {
  const row = await queryOne('select * from profiles where id = $1', [id])
  if (!row) throw new ValidationError('Deze gebruiker bestaat niet.')

  const roles = (await loadRolesByProfile()).get(String((row as { id: string }).id)) ?? []
  return mapProfile(row, roles)
}

export const authRepository = {
  async listProfiles(): Promise<Profile[]> {
    const [profileRows, rolesByProfile] = await Promise.all([
      query('select * from profiles order by display_name'),
      loadRolesByProfile(),
    ])
    return profileRows.map((row) => mapProfile(row, rolesByProfile.get(String(row.id)) ?? []))
  },

  async createProfile(input: {
    email: string
    displayName: string
    password: string
    roles: UserRole[]
  }): Promise<Profile> {
    try {
      assertEmailAvailable({ email: input.email, existingEmails: await allEmails() })
      // Een nieuw account is nooit de laatste beheerder; de rollencontrole
      // dient hier alleen om "geen enkele rol" tegen te houden.
      assertMaySetRoles(
        {
          target: { id: 'nieuw', roles: [], isActive: true },
          currentUserId: '',
          activeAdminCount: await countActiveAdmins(),
        },
        input.roles
      )
    } catch (error) {
      toGuardError(error)
    }

    const row = await queryOne<{ id: string }>(
      `insert into profiles (email, password_hash, display_name, is_active)
       values ($1, $2, $3, true)
       returning id`,
      [normalizeEmail(input.email), await hashPassword(input.password), input.displayName.trim()]
    )
    if (!row) throw new BusinessRuleError('Het account kon niet worden aangemaakt.')

    await replaceRoles(String(row.id), input.roles)
    return readProfile(String(row.id))
  },

  async updateProfile(
    id: string,
    input: { email?: string; displayName?: string; roles?: UserRole[] }
  ): Promise<Profile> {
    const target = await loadProfile(id)

    try {
      if (input.email !== undefined) {
        assertEmailAvailable({
          email: input.email,
          existingEmails: await allEmails(),
          ownEmail: target.email,
        })
      }
      if (input.roles !== undefined) {
        assertMaySetRoles(
          { target, currentUserId: '', activeAdminCount: await countActiveAdmins() },
          input.roles
        )
      }
    } catch (error) {
      toGuardError(error)
    }

    if (input.email !== undefined) {
      await query('update profiles set email = $1 where id = $2', [normalizeEmail(input.email), id])
    }
    if (input.displayName !== undefined) {
      await query('update profiles set display_name = $1 where id = $2', [
        input.displayName.trim(),
        id,
      ])
    }
    if (input.roles !== undefined) {
      await replaceRoles(id, input.roles)
    }

    return readProfile(id)
  },

  async setPassword(id: string, password: string): Promise<void> {
    await loadProfile(id)
    await query('update profiles set password_hash = $1 where id = $2', [
      await hashPassword(password),
      id,
    ])
    await dropSessions(id)
  },

  /**
   * Wie de bewerking uitvoert staat hier bewust niet bij: die zou dan uit de
   * argumenten van de client komen en dus te vervalsen zijn. Het verbod op je
   * eigen account deactiveren zit in `entityGuards`, waar de ingelogde
   * gebruiker vandaan de sessie komt. Hier blijft de regel over die van de
   * gegevens afhangt: er moet een beheerder overblijven.
   */
  async setActive(id: string, isActive: boolean): Promise<Profile> {
    const target = await loadProfile(id)

    if (!isActive) {
      try {
        assertMayDeactivate({
          target,
          // Al afgevangen in entityGuards; hier telt alleen de laatste-beheerderregel.
          currentUserId: '',
          activeAdminCount: await countActiveAdmins(),
        })
      } catch (error) {
        toGuardError(error)
      }
    }

    await query('update profiles set is_active = $1 where id = $2', [isActive, id])
    // Inloggen is al geblokkeerd zodra is_active uit staat -- die wordt bij elke
    // sessiecontrole gelezen -- maar de rijen laten liggen zou de tabel laten
    // liegen over wie er ingelogd is.
    if (!isActive) await dropSessions(id)

    return readProfile(id)
  },
}
