'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { BottomNavigation } from '@/components/layout/BottomNavigation'
import { OfflineStatus } from '@/components/layout/OfflineStatus'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()
  const router = useRouter()

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

  if (!isAuthenticated) return null

  return (
    <div className="flex min-h-screen flex-col">
      <OfflineStatus />
      <main className="flex-1 overflow-y-auto pb-20">{children}</main>
      <BottomNavigation />
    </div>
  )
}
