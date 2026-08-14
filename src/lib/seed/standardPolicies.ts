import { DrinkStorageType } from '@/types'
import { KIOSKS_WITH_DRINKS_FRIDGE } from './assortment'

/**
 * Afspraken die boven de bronlijsten uit gaan.
 *
 * Een norm komt normaal uit een bron: de papieren bestellijst, een latere
 * handmatige stocklijst, of het richtaantal van `assortmentForKiosk`. Dit is
 * iets anders — geen waarneming van wat er ligt, maar een afspraak over wat er
 * hoort te liggen, ongeacht wat welke lijst zegt.
 *
 * Waarom hier en niet in de bronnen zelf:
 *
 *   1. `PAPER_STANDARDS` hoort te zeggen wat er op papier stond, en daar
 *      bestaat die lijst voor. Wie hem naast het papier legt moet dezelfde
 *      getallen zien.
 *   2. Het is één afspraak, geen drieëntwintig losse besluiten. Zo staat hij
 *      ook als één regel in de code, en is hij met één getal te wijzigen.
 *   3. Een nieuwe kiosk of een nieuwe lijst valt er vanzelf onder, en het geldt
 *      voor allebei de ringen — de eerste ring draait nog op richtaantallen.
 *
 * Ze worden toegepast in `demoData`, op de ene plek waar beide bronnen
 * samenkomen. Niet in allebei apart: twee uitvoeringen van dezelfde regel
 * worden er vroeg of laat twee die uit elkaar lopen.
 */

// ─── Waar een product mag staan ───────────────────────────────────────────

/**
 * Staat er bij dit telpunt een koeling?
 *
 * Twee bronnen, want de twee ringen weten dit op verschillende manieren. Voor
 * de tweede ring is `drinkStorageType` opgegeven vanaf de vloer. Voor de eerste
 * ring is dat nog niet gebeurd — die staat overal op `NONE`, de veilige
 * uitgangswaarde — en zit de kennis in `KIOSKS_WITH_DRINKS_FRIDGE` van het
 * assortimentsmodel. Alleen naar het opslagtype kijken zou de acht gekoelde
 * eerste-ringkiosken hun koffie afnemen.
 *
 * De twee spreken elkaar niet tegen: `KIOSKS_WITH_DRINKS_FRIDGE` noemt voor de
 * tweede ring exact dezelfde negen locaties die `LARGE_COOLER` hebben.
 *
 * Let op het verschil met `countsChilledDrinks`: die kent een uitzondering voor
 * een telpunt met een eigen authoritative stocklijst (Ziggo Platform). Dat gaat
 * over wie er drank als voorraad telt, niet over of er een koelkast staat —
 * bij Ziggo staat er juist géén. Voor een product dat gekoeld bewaard moet
 * worden telt alleen dat laatste.
 */
export function hasCooling(kiosk: {
  number: number
  drinkStorageType: DrinkStorageType
}): boolean {
  if (kiosk.drinkStorageType === DrinkStorageType.LARGE_COOLER) return true
  return KIOSKS_WITH_DRINKS_FRIDGE.has(kiosk.number)
}

/**
 * Producten die gekoeld bewaard moeten worden en dus een koeling vereisen.
 *
 * Koffie hoort in de koeling. Bij een telpunt zonder koeling kan het er dus
 * niet staan, en een norm die dat toch beweert klopt niet — ook niet als een
 * oudere lijst hem zo opschreef. Die norm gaat weg in plaats van dat er elke
 * ronde koffie gebracht wordt naar een plek waar hij bederft.
 *
 * Alleen `koffie`. De rest van de koffiehoek — melk, opschuimmelk, cacao, thee —
 * is hier bewust niet aan toegevoegd; daar is niets over gezegd, en zelf
 * bedenken welke producten nog meer een koeling nodig hebben is precies het
 * soort gok waar deze stamdata niet tegen kan.
 */
export const REQUIRES_COOLING_PRODUCT_IDS: ReadonlySet<string> = new Set(['koffie'])

/** Mag dit telpunt dit product voeren? */
export function mayStock(
  kiosk: { number: number; drinkStorageType: DrinkStorageType },
  productId: string
): boolean {
  if (!REQUIRES_COOLING_PRODUCT_IDS.has(productId)) return true
  return hasCooling(kiosk)
}

// ─── Hoeveel er moet liggen ───────────────────────────────────────────────

/**
 * Normen die overal hetzelfde zijn, wat een lijst er ook van zegt.
 *
 * Opschuimmelk: één doosje per telpunt. Meer heeft niemand nodig — een
 * aangebroken doosje gaat gewoon door, en pas onder de helft komt er een nieuw
 * bij. Dat laatste zit in `FractionStrategy.HALF_COUNTS_FULL` en niet hier: dit
 * gaat over hoeveel er moet liggen, dat over wanneer er bijgevuld wordt.
 */
export const FIXED_STANDARDS: Record<string, number> = {
  opschuimmelk: 1,
}

/**
 * Ondergrenzen: minstens zoveel, meer mag.
 *
 * Vuilniszakken: het papier zegt bij de tweede ring overal één rol en het
 * richtaantal van de eerste ring twee, en dat is te weinig gebleken. Een rol is
 * tijdens een evenement zo op, en dan staat er een volle bak in een kiosk die
 * niets heeft om hem mee te legen. Drie is de afspraak.
 *
 * Staat een bron al hoger, dan blijft die staan: Ziggo Platform heeft drie
 * rollen uit zijn eigen stocklijst, en een kiosk die er ooit vijf krijgt houdt
 * er vijf.
 */
export const MINIMUM_STANDARDS: Record<string, number> = {
  vuilniszakken: 3,
}

/** Eén kandidaat-norm, vóór de afspraken hierboven. */
export interface StandardCandidate {
  productId: string
  target: number
}

/**
 * De normen zoals ze werkelijk gelden, met de afspraken erop.
 *
 * **Verhoogt, verlaagt en verwijdert; voegt nooit iets toe.** Een kiosk die een
 * product niet voert krijgt er geen norm bij. Geen norm betekent in deze
 * stamdata dat het er niet ligt, en een afspraak over hoeveelheden hoort dat
 * niet stilzwijgend om te draaien — dat zou vulopdrachten opleveren voor
 * voorraad waar niemand om gevraagd heeft. Dat geldt met name voor een product
 * dat een lijst expliciet op 0 heeft gezet: dat is een besluit om het niet te
 * voeren, en dat wint.
 */
export function effectiveStandards(
  kiosk: { number: number; drinkStorageType: DrinkStorageType },
  candidates: readonly StandardCandidate[]
): StandardCandidate[] {
  return candidates
    .filter((candidate) => mayStock(kiosk, candidate.productId))
    .map((candidate) => ({
      productId: candidate.productId,
      target: effectiveTarget(candidate.productId, candidate.target),
    }))
}

/** De norm van één product, met vaste waarde en ondergrens erop. */
export function effectiveTarget(productId: string, target: number): number {
  const vast = FIXED_STANDARDS[productId]
  const minimum = MINIMUM_STANDARDS[productId]

  return Math.max(vast ?? target, minimum ?? 0)
}
