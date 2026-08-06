import type { IAuthRepository, LoginCredentials, AuthSession } from '../interfaces/IAuthRepository'
import type { Profile } from '@/types'
import { demoProfiles, DEMO_PASSWORDS } from '@/lib/seed/demoData'

const SESSION_KEY = 'demo_session'

export class DemoAuthRepository implements IAuthRepository {
  async login(credentials: LoginCredentials): Promise<AuthSession> {
    const { email, password } = credentials
    const expectedPassword = DEMO_PASSWORDS[email]
    if (!expectedPassword || expectedPassword !== password) {
      throw new Error('Ongeldig e-mailadres of wachtwoord')
    }
    const profile = demoProfiles.find((p) => p.email === email)
    if (!profile) {
      throw new Error('Gebruiker niet gevonden')
    }
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
}
