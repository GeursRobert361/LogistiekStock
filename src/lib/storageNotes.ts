/**
 * Opzoeken van de opmerkingen over waar voorraad bij een kiosk fysiek ligt.
 *
 * De opmerkingen zelf staan in `kiosk_storage_notes` en zijn te wijzigen in
 * Beheer › Opmerkingen. Ze stonden lang als vaste lijst in dit bestand, op
 * kiosknummer en productnaam; dat werkte, maar een naamswijziging in de
 * catalogus liet een opmerking geruisloos verdwijnen en niemand kon er iets aan
 * doen zonder een nieuwe deploy. Nu gaat het op id.
 *
 * Een scherm haalt de regels één keer op en bouwt hier een index van, zodat het
 * opzoeken per rij niet over de hele lijst loopt. Zolang er niets geladen is
 * gebruik je `EMPTY_STORAGE_NOTES`: het telscherm tekent zijn rijen voordat de
 * opmerkingen binnen zijn, en dat hoort een leeg regeltje te geven.
 */
import type { KioskStorageNote, KioskStorageNoteInput } from '@/types'

/**
 * Wat er mis is met deze opmerking, of niets.
 *
 * Dezelfde regels als de check-constraints op `kiosk_storage_notes`, maar dan
 * met een melding die op de vloer te lezen is. Staat hier zodat demo-modus en
 * de server het niet elk apart bedenken: wat lokaal opslaat, hoort ook in de
 * ArenA op te slaan.
 */
export function storageNoteProblem(input: KioskStorageNoteInput): string | undefined {
  if (!input.kioskId) return 'Kies een kiosk.'

  const targets = [input.productId, input.categoryId].filter(Boolean)
  if (targets.length === 0) return 'Kies een product of een categorie.'
  if (targets.length > 1) return 'Kies een product óf een categorie, niet allebei.'

  // Leeg opslaan is "weghalen", en dat gaat via verwijderen. Zou het hier wel
  // mogen, dan blijft er een onzichtbare regel staan die de volgende opmerking
  // bij hetzelfde product in de weg zit.
  if (input.note.trim() === '') return 'Schrijf een opmerking, of haal de regel weg.'

  return undefined
}

export interface StorageNoteLookup {
  /** De opmerking bij dit product op deze kiosk, als die er is. */
  forProduct(
    kioskId: string | null | undefined,
    productId: string | null | undefined
  ): string | undefined
  /** De opmerking bij deze categorie op deze kiosk, als die er is. */
  forCategory(
    kioskId: string | null | undefined,
    categoryId: string | null | undefined
  ): string | undefined
}

const key = (kioskId: string, targetId: string): string => `${kioskId}:${targetId}`

export function buildStorageNoteLookup(notes: readonly KioskStorageNote[]): StorageNoteLookup {
  const byProduct = new Map<string, string>()
  const byCategory = new Map<string, string>()

  for (const note of notes) {
    // Product en categorie hebben elk hun eigen kaart. Ze op één hoop gooien
    // zou een categorie-opmerking laten opduiken bij een product dat toevallig
    // hetzelfde id draagt — onmogelijk met UUID's, maar niet met de leesbare
    // id's van de demo-data, en daar wordt het scherm mee getest.
    if (note.productId) {
      byProduct.set(key(note.kioskId, note.productId), note.note)
    } else if (note.categoryId) {
      byCategory.set(key(note.kioskId, note.categoryId), note.note)
    }
  }

  return {
    forProduct(kioskId, productId) {
      if (!kioskId || !productId) return undefined
      return byProduct.get(key(kioskId, productId))
    },
    forCategory(kioskId, categoryId) {
      if (!kioskId || !categoryId) return undefined
      return byCategory.get(key(kioskId, categoryId))
    },
  }
}

/** Voor schermen die nog aan het laden zijn. */
export const EMPTY_STORAGE_NOTES: StorageNoteLookup = buildStorageNoteLookup([])
