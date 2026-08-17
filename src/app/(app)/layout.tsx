'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { BottomNavigation } from '@/components/layout/BottomNavigation'
import { SyncStatusBar } from '@/components/layout/SyncStatusBar'
import { AccessDenied } from '@/components/auth/RequireRole'
import { getRequiredPermission, hasPermission } from '@/lib/permissions'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile, isAuthenticated, isLoading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login')
    }
  }, [isAuthenticated, isLoading, router])

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">Laden…</p>
      </div>
    )
  }

  if (!isAuthenticated || !profile) return null

  // Autorisatie op het pad zelf: het verbergen van navigatie is niet genoeg.
  const requiredPermission = getRequiredPermission(pathname)
  const isAllowed =
    requiredPermission === null || hasPermission(profile.roles, requiredPermission)

  return (
    <div className="flex min-h-screen flex-col">
      {/* pb-28 houdt ruimte vrij voor de vaste voet (statusbalk + navigatie).
          Op papier is die voet er niet, en dan is die ruimte een lege strook
          onderaan elk vel. */}
      <main className="flex-1 pb-28 print:pb-0">{isAllowed ? children : <AccessDenied />}</main>

      {/* Navigatie en synchronisatiestand horen bij het scherm. Op een geprinte
          vullijst staan ze in de weg, en op de laatste pagina drukken ze de
          inhoud zelfs naar een extra vel. */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-gray-200 bg-white print:hidden">
        <SyncStatusBar />
        <BottomNavigation />
      </div>
    </div>
  )
}
