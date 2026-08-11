/**
 * Normen die te laag blijken.
 *
 * Een te hoge norm verraadt zichzelf: bij de volgende telling staat er veel,
 * en het telscherm zet de norm ernaast. Een te lage norm verraadt zichzelf
 * niet — een kiosk die halverwege leegloopt telt op nul, en een kiosk die
 * precies genoeg had telt óók op nul. Zonder dit signaal worden alleen de te
 * ruime normen gevonden, en schuift het assortiment ongemerkt naar krap.
 *
 * De regel: een norm van 6 verpakkingen of meer waarbij er bij de telling
 * minder dan 3 overstonden, was vermoedelijk te laag.
 *
 * De normgrens is niet willekeurig. Van de actieve normen is 87% gelijk aan 3
 * of lager; een product met norm 1 kan er nooit 3 laten staan. Zonder die grens
 * zou de lijst voor het overgrote deel uit ruis bestaan en daarmee onleesbaar
 * zijn.
 */

/** 3 verpakkingen. Minder dan dit over is te krap. */
export const MIN_LEFTOVER_QUARTERS = 12

/** 6 verpakkingen. Daaronder zegt een restant van 3 niets. */
export const MIN_NORM_QUARTERS = 24

export type LeftoverVerdict = 'TOO_LOW' | 'OK' | 'NOT_APPLICABLE'

export interface LeftoverInput {
  targetQuantityQuarters: number
  /**
   * Wat er bij de telling nog stond. `null` wanneer er niet geteld is — en dat
   * is nadrukkelijk niet hetzelfde als 0, want nul betekent "leeg aangetroffen".
   */
  countedQuantityQuarters: number | null
  /** Een norm die uit staat hoort er niet meer te staan; leeg is dan de bedoeling. */
  isStandardActive: boolean
  /**
   * Het restant zegt alleen iets over de vorige wedstrijd als die er was. Bij
   * de eerste telling van een kiosk staat er niets omdat er nog nooit iets
   * stond.
   */
  hasPreviousEvent: boolean
}

/**
 * Bij twijfel geen signaal. Liever een te lage norm gemist dan een lijst die na
 * drie keer vals alarm niemand meer leest.
 */
export function judgeLeftover(input: LeftoverInput): LeftoverVerdict {
  if (!input.isStandardActive) return 'NOT_APPLICABLE'
  if (!input.hasPreviousEvent) return 'NOT_APPLICABLE'
  if (input.countedQuantityQuarters === null) return 'NOT_APPLICABLE'
  if (input.targetQuantityQuarters < MIN_NORM_QUARTERS) return 'NOT_APPLICABLE'

  return input.countedQuantityQuarters < MIN_LEFTOVER_QUARTERS ? 'TOO_LOW' : 'OK'
}

export interface LeftoverSignal {
  kioskId: string
  productId: string
  targetQuantityQuarters: number
  leftoverQuarters: number
}

export interface LeftoverSource {
  kioskId: string
  productId: string
  targetQuantityQuarters: number
  countedQuantityQuarters: number | null
  isStandardActive: boolean
}

/**
 * De signalen uit een afgeronde telling, het krapst eerst — nul is erger dan
 * twee, en wie de lijst van boven leest ziet eerst wat het meest misging.
 */
export function collectLeftoverSignals(
  sources: LeftoverSource[],
  options: { hasPreviousEvent: boolean }
): LeftoverSignal[] {
  const signals: LeftoverSignal[] = []

  for (const source of sources) {
    const verdict = judgeLeftover({
      targetQuantityQuarters: source.targetQuantityQuarters,
      countedQuantityQuarters: source.countedQuantityQuarters,
      isStandardActive: source.isStandardActive,
      hasPreviousEvent: options.hasPreviousEvent,
    })
    if (verdict !== 'TOO_LOW') continue

    signals.push({
      kioskId: source.kioskId,
      productId: source.productId,
      targetQuantityQuarters: source.targetQuantityQuarters,
      leftoverQuarters: source.countedQuantityQuarters ?? 0,
    })
  }

  return signals.sort(
    (a, b) =>
      a.leftoverQuarters - b.leftoverQuarters ||
      b.targetQuantityQuarters - a.targetQuantityQuarters
  )
}
