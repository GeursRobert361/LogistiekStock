import type { IIncidentRepository, IncidentFilter } from '../interfaces/IIncidentRepository'
import type { Incident } from '@/types'
import { IncidentStatus } from '@/types'
import { demoTables } from './demoTables'
import { newId } from '@/lib/ids'

const CLOSED_STATUSES: IncidentStatus[] = [IncidentStatus.RESOLVED, IncidentStatus.CLOSED]

export class DemoIncidentRepository implements IIncidentRepository {
  async getIncidents(filter?: IncidentFilter): Promise<Incident[]> {
    return demoTables.incidents
      .filter((incident) => {
        if (filter?.eventId && incident.eventId !== filter.eventId) return false
        if (filter?.kioskId && incident.kioskId !== filter.kioskId) return false
        if (filter?.status && incident.status !== filter.status) return false
        if (filter?.openOnly && CLOSED_STATUSES.includes(incident.status)) return false
        return true
      })
      .sort((a, b) => b.reportedAt.localeCompare(a.reportedAt))
  }

  async getIncidentById(id: string): Promise<Incident | null> {
    return demoTables.incidents.getById(id)
  }

  async createIncident(data: Omit<Incident, 'id' | 'createdAt' | 'updatedAt'>): Promise<Incident> {
    const now = new Date().toISOString()
    const incident: Incident = { ...data, id: newId(), createdAt: now, updatedAt: now }
    demoTables.incidents.insert(incident)
    return incident
  }

  async updateIncident(id: string, data: Partial<Incident>): Promise<Incident> {
    return demoTables.incidents.update(id, { ...data, updatedAt: new Date().toISOString() })
  }
}
