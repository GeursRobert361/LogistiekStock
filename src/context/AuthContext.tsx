'use client'

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from 'react'
import type { Profile } from '@/types'
import { UserRole } from '@/types'
import { repositories } from '@/repositories'

interface AuthContextValue {
  profile: Profile | null
  isLoading: boolean
  isAuthenticated: boolean
  hasRole: (role: UserRole) => boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  // Use a ref so the repo singleton doesn't change between renders
  const authRepoRef = useRef(repositories.auth())

  useEffect(() => {
    authRepoRef.current.getCurrentProfile().then((p) => {
      setProfile(p)
      setIsLoading(false)
    })
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const session = await authRepoRef.current.login({ email, password })
    setProfile(session.profile)
  }, [])

  const logout = useCallback(async () => {
    await authRepoRef.current.logout()
    setProfile(null)
  }, [])

  const hasRole = useCallback(
    (role: UserRole) => profile?.roles.includes(role) ?? false,
    [profile]
  )

  return (
    <AuthContext.Provider
      value={{
        profile,
        isLoading,
        isAuthenticated: profile !== null,
        hasRole,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth moet binnen AuthProvider worden gebruikt')
  return ctx
}
