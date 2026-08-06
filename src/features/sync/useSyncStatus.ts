'use client'

import { useState, useEffect, useCallback } from 'react'
import { SyncStatus } from '@/types'
import { getPendingOutboxEntries } from '@/lib/db/offlineDb'

interface SyncState {
  status: SyncStatus
  pendingCount: number
  lastSyncedAt: string | null
  error: string | null
}

export function useSyncStatus() {
  const [state, setState] = useState<SyncState>({
    status: SyncStatus.SYNCED,
    pendingCount: 0,
    lastSyncedAt: null,
    error: null,
  })

  const checkPending = useCallback(async () => {
    const entries = await getPendingOutboxEntries()
    setState((prev) => ({
      ...prev,
      pendingCount: entries.length,
      status: entries.length > 0 ? SyncStatus.LOCAL : SyncStatus.SYNCED,
    }))
  }, [])

  useEffect(() => {
    checkPending()
    const interval = setInterval(checkPending, 10_000)
    return () => clearInterval(interval)
  }, [checkPending])

  return { ...state, refresh: checkPending }
}
