'use client'

import { use, useCallback, useEffect, useState } from 'react'
import { AppHeader } from '@/components/layout/AppHeader'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/shared/EmptyState'
import { repositories } from '@/repositories'
import { useAuth } from '@/context/AuthContext'
import {
  getIncident,
  updateIncidentStatus,
  CATEGORY_LABEL,
  STATUS_LABEL,
  URGENCY_LABEL,
} from '@/services/incidentService'
import { IncidentStatus, UserRole } from '@/types'
import type { Incident, Kiosk } from '@/types'
import { formatDateTime } from '@/lib/utils'

const NEXT_STATUSES: Record<IncidentStatus, IncidentStatus[]> = {
  [IncidentStatus.OPEN]: [IncidentStatus.ACKNOWLEDGED, IncidentStatus.IN_PROGRESS],
  [IncidentStatus.ACKNOWLEDGED]: [IncidentStatus.IN_PROGRESS, IncidentStatus.RESOLVED],
  [IncidentStatus.IN_PROGRESS]: [IncidentStatus.RESOLVED],
  [IncidentStatus.RESOLVED]: [IncidentStatus.CLOSED],
  [IncidentStatus.CLOSED]: [],
}

export default function IncidentDetailPage({
  params,
}: {
  params: Promise<{ incidentId: string }>
}) {
  const { incidentId } = use(params)
  const { hasAnyRole } = useAuth()

  const [incident, setIncident] = useState<Incident | null>(null)
  const [kiosk, setKiosk] = useState<Kiosk | null>(null)
  const [resolution, setResolution] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const canManage = hasAnyRole([UserRole.PLANNER, UserRole.ADMIN])

  const load = useCallback(async () => {
    const found = await getIncident(incidentId)
    setIncident(found)
    setResolution(found?.resolution ?? '')
    if (found) {
      setKiosk(await repositories.kiosk().getKioskById(found.kioskId))
    }
    setIsLoading(false)
  }, [incidentId])

  useEffect(() => {
    load().catch((loadError: unknown) => {
      console.error('[storing] Laden mislukt.', loadError)
      setIsLoading(false)
    })
  }, [load])

  async function handleStatus(status: IncidentStatus) {
    setError(null)
    try {
      await updateIncidentStatus(incidentId, status, resolution)
      await load()
    } catch (statusError) {
      console.error('[storing] Status bijwerken mislukt.', statusError)
      setError('De status kon niet worden bijgewerkt.')
    }
  }

  if (isLoading) {
    return (
      <>
        <AppHeader title="Storing" backHref="/incidents" />
        <div className="p-4 text-center text-gray-500">Laden…</div>
      </>
    )
  }

  if (!incident) {
    return (
      <>
        <AppHeader title="Storing" backHref="/incidents" />
        <div className="p-4">
          <EmptyState title="Storing niet gevonden" icon="❌" />
        </div>
      </>
    )
  }

  return (
    <>
      <AppHeader title={CATEGORY_LABEL[incident.category]} backHref="/incidents" />
      <div className="space-y-4 p-4">
        <div className="rounded-xl bg-gray-50 px-3 py-3 text-center">
          <p className="text-xs text-gray-600">Kiosk</p>
          <p className="text-4xl font-black text-arena-red">
            {kiosk?.number ?? incident.kioskId}
          </p>
        </div>

        <div className="flex items-center justify-between">
          <Badge variant={incident.status === IncidentStatus.RESOLVED ? 'success' : 'warning'}>
            {STATUS_LABEL[incident.status]}
          </Badge>
          <span className="text-sm text-gray-600">
            Urgentie: {URGENCY_LABEL[incident.urgency]}
          </span>
        </div>

        <Card>
          <CardContent className="space-y-2 py-3">
            <p className="text-gray-900">{incident.description}</p>
            <p className="text-xs text-gray-500">Gemeld {formatDateTime(incident.reportedAt)}</p>
          </CardContent>
        </Card>

        {incident.photoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={incident.photoUrl}
            alt="Foto bij de storingsmelding"
            className="w-full rounded-xl object-contain"
          />
        )}

        {incident.resolution && (
          <Card>
            <CardContent className="py-3">
              <p className="text-sm font-semibold text-gray-900">Afhandeling</p>
              <p className="text-sm text-gray-700">{incident.resolution}</p>
            </CardContent>
          </Card>
        )}

        {error && (
          <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
            {error}
          </p>
        )}

        {canManage && NEXT_STATUSES[incident.status].length > 0 && (
          <div className="space-y-2">
            <label htmlFor="resolution" className="block text-sm font-medium text-gray-700">
              Toelichting (optioneel)
            </label>
            <textarea
              id="resolution"
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              rows={3}
              className="w-full rounded-xl border border-gray-300 p-3 text-base text-gray-900 focus:border-arena-red focus:outline-none focus:ring-2 focus:ring-arena-red/30"
            />
            {NEXT_STATUSES[incident.status].map((status) => (
              <Button
                key={status}
                size="lg"
                variant={status === IncidentStatus.RESOLVED ? 'primary' : 'secondary'}
                className="w-full"
                onClick={() => void handleStatus(status)}
              >
                Markeren als {STATUS_LABEL[status].toLowerCase()}
              </Button>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
