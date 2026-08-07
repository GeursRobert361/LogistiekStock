'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { AppHeader } from '@/components/layout/AppHeader'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/shared/EmptyState'
import { ListSkeleton } from '@/components/shared/LoadingSkeleton'
import { repositories } from '@/repositories'
import {
  getIncidents,
  isOpen,
  CATEGORY_LABEL,
  STATUS_LABEL,
  URGENCY_LABEL,
} from '@/services/incidentService'
import { IncidentUrgency } from '@/types'
import type { Incident, Kiosk } from '@/types'
import { formatDateTime } from '@/lib/utils'

const URGENCY_VARIANT: Record<IncidentUrgency, 'danger' | 'warning' | 'default'> = {
  [IncidentUrgency.KIOSK_UNUSABLE]: 'danger',
  [IncidentUrgency.HIGH]: 'danger',
  [IncidentUrgency.NORMAL]: 'warning',
  [IncidentUrgency.LOW]: 'default',
}

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [kiosks, setKiosks] = useState<Map<string, Kiosk>>(new Map())
  const [showResolved, setShowResolved] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  const load = useCallback(async () => {
    const [incidentList, kioskList] = await Promise.all([
      getIncidents(),
      repositories.kiosk().getKiosks(),
    ])
    setIncidents(incidentList)
    setKiosks(new Map(kioskList.map((k) => [k.id, k])))
    setIsLoading(false)
  }, [])

  useEffect(() => {
    load().catch((error: unknown) => {
      console.error('[storingen] Laden mislukt.', error)
      setIsLoading(false)
    })
  }, [load])

  const visible = showResolved ? incidents : incidents.filter(isOpen)
  const openCount = incidents.filter(isOpen).length

  return (
    <>
      <AppHeader
        title="Storingen"
        actions={
          <Link href="/incidents/new">
            <Button size="sm" variant="outline">
              + Melden
            </Button>
          </Link>
        }
      />
      <div className="space-y-3 p-4">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowResolved(false)}
            className={`min-h-11 flex-1 rounded-xl border px-3 text-sm font-medium ${
              !showResolved
                ? 'border-arena-red bg-red-50 text-arena-red'
                : 'border-gray-300 bg-white text-gray-700'
            }`}
          >
            Open ({openCount})
          </button>
          <button
            type="button"
            onClick={() => setShowResolved(true)}
            className={`min-h-11 flex-1 rounded-xl border px-3 text-sm font-medium ${
              showResolved
                ? 'border-arena-red bg-red-50 text-arena-red'
                : 'border-gray-300 bg-white text-gray-700'
            }`}
          >
            Alle ({incidents.length})
          </button>
        </div>

        {isLoading ? (
          <ListSkeleton count={3} />
        ) : visible.length === 0 ? (
          <EmptyState
            title={showResolved ? 'Geen storingen' : 'Geen open storingen'}
            description="Er zijn op dit moment geen meldingen."
            icon="✅"
            action={
              <Link href="/incidents/new">
                <Button variant="outline">Storing melden</Button>
              </Link>
            }
          />
        ) : (
          <div className="space-y-2">
            {visible.map((incident) => (
              <Link key={incident.id} href={`/incidents/${incident.id}`} className="block">
                <Card className="active:bg-gray-100">
                  <CardContent className="py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900">
                          Kiosk {kiosks.get(incident.kioskId)?.number ?? incident.kioskId} —{' '}
                          {CATEGORY_LABEL[incident.category]}
                        </p>
                        <p className="mt-0.5 truncate text-sm text-gray-700">
                          {incident.description}
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          {formatDateTime(incident.reportedAt)}
                        </p>
                      </div>
                      <div className="flex flex-shrink-0 flex-col items-end gap-1">
                        <Badge variant={URGENCY_VARIANT[incident.urgency]}>
                          {URGENCY_LABEL[incident.urgency]}
                        </Badge>
                        <span className="text-xs text-gray-600">
                          {STATUS_LABEL[incident.status]}
                        </span>
                      </div>
                    </div>
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
