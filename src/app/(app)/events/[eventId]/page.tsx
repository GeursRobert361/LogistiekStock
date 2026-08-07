'use client'

import { use, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { AppHeader } from '@/components/layout/AppHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
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
  const [event, setEvent] = useState<Event | null>(null)
  const [resumable, setResumable] = useState<SessionOverview[]>([])
  const [kiosks, setKiosks] = useState<Map<string, Kiosk>>(new Map())
  const [isLoading, setIsLoading] = useState(true)

  const canCount = hasRole(UserRole.TELLER) || hasRole(UserRole.PLANNER) || hasRole(UserRole.ADMIN)
  const canReview = hasRole(UserRole.PLANNER) || hasRole(UserRole.ADMIN)

  const load = useCallback(async () => {
    const [eventData, sessions, kioskList] = await Promise.all([
      repositories.event().getEventById(eventId),
      loadSessionsForEvent(eventId),
      repositories.kiosk().getKiosks(),
    ])
    setEvent(eventData)
    setKiosks(new Map(kioskList.map((k) => [k.id, k])))

    const overviews = await Promise.all(sessions.filter(isResumable).map(getSessionOverview))
    setResumable(overviews.filter((o) => !o.isFullyHandled))
    setIsLoading(false)
  }, [eventId])

  useEffect(() => {
    load().catch((error: unknown) => {
      console.error('[evenement] Laden mislukt.', error)
      setIsLoading(false)
    })
  }, [load])

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
          <CardContent className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm text-gray-600">Datum</p>
              <p className="font-semibold text-gray-900">{formatDate(event.date)}</p>
            </div>
            <EventStatusBadge status={event.status} />
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
                      Verder met telling — kiosk {nextKiosk?.number ?? ''}
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
                📋 Nieuwe telronde starten
              </Button>
            </Link>
          )}

          {canReview && (
            <>
              <Link href={`/events/${eventId}/count/review`} className="block">
                <Button variant="secondary" className="w-full" size="lg">
                  🔍 Tellingen controleren
                </Button>
              </Link>

              <Link href={`/events/${eventId}/restock`} className="block">
                <Button variant="secondary" className="w-full" size="lg">
                  📦 Vulplanning
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
      </div>
    </>
  )
}
