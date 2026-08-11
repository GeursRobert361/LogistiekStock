import type { IAuthRepository, LoginCredentials, AuthSession } from '../interfaces/IAuthRepository'
import type { Profile, UserRole } from '@/types'
import { demoTables } from './demoTables'
import {
  assertEmailAvailable,
  assertMayDeactivate,
  assertMaySetRoles,
  normalizeEmail,
} from '@/domain/users/guards'

const SESSION_KEY = 'demo_session'

/**
 * Inloggen en gebruikersbeheer in demo-modus.
 *
 * Dezelfde grendels als op de server, want een regel die alleen in productie
 * geldt is in demo niet te vinden en gaat dus stuk op het moment dat het telt.
 * Wachtwoorden staan hier leesbaar in de browser: demo-data is openbaar.
 */
export class DemoAuthRepository implements IAuthRepository {
  async login(credentials: LoginCredentials): Promise<AuthSession> {
    const email = normalizeEmail(credentials.email)

    const stored = demoTables.passwords.find((item) => normalizeEmail(item.id) === email)
    if (!stored || stored.password !== credentials.password) {
      throw new Error('Ongeldig e-mailadres of wachtwoord')
    }

    const profile = demoTables.profiles.find((p) => normalizeEmail(p.email) === email)
    if (!profile) throw new Error('Gebruiker niet gevonden')
    if (!profile.isActive) throw new Error('Dit account is gedeactiveerd')

    const session: AuthSession = { profile }
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
    }
    return session
  }

  async logout(): Promise<void> {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(SESSION_KEY)
    }
  }

  async getCurrentSession(): Promise<AuthSession | null> {
    if (typeof window === 'undefined') return null
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (!raw) return null
    try {
      return JSON.parse(raw) as AuthSession
    } catch {
      return null
    }
  }

  async getCurrentProfile(): Promise<Profile | null> {
    const session = await this.getCurrentSession()
    return session?.profile ?? null
  }

  async listProfiles(): Promise<Profile[]> {
    return demoTables.profiles.all()
  }

  private activeAdminCount(): number {
    return demoTables.profiles.filter(
      (profile) => profile.isActive && profile.roles.includes('ADMIN' as UserRole)
    ).length
  }

  private emails(): string[] {
    return demoTables.profiles.all().map((profile) => profile.email)
  }

  async createProfile(input: {
    email: string
    displayName: string
    password: string
    roles: UserRole[]
  }): Promise<Profile> {
    assertEmailAvailable({ email: input.email, existingEmails: this.emails() })
    assertMaySetRoles(
      {
        target: { id: 'nieuw', roles: [], isActive: true },
        currentUserId: '',
        activeAdminCount: this.activeAdminCount(),
      },
      input.roles
    )

    const now = new Date().toISOString()
    const profile: Profile = {
      id: `profiel-${crypto.randomUUID()}`,
      email: normalizeEmail(input.email),
      displayName: input.displayName.trim(),
      roles: input.roles,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    }

    demoTables.profiles.insert(profile)
    demoTables.passwords.put({ id: profile.email, password: input.password })
    return profile
  }

  async updateProfile(
    id: string,
    input: { email?: string; displayName?: string; roles?: UserRole[] }
  ): Promise<Profile> {
    const current = demoTables.profiles.getById(id)
    if (!current) throw new Error('Deze gebruiker bestaat niet.')

    if (input.email !== undefined) {
      assertEmailAvailable({
        email: input.email,
        existingEmails: this.emails(),
        ownEmail: current.email,
      })
    }
    if (input.roles !== undefined) {
      assertMaySetRoles(
        { target: current, currentUserId: '', activeAdminCount: this.activeAdminCount() },
        input.roles
      )
    }

    const nextEmail = input.email === undefined ? current.email : normalizeEmail(input.email)

    // Het wachtwoord hangt aan het adres, dus dat moet mee verhuizen.
    if (nextEmail !== current.email) {
      const stored = demoTables.passwords.getById(current.email)
      if (stored) {
        demoTables.passwords.remove(current.email)
        demoTables.passwords.put({ id: nextEmail, password: stored.password })
      }
    }

    return demoTables.profiles.update(id, {
      email: nextEmail,
      displayName: input.displayName?.trim() ?? current.displayName,
      roles: input.roles ?? current.roles,
      updatedAt: new Date().toISOString(),
    })
  }

  async setPassword(id: string, password: string): Promise<void> {
    const profile = demoTables.profiles.getById(id)
    if (!profile) throw new Error('Deze gebruiker bestaat niet.')
    demoTables.passwords.put({ id: profile.email, password })
  }

  async setActive(id: string, isActive: boolean): Promise<Profile> {
    const profile = demoTables.profiles.getById(id)
    if (!profile) throw new Error('Deze gebruiker bestaat niet.')

    if (!isActive) {
      const current = await this.getCurrentProfile()
      assertMayDeactivate({
        target: profile,
        currentUserId: current?.id ?? '',
        activeAdminCount: this.activeAdminCount(),
      })
    }

    return demoTables.profiles.update(id, { isActive, updatedAt: new Date().toISOString() })
  }
}
