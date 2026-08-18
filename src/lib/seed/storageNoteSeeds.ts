/**
 * De opmerkingen over waar voorraad ligt, zoals ze de eerste keer de database
 * in gaan.
 *
 * Ze stonden met de hand bijgeschreven op de voorraadlijsten: bij een paar
 * kiosken staat een deel van de bekers niet vooraan maar achter in de kiosk,
 * bij de chips en de Post-mix gaat het over de plank, het luik of het hok
 * ernaast.
 *
 * Dit is een startlijst en geen bron van waarheid meer. De app leest de
 * opmerkingen uit `kiosk_storage_notes`, waar ze via Beheer › Opmerkingen te
 * wijzigen zijn; migratie 014 plant deze regels daar eenmalig in en kijkt er
 * daarna niet meer naar. Wat hier staat is dus wat er stond op de dag dat de
 * tabel werd aangemaakt — pas het niet aan om iets op de vloer te corrigeren,
 * want dat komt nergens meer terecht.
 *
 * Blijft staan omdat demo-modus geen database heeft: daar wordt deze lijst op
 * de demo-id's gelegd, zodat het telscherm er lokaal hetzelfde uitziet als in
 * de ArenA.
 *
 * Gekoppeld op kiosknummer en op de naam van het product of de categorie, niet
 * op de seed-id's uit `secondRingStandards`: in productie hebben producten hun
 * eigen UUID's, en nummer plus naam is wat de migratie daar werkelijk in handen
 * heeft. Kiosknummers zijn uniek — "406 Nieuw" heet intern 4061 — dus dat wijst
 * maar één kant op.
 */

export interface ProductStorageNoteSeed {
  kioskNumber: number
  /** De naam uit de catalogus, zoals hij op het scherm staat. */
  productName: string
  note: string
}

export const productStorageNoteSeeds: readonly ProductStorageNoteSeed[] = [
  { kioskNumber: 401, productName: 'Bierbekers 0,5', note: '2 dozen achter in de kiosk' },
  { kioskNumber: 410, productName: 'Bierbekers 0,5', note: '1 doos achter in de kiosk' },
  { kioskNumber: 426, productName: 'Bierbekers 0,5', note: '1 doos achter in de kiosk' },
]

export interface CategoryStorageNoteSeed {
  kioskNumber: number
  /** De naam van de categorie, zoals hij op het scherm staat. */
  categoryName: string
  note: string
}

export const categoryStorageNoteSeeds: readonly CategoryStorageNoteSeed[] = [
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
