'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AppHeader } from '@/components/layout/AppHeader'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/shared/EmptyState'
import { IncidentStatus, IncidentUrgency } from '@/types'
import type { Incident } from '@/types'
import { formatDateTime } from '@/lib/utils'

// Demo-incidenten (in echte app: via repository)
const DEMO_INCIDENTS: Incident[] = []

const URGENCY_LABEL: Record<IncidentUrgency, { label: string; variant: 'danger' | 'warning' | 'default' | 'info' }> = {
  [IncidentUrgency.KIOSK_UNUSABLE]: { label: 'Kiosk onbruikbaar', variant: 'danger' },
  [IncidentUrgency.HIGH]: { label: 'Hoog', variant: 'danger' },
  [IncidentUrgency.NORMAL]: { label: 'Normaal', variant: 'warning' },
  [IncidentUrgency.LOW]: { label: 'Laag', variant: 'default' },
}

const STATUS_LABEL: Record<IncidentStatus, string> = {
  [IncidentStatus.OPEN]: 'Open',
  [IncidentStatus.ACKNOWLEDGED]: 'Ontvangen',
  [IncidentStatus.IN_PROGRESS]: 'In behandeling',
  [IncidentStatus.RESOLVED]: 'Opgelost',
  [IncidentStatus.CLOSED]: 'Gesloten',
}

export default function IncidentsPage() {
  const [incidents] = useState<Incident[]>(DEMO_INCIDENTS)

  return (
    <>
      <AppHeader
        title="Storingen"
        actions={
          <Link href="/incidents/new">
            <Button size="sm" variant="outline">+ Melden</Button>
          </Link>
        }
      />
      <div className="p-4">
        {incidents.length === 0 ? (
          <div className="space-y-4">
            <EmptyState
              title="Geen actieve storingen"
              description="Er zijn momenteel geen storingen gemeld."
              icon="✅"
              action={
                <Link href="/incidents/new">
                  <Button variant="outline">Storing melden</Button>
                </Link>
              }
            />
          </div>
        ) : (
          <div className="space-y-2">
            {incidents.map((incident) => {
              const urgency = URGENCY_LABEL[incident.urgency]
              return (
                <Link key={incident.id} href={`/incidents/${incident.id}`} className="block">
                  <Card className="hover:bg-gray-50 active:bg-gray-100">
                    <CardContent className="py-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-900">
                            Kiosk {incident.kioskId} — {incident.category}
                          </p>
                          <p className="mt-0.5 truncate text-sm text-gray-600">
                            {incident.description}
                          </p>
                          <p className="mt-1 text-xs text-gray-400">
                            {formatDateTime(incident.reportedAt)}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <Badge variant={urgency.variant}>{urgency.label}</Badge>
                          <span className="text-xs text-gray-500">
                            {STATUS_LABEL[incident.status]}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
