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
 * Product-id → snelteller.
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
  'bierbeker-05': HALF(5),
  'bierbeker-04': HALF(5),
  'bierbeker-03': HALF(5),

  // ── Chips ──────────────────────────────────────────────────────────────
  // Een halve doos chips is operationeel een echt aantal. De meeste voorraden
  // liggen tussen 0 en 6; 420 Bar telt er tien en gaat dus via Vol (10).
  'chips-blauw': HALF(6),
  'chips-rood': HALF(6),
  'chips-oranje': HALF(6),

  // ── Post-mix ───────────────────────────────────────────────────────────
  // Reservepakken buiten het rek, in hele pakken — geen halve. De hoogste norm
  // is acht (Cola Zero bij de grote koelingen).
  cola: INTEGER(8),
  'cola-zero': INTEGER(8),
  fanta: INTEGER(8),
  sprite: INTEGER(8),
  'fuze-tea-peach-hibiscus': INTEGER(8),
  // Cilinders, nooit meer dan een paar.
  koolzuur: INTEGER(3),

  // ── Koffie en thee ─────────────────────────────────────────────────────
  koffie: INTEGER(5),
  'cacao-zak': INTEGER(5),
  melk: INTEGER(5),
  suiker: INTEGER(5),
  roerstaafjes: INTEGER(5),
  'thee-earl-grey': INTEGER(5),
  'thee-lemon': INTEGER(5),
  opschuimmelk: INTEGER(5),
  latiz: INTEGER(5),
  'lavazza-cupjes': INTEGER(5),
  'lavazza-bekers': INTEGER(5),
  // Sleeves; de norm is acht op vrijwel elke lijst.
  koffiebekers: INTEGER(8),

  // ── Verpakkingen ───────────────────────────────────────────────────────
  'rectangular-bakjes': INTEGER(5),
  'square-bakjes': INTEGER(5),
  'patat-bakjes': INTEGER(5),
  'patat-vorkjes': INTEGER(5),
  sixpacks: INTEGER(5),
  'arena-blaadjes': INTEGER(5),
  'kassa-bonnen': INTEGER(5),
  servetten: INTEGER(6),

  // ── Schoonmaak ─────────────────────────────────────────────────────────
  vuilniszakken: INTEGER(5),
  'tork-rol': INTEGER(6),
  theedoeken: INTEGER(5),

  // ── Sauzen ─────────────────────────────────────────────────────────────
  // Alleen de emmers. Normen zijn hier 5 (tweede ring) en 1 tot 2 (eerste
  // ring), dus zes knoppen dekken het.
  'mayo-emmers': INTEGER(5),
  'ketchup-emmers': INTEGER(5),
  // Sausflessen staan hier bewust niet in: die tellen per fles en de normen
  // liggen rond de vijftien. Vijftien knoppen is trager dan typen.
}

/** De snelteller van dit product, of `undefined` voor de gewone invoer. */
export function getQuickCountConfig(productId: string): QuickCountConfig | undefined {
  return QUICK_COUNT_CONFIG[productId]
}
