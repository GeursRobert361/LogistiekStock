import type { IKioskRepository } from '../interfaces/IKioskRepository'
import type { Kiosk, Ring } from '@/types'
import { demoRings, demoKiosks, demoEvent } from '@/lib/seed/demoData'

export class DemoKioskRepository implements IKioskRepository {
  private rings = [...demoRings]
  private kiosks = [...demoKiosks]

  async getRings(): Promise<Ring[]> {
    return this.rings.filter((r) => r.isActive)
  }

  async getRingById(id: string): Promise<Ring | null> {
    return this.rings.find((r) => r.id === id) ?? null
  }

  async getKiosks(ringId?: string): Promise<Kiosk[]> {
    return this.kiosks.filter((k) => k.isActive && (ringId == null || k.ringId === ringId))
  }

  async getKioskById(id: string): Promise<Kiosk | null> {
    return this.kiosks.find((k) => k.id === id) ?? null
  }

  async getKiosksByEvent(eventId: string): Promise<Array<Kiosk & { isOpenForEvent: boolean }>> {
    const event = demoEvent.id === eventId ? demoEvent : null
    if (!event) return []
    return this.kiosks
      .filter((k) => k.isActive)
      .map((k) => ({
        ...k,
        isOpenForEvent: event.activeKioskIds.includes(k.id),
      }))
  }

  async createKiosk(data: Omit<Kiosk, 'id' | 'createdAt' | 'updatedAt'>): Promise<Kiosk> {
    const kiosk: Kiosk = {
      ...data,
      id: `kiosk-${crypto.randomUUID()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    this.kiosks.push(kiosk)
    return kiosk
  }

  async updateKiosk(id: string, data: Partial<Kiosk>): Promise<Kiosk> {
    const idx = this.kiosks.findIndex((k) => k.id === id)
    if (idx === -1) throw new Error(`Kiosk niet gevonden: ${id}`)
    const updated = { ...this.kiosks[idx]!, ...data, updatedAt: new Date().toISOString() }
    this.kiosks[idx] = updated
    return updated
  }

  async deleteKiosk(id: string): Promise<void> {
    await this.updateKiosk(id, { isActive: false })
  }

  async updateEventKiosks(
    _eventId: string,
    _kioskIds: string[],
    _openIds: string[]
  ): Promise<void> {
    // In demo mode this is a no-op since event data is static
  }
}
