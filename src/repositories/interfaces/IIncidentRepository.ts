import type { Incident } from '@/types'
import type { IncidentStatus } from '@/types'

export interface IncidentFilter {
  eventId?: string
  kioskId?: string
  status?: IncidentStatus
  openOnly?: boolean
}

export interface IIncidentRepository {
  getIncidents(filter?: IncidentFilter): Promise<Incident[]>
  getIncidentById(id: string): Promise<Incident | null>
  createIncident(data: Omit<Incident, 'id' | 'createdAt' | 'updatedAt'>): Promise<Incident>
  updateIncident(id: string, data: Partial<Incident>): Promise<Incident>
}
