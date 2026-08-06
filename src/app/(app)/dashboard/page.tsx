'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AppHeader } from '@/components/layout/AppHeader'
import { Card, CardContent } from '@/components/ui/Card'
import { EventStatusBadge } from '@/components/shared/EventStatusBadge'
import { ListSkeleton } from '@/components/shared/LoadingSkeleton'
import { EmptyState } from '@/components/shared/EmptyState'
import { useAuth } from '@/context/AuthContext'
import { repositories } from '@/repositories'
import type { Event } from '@/types'
import { formatDate } from '@/lib/utils'

export default function DashboardPage() {
  const { profile } = useAuth()
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
      <AppHeader />
      <div className="space-y-4 p-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">
            Hallo, {profile?.displayName?.split(' ')[0]} 👋
          </h2>
          <p className="text-sm text-gray-500">
            {new Intl.DateTimeFormat('nl-NL', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            }).format(new Date())}
          </p>
        </div>

        <section aria-labelledby="events-heading">
          <h3 id="events-heading" className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
            Actieve evenementen
          </h3>

          {isLoading ? (
            <ListSkeleton count={2} />
          ) : events.length === 0 ? (
            <EmptyState
              title="Geen evenementen"
              description="Er zijn momenteel geen actieve evenementen."
              icon="📅"
            />
          ) : (
            <div className="space-y-2">
              {events.map((event) => (
                <Link key={event.id} href={`/events/${event.id}`} className="block">
                  <Card className="transition-colors hover:bg-gray-50 active:bg-gray-100">
                    <CardContent className="flex items-center justify-between py-3">
                      <div>
                        <p className="font-semibold text-gray-900">{event.name}</p>
                        <p className="mt-0.5 text-sm text-gray-500">
                          {formatDate(event.date)}
                        </p>
                      </div>
                      <EventStatusBadge status={event.status} />
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Snelkoppelingen */}
        <section aria-labelledby="shortcuts-heading">
          <h3 id="shortcuts-heading" className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
            Snelkoppelingen
          </h3>
          <div className="grid grid-cols-2 gap-2">
            <Link href="/events">
              <Card className="transition-colors hover:bg-gray-50 active:bg-gray-100">
                <CardContent className="flex flex-col items-center justify-center py-4 text-center">
                  <span className="mb-1 text-2xl" aria-hidden="true">📋</span>
                  <span className="text-sm font-medium text-gray-700">Tellen</span>
                </CardContent>
              </Card>
            </Link>
            <Link href="/restock-rounds">
              <Card className="transition-colors hover:bg-gray-50 active:bg-gray-100">
                <CardContent className="flex flex-col items-center justify-center py-4 text-center">
                  <span className="mb-1 text-2xl" aria-hidden="true">📦</span>
                  <span className="text-sm font-medium text-gray-700">Vullen</span>
                </CardContent>
              </Card>
            </Link>
            <Link href="/incidents">
              <Card className="transition-colors hover:bg-gray-50 active:bg-gray-100">
                <CardContent className="flex flex-col items-center justify-center py-4 text-center">
                  <span className="mb-1 text-2xl" aria-hidden="true">⚠️</span>
                  <span className="text-sm font-medium text-gray-700">Storingen</span>
                </CardContent>
              </Card>
            </Link>
            <Link href="/admin/products">
              <Card className="transition-colors hover:bg-gray-50 active:bg-gray-100">
                <CardContent className="flex flex-col items-center justify-center py-4 text-center">
                  <span className="mb-1 text-2xl" aria-hidden="true">⚙️</span>
                  <span className="text-sm font-medium text-gray-700">Beheer</span>
                </CardContent>
              </Card>
            </Link>
          </div>
        </section>
      </div>
    </>
  )
}
