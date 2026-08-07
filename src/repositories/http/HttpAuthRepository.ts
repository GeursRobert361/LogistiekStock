import type { IAuthRepository, LoginCredentials, AuthSession } from '../interfaces/IAuthRepository'
import type { Profile } from '@/types'

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
    const response = await fetch('/api/rpc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ resource: 'auth', method: 'listProfiles', args: [] }),
    })
    if (!response.ok) throw new Error('Gebruikers ophalen is mislukt.')

    const body = (await response.json()) as { data: Profile[] }
    return body.data
  }
}
