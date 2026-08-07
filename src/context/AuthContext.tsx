'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
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
  hasAnyRole: (roles: UserRole[]) => boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  /** Gezet wanneer de sessie buiten de app om is verlopen. */
  sessionExpired: boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [sessionExpired, setSessionExpired] = useState(false)
  // Ref zodat de repository-singleton niet per render wisselt.
  const authRepo = useRef(repositories.auth())
  const wasAuthenticated = useRef(false)

  useEffect(() => {
    let cancelled = false

    authRepo.current
      .getCurrentProfile()
      .then((currentProfile) => {
        if (cancelled) return
        setProfile(currentProfile)
        wasAuthenticated.current = currentProfile !== null
      })
      .catch((error: unknown) => {
        console.error('[auth] Huidige sessie ophalen mislukt.', error)
        if (!cancelled) setProfile(null)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    // In productie stuurt Supabase hier ook token-refreshes en verlopen
    // sessies doorheen, zodat de app niet blijft hangen op oude gegevens.
    const unsubscribe = authRepo.current.onAuthStateChange?.((nextProfile) => {
      if (cancelled) return
      if (nextProfile === null && wasAuthenticated.current) {
        setSessionExpired(true)
      }
      wasAuthenticated.current = nextProfile !== null
      setProfile(nextProfile)
      setIsLoading(false)
    })

    return () => {
      cancelled = true
      unsubscribe?.()
    }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const session = await authRepo.current.login({ email, password })
    wasAuthenticated.current = true
    setSessionExpired(false)
    setProfile(session.profile)
  }, [])

  const logout = useCallback(async () => {
    await authRepo.current.logout()
    wasAuthenticated.current = false
    setSessionExpired(false)
    setProfile(null)
  }, [])

  const hasRole = useCallback(
    (role: UserRole) => profile?.roles.includes(role) ?? false,
    [profile]
  )

  const hasAnyRole = useCallback(
    (roles: UserRole[]) => roles.some((role) => profile?.roles.includes(role) ?? false),
    [profile]
  )

  const value = useMemo(
    () => ({
      profile,
      isLoading,
      isAuthenticated: profile !== null,
      hasRole,
      hasAnyRole,
      login,
      logout,
      sessionExpired,
    }),
    [profile, isLoading, hasRole, hasAnyRole, login, logout, sessionExpired]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth moet binnen AuthProvider worden gebruikt')
  return ctx
}
