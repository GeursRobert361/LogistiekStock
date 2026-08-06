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
}
