import type { Kiosk, Ring } from '@/types'

export interface IKioskRepository {
  getRings(options?: { includeInactive?: boolean }): Promise<Ring[]>
  getRingById(id: string): Promise<Ring | null>
  createRing(data: Omit<Ring, 'id' | 'createdAt' | 'updatedAt'>): Promise<Ring>
  updateRing(id: string, data: Partial<Ring>): Promise<Ring>
  getKiosks(ringId?: string, options?: { includeInactive?: boolean }): Promise<Kiosk[]>
  getKioskById(id: string): Promise<Kiosk | null>
  getKiosksByEvent(eventId: string): Promise<Array<Kiosk & { isOpenForEvent: boolean }>>
  createKiosk(data: Omit<Kiosk, 'id' | 'createdAt' | 'updatedAt'>): Promise<Kiosk>
  updateKiosk(id: string, data: Partial<Kiosk>): Promise<Kiosk>
  deleteKiosk(id: string): Promise<void>
  updateEventKiosks(eventId: string, kioskIds: string[], openIds: string[]): Promise<void>
}
