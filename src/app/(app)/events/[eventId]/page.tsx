'use client'

import { useEffect, useState } from 'react'
import { use } from 'react'
import Link from 'next/link'
import { AppHeader } from '@/components/layout/AppHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { EventStatusBadge } from '@/components/shared/EventStatusBadge'
import { EmptyState } from '@/components/shared/EmptyState'
import { repositories } from '@/repositories'
import type { Event } from '@/types'
import { formatDate } from '@/lib/utils'

export default function EventDetailPage({
  params,
}: {
  params: Promise<{ eventId: string }>
}) {
  const { eventId } = use(params)
  const [event, setEvent] = useState<Event | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    repositories.event().getEventById(eventId).then((data) => {
      setEvent(data)
      setIsLoading(false)
    })
  }, [eventId])

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
        {/* Status + datum */}
        <Card>
          <CardContent className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm text-gray-500">Datum</p>
              <p className="font-semibold text-gray-900">{formatDate(event.date)}</p>
            </div>
            <EventStatusBadge status={event.status} />
          </CardContent>
        </Card>

        {/* Acties */}
        <div className="space-y-2">
          <Link href={`/events/${eventId}/count/start`} className="block">
            <Button className="w-full" size="lg">
              📋 Telronde starten
            </Button>
          </Link>

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
