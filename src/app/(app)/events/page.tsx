'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AppHeader } from '@/components/layout/AppHeader'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { EventStatusBadge } from '@/components/shared/EventStatusBadge'
import { EmptyState } from '@/components/shared/EmptyState'
import { ListSkeleton } from '@/components/shared/LoadingSkeleton'
import { repositories } from '@/repositories'
import { useAuth } from '@/context/AuthContext'
import { PERMISSIONS } from '@/lib/permissions'
import type { Event } from '@/types'
import { formatDate } from '@/lib/utils'

export default function EventsPage() {
  const { hasAnyRole } = useAuth()
  const [events, setEvents] = useState<Event[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const canManage = hasAnyRole([...PERMISSIONS.MANAGE_EVENTS])

  useEffect(() => {
    repositories
      .event()
      .getEvents()
      .then((data) => {
        setEvents(data)
        setIsLoading(false)
      })
      .catch((error: unknown) => {
        console.error('[evenementen] Laden mislukt.', error)
        setIsLoading(false)
      })
  }, [])

  return (
    <>
      <AppHeader
        title="Evenementen"
        actions={
          canManage ? (
            <Link href="/events/new">
              <Button size="sm">+ Nieuw</Button>
            </Link>
          ) : undefined
        }
      />
      <div className="p-4">
        {isLoading ? (
          <ListSkeleton count={3} />
        ) : events.length === 0 ? (
          <EmptyState
            title="Geen evenementen"
            description="Er zijn nog geen evenementen aangemaakt."
            icon="📅"
            action={
              canManage ? (
                <Link href="/events/new">
                  <Button variant="outline">Evenement aanmaken</Button>
                </Link>
              ) : undefined
            }
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
