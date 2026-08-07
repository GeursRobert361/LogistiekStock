import { repositories } from '@/repositories'
import { syncService } from './syncService'
import { newId } from '@/lib/ids'
import { IncidentStatus } from '@/types'
import type { Incident, IncidentCategory, IncidentUrgency } from '@/types'
import type { IncidentFilter } from '@/repositories/interfaces/IIncidentRepository'

export const URGENCY_LABEL: Record<IncidentUrgency, string> = {
  low: 'Laag',
  normal: 'Normaal',
  high: 'Hoog',
  kiosk_onbruikbaar: 'Kiosk onbruikbaar',
} as Record<IncidentUrgency, string>

export const CATEGORY_LABEL: Record<IncidentCategory, string> = {
  biertap: 'Biertap',
  'post-mix': 'Post-mix',
  koelcel: 'Koelcel',
  verlichting: 'Verlichting',
  kassa: 'Kassa',
  water: 'Water',
  elektriciteit: 'Elektriciteit',
  anders: 'Anders',
} as Record<IncidentCategory, string>

export const STATUS_LABEL: Record<IncidentStatus, string> = {
  [IncidentStatus.OPEN]: 'Open',
  [IncidentStatus.ACKNOWLEDGED]: 'Ontvangen',
  [IncidentStatus.IN_PROGRESS]: 'In behandeling',
  [IncidentStatus.RESOLVED]: 'Opgelost',
  [IncidentStatus.CLOSED]: 'Gesloten',
}

export async function getIncidents(filter?: IncidentFilter): Promise<Incident[]> {
  return repositories.incident().getIncidents(filter)
}

export async function getIncident(id: string): Promise<Incident | null> {
  return repositories.incident().getIncidentById(id)
}

export interface ReportIncidentParams {
  eventId: string
  kioskId: string
  category: IncidentCategory
  description: string
  urgency: IncidentUrgency
  photoUrl?: string
  reportedById: string
}

/**
 * Meldt een storing.
 *
 * Een storing mag het tellen nooit ophouden: lukt de serverwrite niet, dan
 * gaat de melding via de outbox alsnog mee zodra er verbinding is.
 */
export async function reportIncident(params: ReportIncidentParams): Promise<Incident> {
  if (!params.description.trim()) {
    throw new Error('Beschrijf kort wat er aan de hand is.')
  }

  const now = new Date().toISOString()
  const incident: Incident = {
    ...params,
    id: newId(),
    description: params.description.trim(),
    reportedAt: now,
    status: IncidentStatus.OPEN,
    createdAt: now,
    updatedAt: now,
  }

  try {
    return await repositories.incident().createIncident(incident)
  } catch (error) {
    console.warn('[storing] Direct opslaan mislukt; de melding gaat via de outbox.', error)
    await syncService.enqueue('incident', incident.id, 'create', incident)
    return incident
  }
}

export async function updateIncidentStatus(
  id: string,
  status: IncidentStatus,
  resolution?: string
): Promise<Incident> {
  return repositories.incident().updateIncident(id, {
    status,
    resolution: resolution?.trim() || undefined,
    resolvedAt:
      status === IncidentStatus.RESOLVED || status === IncidentStatus.CLOSED
        ? new Date().toISOString()
        : undefined,
  })
}

export function isOpen(incident: Incident): boolean {
  return incident.status !== IncidentStatus.RESOLVED && incident.status !== IncidentStatus.CLOSED
}
