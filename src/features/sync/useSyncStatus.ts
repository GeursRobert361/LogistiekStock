'use client'

import { useEffect, useState } from 'react'
import { syncService, type SyncSnapshot } from '@/services/syncService'

export interface SyncStatusView extends SyncSnapshot {
  /** Wat de browser denkt. Zegt niets over of de server echt bereikbaar is. */
  isBrowserOnline: boolean
  /** Alles is weggeschreven én er staat niets meer klaar. */
  isEverythingSaved: boolean
}

export function useSyncStatus(): SyncStatusView {
  const [snapshot, setSnapshot] = useState<SyncSnapshot>(() => syncService.getSnapshot())
  const [isBrowserOnline, setIsBrowserOnline] = useState(true)

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

  return {
    ...snapshot,
    isBrowserOnline,
    isEverythingSaved: snapshot.pendingCount === 0 && snapshot.failedCount === 0,
  }
}
