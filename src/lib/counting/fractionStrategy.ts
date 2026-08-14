import { FractionStrategy } from '@/types/enums'

/**
 * Welke producten een afwijkende regel hebben voor aangebroken verpakkingen.
 *
 * De algemene regel — een halve verpakking telt mee zolang de kiosk onder de
 * 80% van zijn norm zit — klopt voor vrijwel alles. Voor Biertrays niet: een
 * halve doos is tijdens een evenement zo weg, dus wie hem als voorraad meetelt
 * staat halverwege de tweede helft met lege handen. Daar telt een aangebroken
 * doos pas mee vanaf driekwart.
 *
 * Dit staat hier en niet in `calculateRestockQuantity`. Welk product hoe
 * afbreekt is een eigenschap van het product, geen rekenregel; de rekenfunctie
 * krijgt de strategie mee en blijft daarmee puur en zonder productkennis.
 *
 * ── Waarom de sleutel de productnaam is ─────────────────────────────────────
 *
 * Dezelfde reden als bij `quickCountConfig`, `storageNotes` en
 * `countingHints`: in productie is `product.id` een UUID uit de database en
 * bestaan de leesbare sleutels uit `catalogue.ts` daar niet. De naam is het
 * enige wat de app in beide modi in handen heeft.
 *
 * Dat is niet ideaal — een hernoeming laat de regel stilletjes vervallen, en
 * dit product is nu net hernoemd van "Sixpacks" naar "Biertrays". Daarom staat
 * er een test op die faalt zodra de naam hier en die in de catalogus uit elkaar
 * lopen: dan gaat de build stuk in plaats van het bijvuladvies.
 *
 * Wil je dit definitief dichtzetten, dan is een `code`-kolom op `products` de
 * structurele oplossing. Dat is een migratie en een aparte beslissing.
 */
const STRATEGY_BY_PRODUCT_NAME: Record<string, FractionStrategy> = {
  Biertrays: FractionStrategy.BREAK_AT_THREE_QUARTER,
  // De andere kant op: de norm is één doosje en een aangebroken doosje gaat
  // gewoon door. Pas onder de helft komt er een nieuw doosje bij.
  Opschuimmelk: FractionStrategy.HALF_COUNTS_FULL,
}

/** De afrondstrategie van dit product; standaard de algemene regel. */
export function fractionStrategyFor(productName: string | null | undefined): FractionStrategy {
  if (!productName) return FractionStrategy.STANDARD
  return STRATEGY_BY_PRODUCT_NAME[productName] ?? FractionStrategy.STANDARD
}

/** De namen met een afwijkende regel — voor tests en overzicht. */
export const PRODUCTS_WITH_OWN_FRACTION_RULE = Object.keys(STRATEGY_BY_PRODUCT_NAME)
