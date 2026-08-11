import type { Profile, UserRole } from '@/types'

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
  /** Alle gebruikers — voor het beheerscherm. */
  listProfiles(): Promise<Profile[]>

  /**
   * Gebruikersbeheer. Alleen voor beheerders; de rechten worden op de server
   * gecontroleerd, niet hier.
   *
   * Verwijderen ontbreekt met opzet: tellingen, evenementen en vulrondes
   * verwijzen naar een profiel zonder cascade, dus een gebruiker die ooit
   * gewerkt heeft is niet weg te halen zonder zijn werk mee te nemen.
   * Deactiveren blokkeert inloggen en laat de geschiedenis staan.
   */
  createProfile(input: {
    email: string
    displayName: string
    password: string
    roles: UserRole[]
  }): Promise<Profile>
  updateProfile(
    id: string,
    input: { email?: string; displayName?: string; roles?: UserRole[] }
  ): Promise<Profile>
  setPassword(id: string, password: string): Promise<void>
  setActive(id: string, isActive: boolean): Promise<Profile>
  /**
   * Meldt wijzigingen in de aanmeldstatus: inloggen, uitloggen, een vernieuwd
   * token of een verlopen sessie. Geeft een opzegfunctie terug.
   *
   * Optioneel: in demo-modus verandert de sessie niet buiten de app om.
   */
  onAuthStateChange?(handler: (profile: Profile | null) => void): () => void
}
