'use client'

import { use, useEffect, useState } from 'react'
import { AppHeader } from '@/components/layout/AppHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/shared/EmptyState'
import { repositories } from '@/repositories'
import type { CountSession, KioskCount } from '@/types'
import { CountSessionStatus, KioskCountStatus } from '@/types'

export default function CountReviewPage({
  params,
}: {
  params: Promise<{ eventId: string }>
}) {
  const { eventId } = use(params)
  const [sessions, setSessions] = useState<CountSession[]>([])
  const [kioskCounts, setKioskCounts] = useState<Map<string, KioskCount[]>>(new Map())
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const sess = await repositories.count().getSessions(eventId)
      setSessions(sess)

      const countsMap = new Map<string, KioskCount[]>()
      await Promise.all(
        sess.map(async (s) => {
          const counts = await repositories.count().getKioskCountsForSession(s.id)
          countsMap.set(s.id, counts)
        })
      )
      setKioskCounts(countsMap)
      setIsLoading(false)
    }
    load()
  }, [eventId])

  const allCounts = sessions.flatMap((s) => kioskCounts.get(s.id) ?? [])
  const completedCount = allCounts.filter((c) => c.status === KioskCountStatus.COMPLETED).length
  const skippedCount = allCounts.filter((c) => c.status === KioskCountStatus.SKIPPED).length
  const pendingCount = allCounts.filter((c) => c.status === KioskCountStatus.PENDING).length

  return (
    <>
      <AppHeader title="Telling controleren" backHref={`/events/${eventId}`} />
      <div className="space-y-4 p-4">
        {/* Overzicht */}
        <Card>
          <CardHeader>
            <CardTitle>Overzicht</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-2xl font-bold text-green-600">{completedCount}</p>
                <p className="text-xs text-gray-500">Afgerond</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-yellow-600">{skippedCount}</p>
                <p className="text-xs text-gray-500">Overgeslagen</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-400">{pendingCount}</p>
                <p className="text-xs text-gray-500">Openstaand</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Telrondes */}
        {isLoading ? (
          <p className="text-center text-gray-500">Laden…</p>
        ) : sessions.length === 0 ? (
          <EmptyState
            title="Geen telrondes"
            description="Er zijn nog geen telrondes gestart voor dit evenement."
            icon="📋"
          />
        ) : (
          sessions.map((session) => {
            const counts = kioskCounts.get(session.id) ?? []
            const done = counts.filter((c) => c.status === KioskCountStatus.COMPLETED).length
            return (
              <Card key={session.id}>
                <CardContent className="py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-gray-900">
                        Telronde {session.id.slice(0, 8)}
                      </p>
                      <p className="text-sm text-gray-500">
                        {done} / {counts.length} kiosken afgerond
                      </p>
                    </div>
                    <Badge
                      variant={
                        session.status === CountSessionStatus.APPROVED
                          ? 'success'
                          : session.status === CountSessionStatus.SUBMITTED
                            ? 'info'
                            : 'default'
                      }
                    >
                      {session.status}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}

        {/* Goedkeuren */}
        {sessions.length > 0 && (
          <Button size="lg" className="w-full">
            Telling goedkeuren →
          </Button>
        )}
      </div>
    </>
  )
}
