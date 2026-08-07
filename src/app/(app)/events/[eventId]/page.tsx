'use client'

import { use, useCallback, useEffect, useState } from 'react'
import { kioskTitle } from '@/lib/kiosk'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AppHeader } from '@/components/layout/AppHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/Dialog'
import { EventStatusBadge } from '@/components/shared/EventStatusBadge'
import { EmptyState } from '@/components/shared/EmptyState'
import { repositories } from '@/repositories'
import { useAuth } from '@/context/AuthContext'
import { loadSessionsForEvent } from '@/services/countingService'
import {
  getSessionOverview,
  getNextOpenKioskId,
  isResumable,
  type SessionOverview,
} from '@/services/countSessionService'
import { UserRole } from '@/types'
import type { Event, Kiosk } from '@/types'
import { formatDate } from '@/lib/utils'

export default function EventDetailPage({
  params,
}: {
  params: Promise<{ eventId: string }>
}) {
  const { eventId } = use(params)
  const { hasRole } = useAuth()
  const router = useRouter()
  const [event, setEvent] = useState<Event | null>(null)
  const [resumable, setResumable] = useState<SessionOverview[]>([])
  const [kiosks, setKiosks] = useState<Map<string, Kiosk>>(new Map())
  const [previousEvent, setPreviousEvent] = useState<Event | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canCount = hasRole(UserRole.TELLER) || hasRole(UserRole.PLANNER) || hasRole(UserRole.ADMIN)
  const canReview = hasRole(UserRole.PLANNER) || hasRole(UserRole.ADMIN)
  const canManage = canReview

  const load = useCallback(async () => {
    const [eventData, sessions, kioskList, events] = await Promise.all([
      repositories.event().getEventById(eventId),
      loadSessionsForEvent(eventId),
      repositories.kiosk().getKiosks(),
      repositories.event().getEvents(),
    ])
    setEvent(eventData)
    setKiosks(new Map(kioskList.map((k) => [k.id, k])))
    setPreviousEvent(
      eventData?.previousEventId
        ? (events.find((candidate) => candidate.id === eventData.previousEventId) ?? null)
        : null
    )

    const overviews = await Promise.all(sessions.filter(isResumable).map(getSessionOverview))
    setResumable(overviews.filter((o) => !o.isFullyHandled))
    setIsLoading(false)
  }, [eventId])

  useEffect(() => {
    load().catch((loadError: unknown) => {
      console.error('[evenement] Laden mislukt.', loadError)
      setIsLoading(false)
    })
  }, [load])

  async function handleDelete() {
    setShowDeleteDialog(false)
    try {
      await repositories.event().deleteEvent(eventId)
      router.push('/events')
    } catch (deleteError) {
      console.error('[evenement] Verwijderen mislukt.', deleteError)
      setError('Het evenement kon niet worden verwijderd.')
    }
  }

  if (isLoading) {
    return (
      <>
        <AppHeader title="Evenement" backHref="/events" />
        <div className="p-4 text-center text-gray-500">Laden…</div>
      </>
    )
  }

  if (!event) {
    return (
      <>
        <AppHeader title="Evenement" backHref="/events" />
        <div className="p-4">
          <EmptyState title="Evenement niet gevonden" icon="❌" />
        </div>
      </>
    )
  }

  return (
    <>
      <AppHeader title={event.name} backHref="/events" />
      <div className="space-y-4 p-4">
        <Card>
          <CardContent className="py-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Datum</p>
                <p className="font-semibold text-gray-900">{formatDate(event.date)}</p>
              </div>
              <EventStatusBadge status={event.status} />
            </div>
            {previousEvent && (
              <p className="mt-2 border-t border-gray-100 pt-2 text-sm text-gray-600">
                Vorig evenement:{' '}
                <Link
                  href={`/events/${previousEvent.id}`}
                  className="font-medium text-arena-red underline"
                >
                  {previousEvent.name}
                </Link>{' '}
                ({formatDate(previousEvent.date)})
              </p>
            )}
          </CardContent>
        </Card>

        {/* Openstaande telrondes hervatten */}
        {resumable.map((overview) => {
          const nextKioskId = getNextOpenKioskId(overview)
          const nextKiosk = nextKioskId ? kiosks.get(nextKioskId) : null
          return (
            <Card key={overview.session.id} className="border-arena-red">
              <CardContent className="py-3">
                <p className="text-sm font-semibold text-gray-900">Telronde loopt nog</p>
                <p className="mb-3 text-sm text-gray-600">
                  {overview.completedCount + overview.skippedCount} van {overview.totalCount}{' '}
                  kiosken gedaan
                </p>
                {nextKioskId && (
                  <Link
                    href={`/events/${eventId}/count/${overview.session.id}/kiosk/${nextKioskId}`}
                    className="block"
                  >
                    <Button className="w-full" size="lg">
                      Verder met telling — {kioskTitle(nextKiosk)}
                    </Button>
                  </Link>
                )}
              </CardContent>
            </Card>
          )
        })}

        <div className="space-y-2">
          {canCount && (
            <Link href={`/events/${eventId}/count/start`} className="block">
              <Button className="w-full" size="lg" variant={resumable.length > 0 ? 'secondary' : 'primary'}>
                Nieuwe telronde starten
              </Button>
            </Link>
          )}

          {canReview && (
            <>
              <Link href={`/events/${eventId}/count/review`} className="block">
                <Button variant="secondary" className="w-full" size="lg">
                  Tellingen controleren
                </Button>
              </Link>

              <Link href={`/events/${eventId}/restock`} className="block">
                <Button variant="secondary" className="w-full" size="lg">
                  Vulplanning
                </Button>
              </Link>

              <Link href={`/data?event=${eventId}`} className="block">
                <Button variant="secondary" className="w-full" size="lg">
                  Verbruik
                </Button>
              </Link>
            </>
          )}
        </div>

        {event.notes && (
          <Card>
            <CardHeader>
              <CardTitle>Notities</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-700">{event.notes}</p>
            </CardContent>
          </Card>
        )}

        {error && (
          <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
            {error}
          </p>
        )}

        {canManage && (
          <div className="border-t border-gray-200 pt-3">
            <Button
              variant="outline"
              size="md"
              className="w-full border-red-300 text-red-700"
              onClick={() => setShowDeleteDialog(true)}
            >
              Evenement verwijderen
            </Button>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={() => void handleDelete()}
        isDestructive
        title={`${event.name} verwijderen`}
        message={
          'Alles wat aan dit evenement hangt gaat mee: de telrondes met hun telregels, de ' +
          'bijvullijst en de vulrondes. Dit kan niet ongedaan worden gemaakt.'
        }
        confirmLabel="Verwijderen"
        cancelLabel="Terug"
      />
    </>
  )
}
