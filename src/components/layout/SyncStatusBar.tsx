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
 * De toon is bewust geruststellend zolang er niets verloren is. Alles wat je
 * invoert staat direct op dit apparaat; deze balk gaat alleen over de reis
 * naar de server. "Niet opgeslagen" zou tijdens het tellen onnodig laten
 * schrikken, want dat is het niet.
 *
 * Bewust niet alleen op `navigator.onLine`: die staat ook op "online" wanneer
 * er wél wifi is maar de server onbereikbaar is.
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
    rejectedCount,
    conflictCount,
    isServerReachable,
    isBrowserOnline,
    secondsUntilRetry,
  } = status

  const changes = (count: number) => `${count} wijziging${count === 1 ? '' : 'en'}`

  let tone: 'ok' | 'busy' | 'waiting' | 'error'
  let icon: string
  let text: string

  if (conflictCount > 0) {
    tone = 'error'
    icon = '⚠'
    text = `${conflictCount} telling${conflictCount === 1 ? '' : 'en'} wijkt af van de server`
  } else if (rejectedCount > 0) {
    tone = 'error'
    icon = '⚠'
    text = `${changes(rejectedCount)} geweigerd door de server`
  } else if (pendingCount === 0) {
    tone = 'ok'
    icon = '✓'
    text = 'Alles opgeslagen'
  } else if (!isBrowserOnline || !isServerReachable) {
    // Bewaard op dit apparaat; de app blijft vanzelf opnieuw proberen.
    tone = 'waiting'
    icon = '●'
    text =
      secondsUntilRetry !== null && secondsUntilRetry > 0
        ? `${changes(pendingCount)} bewaard — opnieuw over ${secondsUntilRetry}s`
        : `${changes(pendingCount)} bewaard — opnieuw proberen…`
  } else {
    tone = 'busy'
    icon = '↻'
    text = `${changes(pendingCount)} synchroniseren`
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'flex items-center justify-center gap-1.5 px-4 py-1 text-xs font-medium',
        tone === 'ok' && 'bg-concrete-light text-ink-muted',
        tone === 'busy' && 'bg-blue-50 text-blue-900',
        tone === 'waiting' && 'bg-amber-50 text-amber-900',
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

      {/* Alleen aanbieden wanneer wachten niet vanzelf helpt. */}
      {conflictCount === 0 && rejectedCount > 0 && (
        <button
          type="button"
          onClick={() => void syncService.retryNow()}
          className="ml-2 underline underline-offset-2"
        >
          Opnieuw proberen
        </button>
      )}
    </div>
  )
}
