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

export interface ProductConsumption extends ConsumptionResult {
  productId: string
  countedBeforeQuarters: number
  deliveredPackages: number
  countedAfterQuarters: number | null
}

export interface ConsumptionRow {
  kioskId: string
  products: ProductConsumption[]
  /** Som van alles wat wél te berekenen viel, in kwarteenheden. */
  totalConsumedQuarters: number
}

export interface ConsumptionSources {
  /** `kioskId:productId` → getelde kwarteenheden vóór dit evenement. */
  countedBefore: Map<string, number>
  /** `kioskId:productId` → afgeleverde verpakkingen tijdens dit evenement. */
  delivered: Map<string, number>
  /** `kioskId:productId` → getelde kwarteenheden vóór het volgende evenement. */
  countedAfter: Map<string, number> | null
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
export function buildConsumptionRows(sources: ConsumptionSources): ConsumptionRow[] {
  const { countedBefore, delivered, countedAfter } = sources

  const byKiosk = new Map<string, Map<string, ProductConsumption>>()

  const touch = (compositeKey: string) => {
    const [kioskId = '', productId = ''] = compositeKey.split(':')
    const products = byKiosk.get(kioskId) ?? new Map<string, ProductConsumption>()

    if (!products.has(productId)) {
      const countedBeforeQuarters = countedBefore.get(compositeKey) ?? 0
      const deliveredPackages = delivered.get(compositeKey) ?? 0
      const countedAfterQuarters = countedAfter ? (countedAfter.get(compositeKey) ?? 0) : null

      products.set(productId, {
        productId,
        countedBeforeQuarters,
        deliveredPackages,
        countedAfterQuarters,
        ...calculateConsumption({
          countedBeforeQuarters,
          deliveredPackages,
          countedAfterQuarters,
        }),
      })
    }

    byKiosk.set(kioskId, products)
  }

  for (const compositeKey of countedBefore.keys()) touch(compositeKey)
  for (const compositeKey of delivered.keys()) touch(compositeKey)

  return [...byKiosk].map(([kioskId, products]) => ({
    kioskId,
    products: [...products.values()],
    totalConsumedQuarters: [...products.values()].reduce(
      (sum, product) => sum + Math.max(0, product.consumedQuarters ?? 0),
      0
    ),
  }))
}
