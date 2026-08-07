'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AppHeader } from '@/components/layout/AppHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/Dialog'
import { clearDemoStorage } from '@/lib/demo/demoStore'
import { getOfflineDb } from '@/lib/db/offlineDb'
import { clearServiceWorkerCaches } from '@/components/layout/ServiceWorkerRegistrar'
import { isDemoMode } from '@/lib/appMode'

export default function AdminSettingsPage() {
  const router = useRouter()
  const [showResetDialog, setShowResetDialog] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const demoMode = isDemoMode()

  /**
   * Zet de demo terug naar de begintoestand. Wist zowel de gesimuleerde server
   * (localStorage) als de offline-cache van dit apparaat (IndexedDB).
   */
  async function handleReset() {
    setShowResetDialog(false)
    setIsResetting(true)
    setError(null)
    try {
      const db = getOfflineDb()
      await Promise.all([
        db.countSessions.clear(),
        db.kioskCounts.clear(),
        db.countEntries.clear(),
        db.outbox.clear(),
        db.conflicts.clear(),
      ])
      clearDemoStorage()
      clearServiceWorkerCaches()
      router.push('/dashboard')
      router.refresh()
    } catch (resetError) {
      console.error('[instellingen] Demo resetten mislukt.', resetError)
      setError('De demo kon niet worden teruggezet.')
    } finally {
      setIsResetting(false)
    }
  }

  return (
    <>
      <AppHeader title="Instellingen" backHref="/dashboard" />
      <div className="space-y-4 p-4">
        <Card>
          <CardHeader>
            <CardTitle>App-modus</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <p className="text-sm text-gray-800">
              Modus: <strong>{demoMode ? 'Demo' : 'Productie (eigen server)'}</strong>
            </p>
            <p className="text-xs text-gray-600">
              {demoMode
                ? 'Gegevens staan op dit apparaat, niet op een server. Ingesteld via ' +
                  'NEXT_PUBLIC_APP_MODE.'
                : 'Gegevens staan in de database op onze eigen server.'}
            </p>
          </CardContent>
        </Card>

        {demoMode && (
          <Card>
            <CardHeader>
              <CardTitle>Demo terugzetten</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-gray-700">
                Wist alle telrondes, bijvullijsten, vulrondes en storingen op dit apparaat, en
                zet producten, kiosken en normen terug naar de begintoestand.
              </p>
              {error && (
                <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
                  {error}
                </p>
              )}
              <Button
                variant="destructive"
                size="md"
                className="w-full"
                disabled={isResetting}
                onClick={() => setShowResetDialog(true)}
              >
                {isResetting ? 'Bezig…' : 'Demo terugzetten'}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      <ConfirmDialog
        open={showResetDialog}
        onClose={() => setShowResetDialog(false)}
        onConfirm={() => void handleReset()}
        isDestructive
        title="Demo terugzetten"
        message="Alle ingevoerde tellingen en vulrondes op dit apparaat gaan verloren. Doorgaan?"
        confirmLabel="Terugzetten"
      />
    </>
  )
}
