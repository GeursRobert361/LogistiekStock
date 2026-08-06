'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AppHeader } from '@/components/layout/AppHeader'
import { Card, CardContent } from '@/components/ui/Card'
import { EventStatusBadge } from '@/components/shared/EventStatusBadge'
import { EmptyState } from '@/components/shared/EmptyState'
import { ListSkeleton } from '@/components/shared/LoadingSkeleton'
import { repositories } from '@/repositories'
import type { Event } from '@/types'
import { formatDate } from '@/lib/utils'

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    repositories.event().getEvents().then((data) => {
      setEvents(data)
      setIsLoading(false)
    })
  }, [])

  return (
    <>
      <AppHeader title="Evenementen" />
      <div className="p-4">
        {isLoading ? (
          <ListSkeleton count={3} />
        ) : events.length === 0 ? (
          <EmptyState
            title="Geen evenementen"
            description="Er zijn nog geen evenementen aangemaakt."
            icon="📅"
          />
        ) : (
          <div className="space-y-2">
            {events.map((event) => (
              <Link key={event.id} href={`/events/${event.id}`} className="block">
                <Card className="transition-colors hover:bg-gray-50 active:bg-gray-100">
                  <CardContent className="flex items-center justify-between py-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-gray-900">{event.name}</p>
                      <p className="mt-0.5 text-sm text-gray-500">{formatDate(event.date)}</p>
                    </div>
                    <EventStatusBadge status={event.status} />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
