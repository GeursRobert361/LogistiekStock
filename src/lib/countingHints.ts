/**
 * Korte telinstructies per productcategorie.
 *
 * Eén categorie wordt anders geteld dan de rest en dat is nergens aan de rijen
 * zelf te zien: bij Post-mix tel je de reservepakken buiten het rek, en níet het
 * pak dat aan de tap hangt. Wie dat niet weet telt er structureel één te veel
 * bij elke Post-mixkiosk, en dat verschil valt in de cijfers nooit op — het ziet
 * eruit als een kiosk die het net iets beter doet.
 *
 * Vandaar op het scherm en niet alleen in een werkinstructie: de regel is nodig
 * op het moment dat er geteld wordt.
 *
 * Gekoppeld op categorienaam, net als de opmerkingen in `storageNotes.ts`: in
 * productie hebben categorieën hun eigen UUID's en is de naam wat de app
 * werkelijk in handen heeft.
 *
 * Dit is bewust een vaste lijst in de code en geen beheerscherm. Het zijn
 * vaste werkafspraken, geen instellingen; een tabel plus een formulier erbij
 * kost meer dan het oplevert zolang er één regel in staat.
 */

export interface CountingHint {
  /** De naam van de categorie, zoals hij op het scherm staat. */
  categoryName: string
  /** Regel voor regel; wordt als lijstje getoond. */
  lines: readonly string[]
}

export const countingHints: readonly CountingHint[] = [
  {
    categoryName: 'Post-mix',
    lines: [
      'Tel alleen de reservepakken buiten het rek.',
      'Vervang eerst de lege pakken.',
      'Pak onder de 25%? Behandel het als leeg.',
      'Vul altijd FIFO: eerst komende datum bovenop en aan de voorkant.',
    ],
  },
]

/** De telinstructie bij deze categorie, als die er is. */
export function countingHintFor(categoryName: string | null | undefined): CountingHint | undefined {
  if (!categoryName) return undefined
  return countingHints.find((hint) => hint.categoryName === categoryName)
}
