/**
 * Opmerkingen over waar voorraad bij een kiosk fysiek ligt.
 *
 * Ze stonden met de hand bijgeschreven op de voorraadlijsten: bij een paar
 * kiosken staat een deel van de bekers niet vooraan maar achter in de kiosk,
 * bij de chips en de Post-mix gaat het over de plank, het luik of het hok
 * ernaast. Voor de vuller is dat het verschil tussen "er ligt niets meer" en
 * "je moet even om het hoekje kijken", dus hoort het op het scherm te staan
 * waar hij op dat moment naar kijkt.
 *
 * Wat het níet is: een aanpassing van de norm. 401 heeft er vijf staan, waarvan
 * twee achterin — geen zeven. 426 Chips Blauw blijft 6 en wordt geen 6 plus de
 * doos onder het luik. Geen enkele berekening kijkt hiernaar.
 *
 * Gekoppeld op kiosknummer en op de naam van het product of de categorie, niet
 * op de seed-id's uit `secondRingStandards`: in productie hebben producten hun
 * eigen UUID's, en nummer plus naam is wat de app daar werkelijk in handen
 * heeft. Kiosknummers zijn uniek — "406 Nieuw" heet intern 4061 — dus dat wijst
 * maar één kant op.
 *
 * Dit staat bewust los van de normenconfig: die is duizend regels stamdata en
 * hoeft niet mee de browser in voor een handvol zinnetjes.
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

/**
 * Opmerkingen die over een hele categorie bij één kiosk gaan.
 *
 * "3 op de plank, onder elk luik 1 doos" slaat op de chips als geheel en niet
 * op Blauw in het bijzonder. Ze per smaak opschrijven zou dezelfde zin drie keer
 * onder elkaar zetten; op het telscherm staat hij daarom één keer boven de
 * categorie.
 */
export interface CategoryStorageNote {
  kioskNumber: number
  /** De naam van de categorie, zoals hij op het scherm staat. */
  categoryName: string
  note: string
}

export const categoryStorageNotes: readonly CategoryStorageNote[] = [
  // Chips — waar de dozen liggen.
  { kioskNumber: 401, categoryName: 'Chips', note: '3 op de plank, onder elk luik 1 doos' },
  { kioskNumber: 406, categoryName: 'Chips', note: '3 dozen op het kratje, rest onder de balie' },
  { kioskNumber: 410, categoryName: 'Chips', note: '3 op de plank, onder elk luik 1 doos' },
  { kioskNumber: 412, categoryName: 'Chips', note: 'Onder de balie, 3 per vakje' },
  { kioskNumber: 414, categoryName: 'Chips', note: 'Onder de balie, 3 per vakje' },
  { kioskNumber: 416, categoryName: 'Chips', note: 'Onder elk luik 1 doos, rest op de plank' },
  { kioskNumber: 426, categoryName: 'Chips', note: '3 op de plank, onder elk luik 1 doos' },
  { kioskNumber: 427, categoryName: 'Chips', note: 'Onder de balie, 3 per vakje' },
  { kioskNumber: 429, categoryName: 'Chips', note: 'Onder de balie, 3 per vakje' },
  { kioskNumber: 4201, categoryName: 'Chips', note: 'In het magazijn' },

  // Post-mix — waar de reservepakken staan. FIFO staat als telinstructie bij de
  // categorie zelf; hier alleen waar het spul ligt.
  { kioskNumber: 406, categoryName: 'Post-mix', note: 'In het hok links van de kiosk' },
  // Op de bron heet dit telpunt "420 Hok". Dat is geen aparte kiosk maar de
  // bergruimte van 420; zonder deze regel zou een teller bij 420 naar acht
  // pakken Cola Zero zoeken die niet in de kiosk zelf staan.
  { kioskNumber: 420, categoryName: 'Post-mix', note: 'In het hok links van de kiosk' },
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

/** De opmerking bij deze categorie op deze kiosk, als die er is. */
export function categoryStorageNoteFor(
  kiosk: { number: number } | null | undefined,
  categoryName: string | null | undefined
): string | undefined {
  if (!kiosk || !categoryName) return undefined

  return categoryStorageNotes.find(
    (entry) => entry.kioskNumber === kiosk.number && entry.categoryName === categoryName
  )?.note
}
