import { toQuarterUnits } from '@/lib/quarterUnits'

/**
 * Verbruik per evenement.
 *
 * Er wordt niet geteld ná een wedstrijd, alleen ervoor. Wat er tijdens een
 * evenement doorheen is gegaan, blijkt dus pas uit de telling vóór het
 * volgende:
 *
 *     verbruikt = wat er stond + wat erbij is gevuld − wat er daarna nog stond
 *
 * Alles in kwarteenheden, want dat is de enige eenheid waarin de tellingen
 * exact zijn. Leveringen staan in hele verpakkingen en worden omgerekend.
 */

export interface ConsumptionInput {
  /** Telling vóór dit evenement, in kwarteenheden. */
  countedBeforeQuarters: number
  /** Wat de vuller tijdens dit evenement heeft afgeleverd, in verpakkingen. */
  deliveredPackages: number
  /**
   * Telling vóór het volgende evenement, in kwarteenheden. `null` wanneer daar
   * nog niet geteld is — dan is het verbruik simpelweg nog niet bekend.
   */
  countedAfterQuarters: number | null
}

export interface ConsumptionResult {
  /** Verbruik in kwarteenheden, of null zolang de volgende telling ontbreekt. */
  consumedQuarters: number | null
  /** Wat er bij aanvang stond: telling plus levering. */
  availableQuarters: number
  /**
   * Gezet wanneer er méér is overgebleven dan er ooit stond. Dat kan niet van
   * verkoop komen; er is dan buiten de app om bijgevuld, of een telling klopt
   * niet. Het getal blijft staan zoals het is — stil corrigeren zou het
   * probleem juist verbergen.
   */
  isImplausible: boolean
}

export function calculateConsumption(input: ConsumptionInput): ConsumptionResult {
  const { countedBeforeQuarters, deliveredPackages, countedAfterQuarters } = input

  const availableQuarters = countedBeforeQuarters + toQuarterUnits(deliveredPackages)

  if (countedAfterQuarters === null) {
    return { consumedQuarters: null, availableQuarters, isImplausible: false }
  }

  const consumedQuarters = availableQuarters - countedAfterQuarters
  return {
    consumedQuarters,
    availableQuarters,
    isImplausible: consumedQuarters < 0,
  }
}

/**
 * Hoe hard het cijfer is.
 *
 * Een ontbrekende volgende telling werd hiervoor als nul gelezen: "er staat
 * niets meer, dus alles is op". Maar een ontbrekende regel kan van alles
 * betekenen — de kiosk was dicht, de teller sloeg hem over, of het product zit
 * niet meer in het assortiment. Alleen wat we echt geteld hebben mag als
 * verbruik doorgaan.
 */
export type ConsumptionConfidence =
  | 'KNOWN'
  | 'NEXT_COUNT_MISSING'
  | 'KIOSK_SKIPPED'
  | 'ASSORTMENT_CHANGED'
  | 'IMPLAUSIBLE'

export const CONSUMPTION_CONFIDENCE_LABEL: Record<ConsumptionConfidence, string> = {
  KNOWN: 'Gemeten',
  NEXT_COUNT_MISSING: 'Onbekend — niet opnieuw geteld',
  KIOSK_SKIPPED: 'Onbekend — kiosk niet geteld',
  ASSORTMENT_CHANGED: 'Onbekend — product niet meer in het assortiment',
  IMPLAUSIBLE: 'Voorraadverschil',
}

/** Alleen hier valt een betrouwbaar verbruik uit af te lezen. */
export function isReliable(consumption: ProductConsumption): boolean {
  return consumption.confidence === 'KNOWN'
}

export interface ProductConsumption extends ConsumptionResult {
  productId: string
  countedBeforeQuarters: number
  deliveredPackages: number
  countedAfterQuarters: number | null
  confidence: ConsumptionConfidence
}

export interface ConsumptionRow {
  kioskId: string
  products: ProductConsumption[]
  /** Som van alleen de betrouwbaar gemeten regels, in kwarteenheden. */
  totalConsumedQuarters: number
  /** Regels waar een hard getal uit komt. */
  knownCount: number
  /** Regels waarvan het verbruik niet vast te stellen is. */
  unknownCount: number
  /** Regels waar méér stond dan er kon staan. */
  implausibleCount: number
}

export interface ConsumptionSources {
  /** `kioskId:productId` → getelde kwarteenheden vóór dit evenement. */
  countedBefore: Map<string, number>
  /** `kioskId:productId` → afgeleverde verpakkingen tijdens dit evenement. */
  delivered: Map<string, number>
  /**
   * `kioskId:productId` → getelde kwarteenheden vóór het volgende evenement.
   * `null` wanneer daar nog helemaal niet geteld is.
   *
   * Een ontbrekende sleutel is níet nul: die combinatie is simpelweg niet
   * geteld.
   */
  countedAfter: Map<string, number> | null
  /**
   * Kiosken met een afgeronde telling bij het volgende evenement. Wat hier niet
   * in staat was dicht of overgeslagen.
   *
   * Weggelaten betekent "onbekend welke kiosken geteld zijn"; dan wordt er geen
   * uitspraak over de kiosk gedaan.
   */
  countedKioskIdsAfter?: Set<string>
  /**
   * `kioskId:productId`-combinaties met een actieve norm bij het volgende
   * evenement. Wat hier niet in staat hoort er niet meer te staan.
   */
  activeStandardsAfter?: Set<string>
}

export function key(kioskId: string, productId: string): string {
  return `${kioskId}:${productId}`
}

/**
 * Zet de losse bronnen om in één regel per kiosk.
 *
 * Een product telt mee zodra het in één van de bronnen voorkomt: ook een kiosk
 * die alleen bijgevuld is (telling nul) heeft verbruik.
 */
export interface ProductTotal {
  productId: string
  /** Verbruik over alle kiosken heen, in kwarteenheden. */
  consumedQuarters: number
  /** Aflopend: waar ging het meeste doorheen. */
  perKiosk: Array<{ kioskId: string; consumedQuarters: number }>
}

/**
 * Verbruik per product, opgeteld over de kiosken.
 *
 * Alleen betrouwbaar gemeten regels tellen mee. Een onbekende regel als nul
 * meenemen zou het totaal te laag maken zonder dat iemand het ziet; een
 * onmogelijk negatieve uitkomst zou het totaal juist naar beneden trekken. Bij
 * de regel zelf blijft beide onvertaald zichtbaar.
 */
export function totalsByProduct(rows: ConsumptionRow[]): ProductTotal[] {
  const byProduct = new Map<string, ProductTotal>()

  for (const row of rows) {
    for (const product of row.products) {
      if (!isReliable(product) || product.consumedQuarters === null) continue
      const consumed = product.consumedQuarters
      if (consumed === 0) continue

      const total = byProduct.get(product.productId) ?? {
        productId: product.productId,
        consumedQuarters: 0,
        perKiosk: [],
      }
      total.consumedQuarters += consumed
      total.perKiosk.push({ kioskId: row.kioskId, consumedQuarters: consumed })
      byProduct.set(product.productId, total)
    }
  }

  for (const total of byProduct.values()) {
    total.perKiosk.sort((a, b) => b.consumedQuarters - a.consumedQuarters)
  }

  return [...byProduct.values()].sort((a, b) => b.consumedQuarters - a.consumedQuarters)
}

/**
 * Waarom er geen hard getal is — of dat er juist wel is.
 *
 * De volgorde is de volgorde van de oorzaken: eerst of er überhaupt geteld is,
 * dan of díe kiosk geteld is, dan of het product er nog hoort te staan.
 */
function resolveConfidence(params: {
  compositeKey: string
  kioskId: string
  hasCount: boolean
  isImplausible: boolean
  sources: ConsumptionSources
}): ConsumptionConfidence {
  const { compositeKey, kioskId, hasCount, isImplausible, sources } = params

  if (hasCount) return isImplausible ? 'IMPLAUSIBLE' : 'KNOWN'
  if (sources.countedAfter === null) return 'NEXT_COUNT_MISSING'
  if (sources.countedKioskIdsAfter && !sources.countedKioskIdsAfter.has(kioskId)) {
    return 'KIOSK_SKIPPED'
  }
  if (sources.activeStandardsAfter && !sources.activeStandardsAfter.has(compositeKey)) {
    return 'ASSORTMENT_CHANGED'
  }
  return 'NEXT_COUNT_MISSING'
}

export function buildConsumptionRows(sources: ConsumptionSources): ConsumptionRow[] {
  const { countedBefore, delivered, countedAfter } = sources

  const byKiosk = new Map<string, Map<string, ProductConsumption>>()

  const touch = (compositeKey: string) => {
    const [kioskId = '', productId = ''] = compositeKey.split(':')
    const products = byKiosk.get(kioskId) ?? new Map<string, ProductConsumption>()

    if (!products.has(productId)) {
      const countedBeforeQuarters = countedBefore.get(compositeKey) ?? 0
      const deliveredPackages = delivered.get(compositeKey) ?? 0

      // Een ontbrekende sleutel is niet nul maar onbekend. Nul zou betekenen
      // "leeg aangetroffen", en dat is een heel ander verhaal dan "niet geteld".
      const hasCount = countedAfter?.has(compositeKey) ?? false
      const countedAfterQuarters = hasCount ? (countedAfter?.get(compositeKey) ?? null) : null

      const result = calculateConsumption({
        countedBeforeQuarters,
        deliveredPackages,
        countedAfterQuarters,
      })

      products.set(productId, {
        productId,
        countedBeforeQuarters,
        deliveredPackages,
        countedAfterQuarters,
        ...result,
        confidence: resolveConfidence({
          compositeKey,
          kioskId,
          hasCount,
          isImplausible: result.isImplausible,
          sources,
        }),
      })
    }

    byKiosk.set(kioskId, products)
  }

  for (const compositeKey of countedBefore.keys()) touch(compositeKey)
  for (const compositeKey of delivered.keys()) touch(compositeKey)

  return [...byKiosk].map(([kioskId, products]) => {
    const list = [...products.values()]
    return {
      kioskId,
      products: list,
      totalConsumedQuarters: list.reduce(
        (sum, product) => sum + (isReliable(product) ? (product.consumedQuarters ?? 0) : 0),
        0
      ),
      knownCount: list.filter(isReliable).length,
      unknownCount: list.filter((product) => product.consumedQuarters === null).length,
      implausibleCount: list.filter((product) => product.confidence === 'IMPLAUSIBLE').length,
    }
  })
}
