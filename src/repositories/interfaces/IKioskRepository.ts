import type { Kiosk, KioskStorageNote, KioskStorageNoteInput, Ring } from '@/types'

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

  /**
   * De opmerkingen over waar voorraad ligt — alle kiosken in één keer.
   *
   * Het zijn er een handvol en het telscherm heeft ze meteen nodig, dus geen
   * filter per kiosk: dat zou een extra ronde kosten op het moment dat iemand
   * voor een kiosk staat.
   */
  getStorageNotes(): Promise<KioskStorageNote[]>
  saveStorageNote(input: KioskStorageNoteInput): Promise<KioskStorageNote>
  deleteStorageNote(id: string): Promise<void>
}
