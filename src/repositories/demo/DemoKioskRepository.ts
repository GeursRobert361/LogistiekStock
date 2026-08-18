import type { IKioskRepository } from '../interfaces/IKioskRepository'
import type { Kiosk, KioskStorageNote, KioskStorageNoteInput, Ring } from '@/types'
import { demoTables } from './demoTables'
import { storageNoteProblem } from '@/lib/storageNotes'
import { newId } from '@/lib/ids'

export class DemoKioskRepository implements IKioskRepository {
  async getRings(options?: { includeInactive?: boolean }): Promise<Ring[]> {
    return demoTables.rings
      .filter((r) => options?.includeInactive === true || r.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder)
  }

  async getRingById(id: string): Promise<Ring | null> {
    return demoTables.rings.getById(id)
  }

  async createRing(data: Omit<Ring, 'id' | 'createdAt' | 'updatedAt'>): Promise<Ring> {
    const now = new Date().toISOString()
    const ring: Ring = { ...data, id: `ring-${newId()}`, createdAt: now, updatedAt: now }
    demoTables.rings.insert(ring)
    return ring
  }

  async updateRing(id: string, data: Partial<Ring>): Promise<Ring> {
    return demoTables.rings.update(id, { ...data, updatedAt: new Date().toISOString() })
  }

  async getKiosks(ringId?: string, options?: { includeInactive?: boolean }): Promise<Kiosk[]> {
    return demoTables.kiosks
      .filter(
        (k) =>
          (options?.includeInactive === true || k.isActive) &&
          (ringId == null || k.ringId === ringId)
      )
      .sort((a, b) => a.sortOrder - b.sortOrder)
  }

  async getKioskById(id: string): Promise<Kiosk | null> {
    return demoTables.kiosks.getById(id)
  }

  async getKiosksByEvent(eventId: string): Promise<Array<Kiosk & { isOpenForEvent: boolean }>> {
    const event = demoTables.events.getById(eventId)
    if (!event) return []
    return demoTables.kiosks
      .filter((k) => k.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((k) => ({ ...k, isOpenForEvent: event.activeKioskIds.includes(k.id) }))
  }

  async createKiosk(data: Omit<Kiosk, 'id' | 'createdAt' | 'updatedAt'>): Promise<Kiosk> {
    const now = new Date().toISOString()
    const kiosk: Kiosk = { ...data, id: `kiosk-${newId()}`, createdAt: now, updatedAt: now }
    demoTables.kiosks.insert(kiosk)
    return kiosk
  }

  async updateKiosk(id: string, data: Partial<Kiosk>): Promise<Kiosk> {
    return demoTables.kiosks.update(id, { ...data, updatedAt: new Date().toISOString() })
  }

  async deleteKiosk(id: string): Promise<void> {
    await this.updateKiosk(id, { isActive: false })
  }

  async updateEventKiosks(eventId: string, kioskIds: string[], openIds: string[]): Promise<void> {
    const event = demoTables.events.getById(eventId)
    if (!event) throw new Error(`Evenement niet gevonden: ${eventId}`)
    demoTables.events.update(eventId, {
      activeKioskIds: kioskIds,
      // `openIds` bepaalt welke kiosken tijdens dit evenement echt open zijn.
      // In demo-modus vallen die samen met de actieve kiosken van het evenement.
      ...(openIds.length > 0 ? { activeKioskIds: openIds } : {}),
      updatedAt: new Date().toISOString(),
    })
  }

  async getStorageNotes(): Promise<KioskStorageNote[]> {
    return demoTables.storageNotes.all()
  }

  async saveStorageNote(input: KioskStorageNoteInput): Promise<KioskStorageNote> {
    const problem = storageNoteProblem(input)
    if (problem) throw new Error(problem)

    // Dezelfde kiosk plus hetzelfde product of dezelfde categorie is dezelfde
    // regel; in productie doet de unieke index dit werk.
    const existing = demoTables.storageNotes.find(
      (note) =>
        note.kioskId === input.kioskId &&
        note.productId === input.productId &&
        note.categoryId === input.categoryId
    )

    const now = new Date().toISOString()
    if (existing) {
      return demoTables.storageNotes.update(existing.id, {
        note: input.note.trim(),
        updatedAt: now,
      })
    }

    const created: KioskStorageNote = {
      id: `note-${newId()}`,
      kioskId: input.kioskId,
      ...(input.productId ? { productId: input.productId } : {}),
      ...(input.categoryId ? { categoryId: input.categoryId } : {}),
      note: input.note.trim(),
      createdAt: now,
      updatedAt: now,
    }
    return demoTables.storageNotes.insert(created)
  }

  async deleteStorageNote(id: string): Promise<void> {
    demoTables.storageNotes.remove(id)
  }
}
