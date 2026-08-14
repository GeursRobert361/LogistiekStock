/**
 * Welke producten met snelknoppen geteld worden, in plaats van met het
 * numerieke invoerveld.
 *
 * Bij het meeste kleine spul ligt er nul tot een handvol, en fluctueert dat
 * nauwelijks. Daar is "tik op 4" sneller en minder foutgevoelig dan een veld
 * openen, typen en bevestigen — een teller doet dit vijftien keer per kiosk,
 * over twintig kiosken.
 *
 * Bewust een expliciete lijst per product en geen regel op de norm. Of
 * snelknoppen werken hangt af van hoe een product zich gedraagt, niet van het
 * getal dat er vandaag toevallig als norm staat: een product met norm 3 dat in
 * de praktijk tussen 0 en 25 schommelt is er ongeschikt voor, en een afgeleide
 * regel zou dat niet zien.
 *
 * Staat een product hier niet in, dan verandert er niets: het houdt het
 * bestaande `QuarterQuantityInput`. Dat geldt met opzet voor de tien gekoelde
 * dranken — daar lopen de aantallen tot dertig, en een rij van dertig knoppen
 * is geen versnelling maar een zoekplaatje.
 *
 * ── Waarom de sleutel de productnaam is en niet het id ──────────────────────
 *
 * In productie hebben producten een UUID uit de database; de leesbare sleutels
 * uit `catalogue.ts` bestaan daar niet. Een config op `product.id` matcht
 * daardoor alleen in de demo-modus en nooit op de vloer — en dat is precies
 * hoe deze lijst een keer volledig groen getest kon zijn terwijl er in de app
 * geen enkele knop verscheen. De naam is wat de app in beide modi werkelijk in
 * handen heeft. Zie ook `storageNotes.ts` en `countingHints.ts`, die op
 * dezelfde grond op naam koppelen, en `dbIds.ts`, dat aan de serverkant seed-id
 * en UUID via de naam aan elkaar knoopt.
 *
 * Namen zijn uniek in de catalogus; een test bewaakt dat elke sleutel hier bij
 * een bestaand product hoort, zodat een typefout of een hernoeming opvalt in
 * plaats van stil de snelknoppen weg te nemen.
 *
 * Dit is nog geen stamdata. Geen databasekolom, geen beheerscherm: eerst
 * uitproberen of de tel-UX hiermee werkelijk sneller wordt. Blijkt van wel,
 * dan is dit het moment om er kolommen bij te bedenken.
 */

export type QuickCountMode =
  /** Alleen hele verpakkingen. */
  | 'INTEGER'
  /** Hele verpakkingen plus één knop voor de halve. */
  | 'HALF'

export interface QuickCountConfig {
  mode: QuickCountMode
  /** Hoogste snelknop. Alles daarboven gaat via "Meer…". */
  max: number
}

const INTEGER = (max: number): QuickCountConfig => ({ mode: 'INTEGER', max })
const HALF = (max: number): QuickCountConfig => ({ mode: 'HALF', max })

/**
 * Productnaam → snelteller.
 *
 * De maxima zijn gekozen op wat er werkelijk in een kiosk ligt, niet op de
 * hoogste norm die ergens voorkomt. Een enkele uitschieter hoort via "Meer…"
 * of via de Vol-knop te gaan; hem in de rij knoppen proppen maakt de rij voor
 * alle andere kiosken onhandig.
 */
export const QUICK_COUNT_CONFIG: Record<string, QuickCountConfig> = {
  // ── Bierbekers ─────────────────────────────────────────────────────────
  // Halve rollen komen voor; die staan al als `inputStep: HALF` in de
  // catalogus.
  'Bierbekers 0,5': HALF(5),
  'Bierbekers 0,4': HALF(5),
  'Bierbekers 0,3': HALF(5),

  // ── Chips ──────────────────────────────────────────────────────────────
  // Een halve doos chips is operationeel een echt aantal. De meeste voorraden
  // liggen tussen 0 en 6; 420 Bar telt er tien en gaat dus via Vol (10).
  'Chips Blauw': HALF(6),
  'Chips Rood': HALF(6),
  'Chips Oranje': HALF(6),

  // ── Post-mix ───────────────────────────────────────────────────────────
  // Reservepakken buiten het rek, in hele pakken — geen halve. De hoogste norm
  // is acht (Cola Zero bij de grote koelingen).
  'Coca-Cola': INTEGER(8),
  'Coca-Cola Zero': INTEGER(8),
  Fanta: INTEGER(8),
  Sprite: INTEGER(8),
  // Het Post-mixpak, nadrukkelijk niet de gekoelde "Fuze Tea" uit de drankkast.
  'Fuze Tea Peach Hibiscus': INTEGER(8),
  // Cilinders, nooit meer dan een paar.
  Koolzuur: INTEGER(3),

  // ── Koffie en thee ─────────────────────────────────────────────────────
  Koffie: INTEGER(5),
  'Cacao Zak': INTEGER(5),
  Melk: INTEGER(5),
  Suiker: INTEGER(5),
  Roerstaafjes: INTEGER(5),
  'Thee Earl Grey': INTEGER(5),
  'Thee Lemon': INTEGER(5),
  // Norm is één doosje, en een half doosje is hier een echt aantal: pas onder
  // de helft komt er een nieuw doosje bij. Vandaar de halve-knop.
  Opschuimmelk: HALF(3),
  Latiz: INTEGER(5),
  'Lavazza Cupjes': INTEGER(5),
  'Lavazza Bekers': INTEGER(5),
  // Sleeves; de norm is acht op vrijwel elke lijst.
  'Koffie Bekers': INTEGER(8),

  // ── Verpakkingen ───────────────────────────────────────────────────────
  'Rectangular Bakjes': INTEGER(5),
  'Square Bakjes': INTEGER(5),
  'Patat Bakjes': INTEGER(5),
  'Patat Vorkjes': INTEGER(5),
  // Hele dozen op de knoppen; een aangebroken doos telt af per kwart en gaat
  // via "Meer…". Het handmatige veld klapt daar vanzelf open, omdat de knoppen
  // 2,25 niet kunnen tonen.
  Biertrays: INTEGER(5),
  'Arena Blaadjes': INTEGER(5),
  'Kassa Bonnen': INTEGER(5),
  Servetten: INTEGER(6),

  // ── Schoonmaak ─────────────────────────────────────────────────────────
  Vuilniszakken: INTEGER(5),
  'Tork Rol': INTEGER(6),
  Theedoeken: INTEGER(5),
  // GFT Bak staat hier bewust niet in: die wordt na elk evenement opgehaald en
  // komt daarom helemaal niet op de tellijst. Snelknoppen voor een product dat
  // nooit geteld wordt zijn dode configuratie.

  // ── Sauzen ─────────────────────────────────────────────────────────────
  // Alleen de emmers. Normen zijn hier 5 (tweede ring) en 1 tot 2 (eerste
  // ring), dus zes knoppen dekken het.
  'Mayo Emmers': INTEGER(5),
  'Ketchup Emmers': INTEGER(5),
  // Sausflessen staan hier bewust niet in: die tellen per fles en de normen
  // liggen rond de vijftien. Vijftien knoppen is trager dan typen.
}

/**
 * De snelteller van dit product, of `undefined` voor de gewone invoer.
 *
 * Op naam, niet op id — zie de toelichting boven `QUICK_COUNT_CONFIG`.
 */
export function getQuickCountConfig(
  productName: string | null | undefined
): QuickCountConfig | undefined {
  if (!productName) return undefined
  return QUICK_COUNT_CONFIG[productName]
}
