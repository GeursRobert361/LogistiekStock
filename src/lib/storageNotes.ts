/**
 * Opmerkingen over waar voorraad bij een kiosk fysiek ligt.
 *
 * Ze stonden met de hand bijgeschreven op de bekerlijst: bij een paar kiosken
 * staat een deel van de bekers niet vooraan maar achter in de kiosk. Voor de
 * vuller is dat het verschil tussen "er ligt niets meer" en "je moet even om
 * het hoekje kijken", dus hoort het op het scherm te staan waar hij op dat
 * moment naar kijkt.
 *
 * Wat het níet is: een aanpassing van de norm. 401 heeft er vijf staan, waarvan
 * twee achterin — geen zeven. Geen enkele berekening kijkt hiernaar.
 *
 * Gekoppeld op kiosknummer en productnaam, niet op de seed-id's uit
 * `secondRingStandards`: in productie hebben producten hun eigen UUID's, en
 * nummer plus naam is wat de app daar werkelijk in handen heeft. Kiosknummers
 * zijn uniek — "406 Nieuw" heet intern 4061 — dus dat wijst maar één kant op.
 *
 * Dit staat bewust los van de normenconfig: die is duizend regels stamdata en
 * hoeft niet mee de browser in voor drie zinnetjes.
 */

export interface StorageNote {
  kioskNumber: number
  /** De naam uit de catalogus, zoals hij op het scherm staat. */
  productName: string
  note: string
}

export const storageNotes: readonly StorageNote[] = [
  { kioskNumber: 401, productName: 'Bierbekers 0,5', note: '2 dozen achter in de kiosk' },
  { kioskNumber: 410, productName: 'Bierbekers 0,5', note: '1 doos achter in de kiosk' },
  { kioskNumber: 426, productName: 'Bierbekers 0,5', note: '1 doos achter in de kiosk' },
]

/** De opmerking bij dit product op deze kiosk, als die er is. */
export function storageNoteFor(
  kiosk: { number: number } | null | undefined,
  product: { name: string } | null | undefined
): string | undefined {
  if (!kiosk || !product) return undefined

  return storageNotes.find(
    (entry) => entry.kioskNumber === kiosk.number && entry.productName === product.name
  )?.note
}
