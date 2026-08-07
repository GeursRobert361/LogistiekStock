'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/Button'
import { PERMISSIONS, type Permission } from '@/lib/permissions'
import type { UserRole } from '@/types'

interface RequireAnyRoleProps {
  roles: readonly UserRole[]
  children: ReactNode
  /** Wat er in plaats van de inhoud wordt getoond. Standaard een toegangsmelding. */
  fallback?: ReactNode
}

/** Toont de inhoud alleen wanneer de gebruiker een van deze rollen heeft. */
export function RequireAnyRole({ roles, children, fallback }: RequireAnyRoleProps) {
  const { profile } = useAuth()
  const allowed = profile !== null && roles.some((role) => profile.roles.includes(role))

  if (!allowed) return <>{fallback ?? <AccessDenied />}</>
  return <>{children}</>
}

interface RequireRoleProps {
  role: UserRole
  children: ReactNode
  fallback?: ReactNode
}

export function RequireRole({ role, children, fallback }: RequireRoleProps) {
  return (
    <RequireAnyRole roles={[role]} fallback={fallback}>
      {children}
    </RequireAnyRole>
  )
}

interface RequirePermissionProps {
  permission: Permission
  children: ReactNode
  fallback?: ReactNode
}

export function RequirePermission({ permission, children, fallback }: RequirePermissionProps) {
  return (
    <RequireAnyRole roles={PERMISSIONS[permission]} fallback={fallback}>
      {children}
    </RequireAnyRole>
  )
}

export function AccessDenied() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 p-6 text-center">
      <span className="text-4xl" aria-hidden="true">
        🔒
      </span>
      <h1 className="text-lg font-bold text-gray-900">Geen toegang</h1>
      <p className="max-w-xs text-sm text-gray-600">
        Je hebt niet de juiste rol voor dit onderdeel. Vraag een beheerder om toegang.
      </p>
      <Link href="/dashboard">
        <Button variant="outline">Terug naar dashboard</Button>
      </Link>
    </div>
  )
}
