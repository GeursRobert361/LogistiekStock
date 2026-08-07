import type { Profile } from '@/types'

export interface LoginCredentials {
  email: string
  password: string
}

export interface AuthSession {
  profile: Profile
  accessToken?: string
}

export interface IAuthRepository {
  login(credentials: LoginCredentials): Promise<AuthSession>
  logout(): Promise<void>
  getCurrentSession(): Promise<AuthSession | null>
  getCurrentProfile(): Promise<Profile | null>
  /**
   * Meldt wijzigingen in de aanmeldstatus: inloggen, uitloggen, een vernieuwd
   * token of een verlopen sessie. Geeft een opzegfunctie terug.
   *
   * Optioneel: in demo-modus verandert de sessie niet buiten de app om.
   */
  onAuthStateChange?(handler: (profile: Profile | null) => void): () => void
}
