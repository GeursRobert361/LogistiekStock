import type { IAuthRepository, LoginCredentials, AuthSession } from '../interfaces/IAuthRepository'
import type { Profile, UserRole } from '@/types'

/**
 * Inloggen via /api/auth. De sessie zit in een httpOnly-cookie, dus de
 * browser kan er zelf niet bij — dat is precies de bedoeling.
 */
export class HttpAuthRepository implements IAuthRepository {
  async login({ email, password }: LoginCredentials): Promise<AuthSession> {
    const response = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ email, password }),
    })

    const body = (await response.json().catch(() => ({}))) as { data?: Profile; error?: string }

    if (!response.ok || !body.data) {
      throw new Error(body.error ?? 'Inloggen is mislukt.')
    }
    return { profile: body.data }
  }

  async logout(): Promise<void> {
    await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ action: 'logout' }),
    })
  }

  async getCurrentSession(): Promise<AuthSession | null> {
    const profile = await this.getCurrentProfile()
    return profile ? { profile } : null
  }

  async getCurrentProfile(): Promise<Profile | null> {
    const response = await fetch('/api/auth', { credentials: 'same-origin' })
    if (!response.ok) return null

    const body = (await response.json().catch(() => ({}))) as { data?: Profile | null }
    return body.data ?? null
  }

  async listProfiles(): Promise<Profile[]> {
    return rpc<Profile[]>('listProfiles', [], 'Gebruikers ophalen is mislukt.')
  }

  async createProfile(input: {
    email: string
    displayName: string
    password: string
    roles: UserRole[]
  }): Promise<Profile> {
    return rpc<Profile>('createProfile', [input], 'Het account kon niet worden aangemaakt.')
  }

  async updateProfile(
    id: string,
    input: { email?: string; displayName?: string; roles?: UserRole[] }
  ): Promise<Profile> {
    return rpc<Profile>('updateProfile', [id, input], 'De wijziging kon niet worden opgeslagen.')
  }

  async setPassword(id: string, password: string): Promise<void> {
    await rpc<null>('setPassword', [id, password], 'Het wachtwoord kon niet worden ingesteld.')
  }

  async setActive(id: string, isActive: boolean): Promise<Profile> {
    return rpc<Profile>('setActive', [id, isActive], 'De wijziging kon niet worden opgeslagen.')
  }
}

/**
 * De melding van de server gaat vóór de melding hier: die is geschreven voor de
 * gebruiker ("dit is de laatste actieve beheerder") en zegt meer dan een
 * algemeen "mislukt".
 */
async function rpc<T>(method: string, args: unknown[], fallback: string): Promise<T> {
  const response = await fetch('/api/rpc', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ resource: 'auth', method, args }),
  })

  const body = (await response.json().catch(() => ({}))) as { data?: T; error?: string }
  if (!response.ok) throw new Error(body.error ?? fallback)

  return body.data as T
}
