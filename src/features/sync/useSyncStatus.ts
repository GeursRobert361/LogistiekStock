'use client'

import { useEffect, useState } from 'react'
import { syncService, type SyncSnapshot } from '@/services/syncService'

export interface SyncStatusView extends SyncSnapshot {
  /** Wat de browser denkt. Zegt niets over of de server echt bereikbaar is. */
  isBrowserOnline: boolean
  /** Alles is weggeschreven én er staat niets meer klaar. */
  isEverythingSaved: boolean
  /** Seconden tot de volgende poging, of null wanneer er niets wacht. */
  secondsUntilRetry: number | null
}

export function useSyncStatus(): SyncStatusView {
  const [snapshot, setSnapshot] = useState<SyncSnapshot>(() => syncService.getSnapshot())
  const [isBrowserOnline, setIsBrowserOnline] = useState(true)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => syncService.subscribe(setSnapshot), [])

  useEffect(() => {
    setIsBrowserOnline(navigator.onLine)
    const onOnline = () => setIsBrowserOnline(true)
    const onOffline = () => setIsBrowserOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  // Alleen tikken zolang er iets te tellen valt; anders draait er een timer
  // voor niets terwijl de teller aan het werk is.
  const hasPending = snapshot.pendingCount > 0
  useEffect(() => {
    if (!hasPending) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [hasPending])

  const secondsUntilRetry =
    snapshot.nextRetryAt && hasPending
      ? Math.max(0, Math.ceil((new Date(snapshot.nextRetryAt).getTime() - now) / 1000))
      : null

  return {
    ...snapshot,
    isBrowserOnline,
    isEverythingSaved: snapshot.pendingCount === 0 && snapshot.rejectedCount === 0,
    secondsUntilRetry,
  }
}
