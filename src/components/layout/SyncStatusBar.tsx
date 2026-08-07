'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { useAuth } from '@/context/AuthContext'
import { useSyncStatus } from '@/features/sync/useSyncStatus'
import { registerSyncHandlers } from '@/services/syncHandlers'
import { syncService } from '@/services/syncService'
import { PERMISSIONS } from '@/lib/permissions'

/**
 * Permanente synchronisatiestatus.
 *
 * Bewust niet alleen op `navigator.onLine`: die staat ook op "online" wanneer
 * er wél wifi is maar de server onbereikbaar is. Doorslaggevend is of de
 * laatste schrijfpoging slaagde.
 */
export function SyncStatusBar() {
  const status = useSyncStatus()
  const { hasAnyRole } = useAuth()
  const canResolveConflicts = hasAnyRole([...PERMISSIONS.REVIEW_COUNTS])

  useEffect(() => {
    registerSyncHandlers()
    void syncService.flush()
  }, [])

  const {
    pendingCount,
    failedCount,
    conflictCount,
    isServerReachable,
    isBrowserOnline,
    isEverythingSaved,
  } = status

  let tone: 'ok' | 'busy' | 'offline' | 'error'
  let icon: string
  let text: string

  if (conflictCount > 0) {
    tone = 'error'
    icon = '⚠'
    text = `${conflictCount} telling${conflictCount === 1 ? '' : 'en'} wijkt af van de server`
  } else if (failedCount > 0) {
    tone = 'error'
    icon = '⚠'
    text = `Synchronisatiefout — ${failedCount} wijziging${failedCount === 1 ? '' : 'en'} niet opgeslagen`
  } else if (!isBrowserOnline || !isServerReachable) {
    tone = 'offline'
    icon = '●'
    text =
      pendingCount > 0
        ? `Offline — ${pendingCount} wijziging${pendingCount === 1 ? '' : 'en'} lokaal bewaard`
        : 'Offline — wijzigingen worden lokaal bewaard'
  } else if (pendingCount > 0) {
    tone = 'busy'
    icon = '↻'
    text = `${pendingCount} wijziging${pendingCount === 1 ? '' : 'en'} synchroniseren`
  } else {
    tone = 'ok'
    icon = '✓'
    text = 'Alles opgeslagen'
  }

  // In rust neemt de balk geen aandacht weg, maar blijft hij wel leesbaar.
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'flex items-center justify-center gap-1.5 px-4 py-1 text-xs font-medium',
        tone === 'ok' && 'bg-gray-50 text-gray-500',
        tone === 'busy' && 'bg-blue-50 text-blue-800',
        tone === 'offline' && 'bg-gray-800 text-white',
        tone === 'error' && 'bg-red-100 text-red-900'
      )}
    >
      <span aria-hidden="true">{icon}</span>
      <span>{text}</span>
      {conflictCount > 0 && canResolveConflicts && (
        <Link href="/conflicts" className="ml-2 underline underline-offset-2">
          Oplossen
        </Link>
      )}
      {conflictCount === 0 && (tone === 'error' || (tone === 'offline' && pendingCount > 0)) && (
        <button
          type="button"
          onClick={() => void syncService.flush()}
          className="ml-2 underline underline-offset-2"
        >
          Opnieuw proberen
        </button>
      )}
      {isEverythingSaved && <span className="sr-only">Er staan geen wijzigingen open.</span>}
    </div>
  )
}
