import type { IAuthRepository, LoginCredentials, AuthSession } from '../interfaces/IAuthRepository'
import type { Profile } from '@/types'
import { UserRole } from '@/types'
import { getSupabaseClient } from '@/lib/supabase/client'
import { mapProfile } from './mappers'
import { unwrapList, unwrapMaybe } from './supabaseHelpers'

/**
 * Echte authenticatie via Supabase Auth.
 * Wachtwoorden staan nooit in de app — dat is uitsluitend demo-gedrag.
 */
export class SupabaseAuthRepository implements IAuthRepository {
  async login({ email, password }: LoginCredentials): Promise<AuthSession> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      // Supabase-meldingen zijn Engels; toon een Nederlandse melding.
      if (error.message.toLowerCase().includes('invalid login credentials')) {
        throw new Error('Ongeldig e-mailadres of wachtwoord')
      }
      throw new Error(error.message)
    }
    if (!data.user) {
      throw new Error('Inloggen is mislukt: geen gebruiker ontvangen.')
    }

    const profile = await this.loadProfile(data.user.id)
    if (!profile) {
      throw new Error('Er is geen profiel gekoppeld aan dit account.')
    }
    if (!profile.isActive) {
      await supabase.auth.signOut()
      throw new Error('Dit account is gedeactiveerd.')
    }

    return { profile, accessToken: data.session?.access_token }
  }

  async logout(): Promise<void> {
    const { error } = await getSupabaseClient().auth.signOut()
    if (error) throw new Error(error.message)
  }

  async getCurrentSession(): Promise<AuthSession | null> {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase.auth.getSession()
    if (error) throw new Error(error.message)
    if (!data.session) return null

    const profile = await this.loadProfile(data.session.user.id)
    if (!profile) return null

    return { profile, accessToken: data.session.access_token }
  }

  async getCurrentProfile(): Promise<Profile | null> {
    const session = await this.getCurrentSession()
    return session?.profile ?? null
  }

  /**
   * Roept `handler` aan bij elke wijziging van de auth-status
   * (login, logout, verlopen sessie, token-refresh).
   */
  onAuthStateChange(handler: (profile: Profile | null) => void): () => void {
    const supabase = getSupabaseClient()
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        handler(null)
        return
      }
      this.loadProfile(session.user.id)
        .then(handler)
        .catch((error: unknown) => {
          console.error('[auth] Profiel laden na statuswijziging mislukt.', error)
          handler(null)
        })
    })
    return () => data.subscription.unsubscribe()
  }

  private async loadProfile(userId: string): Promise<Profile | null> {
    const supabase = getSupabaseClient()

    const profileRow = unwrapMaybe(
      await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
    )
    if (!profileRow) return null

    const roleRows = unwrapList(
      await supabase.from('user_roles').select('role').eq('profile_id', userId)
    )
    const roles = roleRows
      .map((row) => (row as { role: string }).role as UserRole)
      .filter((role): role is UserRole => Object.values(UserRole).includes(role))

    return mapProfile(profileRow as Record<string, unknown>, roles)
  }
}
