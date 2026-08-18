import { kioskTitle } from '@/lib/kiosk'
import { formatProductQuantity } from '@/lib/productQuantity'
import { EMPTY_STORAGE_NOTES, type StorageNoteLookup } from '@/lib/storageNotes'
import type { Kiosk, Product, RestockRoundStop, RestockStopItem } from '@/types'

/**
 * Eén kiosk op één A4.
 *
 * Papier gaat mee de vloer op en wordt lopend gelezen, dus de kiosknaam staat
 * er groot op en de rest is zwart-wit en rustig. Geen kleuren, geen badges:
 * wat op een scherm rood mag zijn is op een zwart-witprinter grijs.
 *
 * Alleen presentatie. Deze component rekent niets uit en schrijft niets weg —
 * de vulronde is en blijft de bron.
 */

/**
 * Hoe dicht de regels op elkaar staan.
 *
 * Een A4 met 12mm marge is 273mm hoog. Kop, afvinkregel, opmerkingen en voet
 * kosten samen 70 tot 96mm; de rest is voor de producttabel. De ruimste kiosk
 * voert 42 producten en die moeten er alle 42 op, dus wordt de regel krapper
 * naarmate er meer zijn: 11pt bij een gewone lijst, 10pt daarboven, 9pt bij een
 * volle kiosk.
 *
 * De grenzen zijn nagemeten aan echte PDF-paginering en niet geschat: 19 ruime
 * regels werden al 278mm, vandaar dat het bij 18 terugvalt naar compact. Met de
 * dichtste stand past een vel van vijftig regels — 42 producten plus acht
 * tussenkoppen — nog binnen één A4.
 */
const COMPACT_FROM_ITEMS = 18
const DENSE_FROM_ITEMS = 30

/**
 * Meer regels dan dit passen er ook samengeperst niet op één vel.
 *
 * Gelijk aan het grootste assortiment dat één kiosk voert. Regels weglaten om
 * een pagina te halen mag niet — dan loopt er iemand met een incomplete lijst
 * rond — dus meldt de printpagina zo'n kiosk op het scherm en laat ze staan.
 */
export const MAX_ITEMS_PER_PAGE = 42

function densityClass(lineCount: number): string {
  if (lineCount >= DENSE_FROM_ITEMS) return ' print-kiosk-page--dense'
  if (lineCount >= COMPACT_FROM_ITEMS) return ' print-kiosk-page--compact'
  return ''
}

export interface PrintableRestockStopProps {
  stop: RestockRoundStop
  stopItems: RestockStopItem[]
  products: Map<string, Product>
  storageNotes?: StorageNoteLookup
  /**
   * De norm van deze kiosk per product, in hele verpakkingen.
   *
   * Staat naast het te vullen aantal, zodat op de vloer te zien is of het plan
   * klopt met wat er hoort te staan. Ontbreekt een norm, dan blijft het vakje
   * leeg — een verzonnen getal is erger dan geen getal.
   */
  standards: Map<string, number>
  kiosk: Kiosk | undefined
  /** Nulgebaseerd; op papier staat `index + 1`. */
  index: number
  totalStops: number
  previousKiosk: Kiosk | undefined
  nextKiosk: Kiosk | undefined
  roundName: string
  /** Voorgedrukt wanneer bekend; anders blijft de regel leeg om in te vullen. */
  assignedUserName?: string
}

export function PrintableRestockStop({
  stop,
  stopItems,
  products,
  storageNotes = EMPTY_STORAGE_NOTES,
  standards,
  kiosk,
  index,
  totalStops,
  previousKiosk,
  nextKiosk,
  roundName,
  assignedUserName,
}: PrintableRestockStopProps) {
  // De volgorde van de ronde is leidend; hier wordt niet opnieuw gesorteerd op
  // kiosknummer of productnaam. Wie het papier volgt loopt de geplande route.
  const rows = stopItems
    .filter((item) => item.plannedPackages > 0)
    .map((item) => {
      const product = products.get(item.productId)
      return {
        item,
        product,
        note: product
          ? (storageNotes.forProduct(kiosk?.id, product.id) ??
            storageNotes.forCategory(kiosk?.id, product.categoryId))
          : undefined,
      }
    })

  // Een regel met een opslagnotitie is twee regels hoog. Meetellen, anders
  // loopt een kiosk met veel notities alsnog over de rand van het vel.
  const lineCount = rows.length + rows.filter((row) => row.note).length

  return (
    <section
      className={`print-kiosk-page${densityClass(lineCount)}`}
      aria-label={`Stop ${index + 1}: ${kioskTitle(kiosk)}`}
      data-stop-index={index + 1}
      data-kiosk-number={kiosk?.number}
    >
      <header className="print-stop-header">
        <p className="print-stop-counter">
          Stop {index + 1} van {totalStops}
        </p>
        <h2 className="print-kiosk-name">{(kioskTitle(kiosk) || stop.kioskId).toUpperCase()}</h2>
        <p className="print-round-name">{roundName}</p>
      </header>

      {rows.length === 0 ? (
        <p className="print-empty">Voor deze kiosk staat niets gepland.</p>
      ) : (
        <table className="print-table">
          <thead>
            <tr>
              <th scope="col" className="print-col-product">
                Product
              </th>
              {/* De norm erbij: dan is op de vloer te zien of het geplande
                  aantal klopt met wat er hoort te staan. */}
              <th scope="col" className="print-col-standard">
                Standaard
              </th>
              <th scope="col" className="print-col-planned">
                Te vullen
              </th>
              <th scope="col" className="print-col-delivered">
                Geleverd
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ item, product, note }) => {
              return (
                <tr key={item.id}>
                  <td className="print-col-product">
                    {/* Volledige naam, geen shortName: papier heeft de breedte
                        en herkenbaarheid weegt hier zwaarder dan compactheid. */}
                    <span className="print-product-name">{product?.name ?? item.productId}</span>
                    {note && <span className="print-storage-note">↳ {note}</span>}
                  </td>
                  <td className="print-col-standard">
                    {product && standards.has(item.productId)
                      ? formatProductQuantity(product, standards.get(item.productId)!)
                      : ''}
                  </td>
                  <td className="print-col-planned">
                    {product
                      ? formatProductQuantity(product, item.plannedPackages)
                      : item.plannedPackages}
                  </td>
                  {/* Met de hand in te vullen wanneer er iets anders geleverd is. */}
                  <td className="print-col-delivered" />
                </tr>
              )
            })}
          </tbody>
        </table>
      )}

      <div className="print-confirm">
        <span className="print-checkbox" aria-hidden="true" />
        <span>Alles geleverd zoals gepland</span>
      </div>

      <div className="print-remarks">
        <p className="print-label">Opmerking / afwijking</p>
        <span className="print-writeline" />
        <span className="print-writeline" />
        <span className="print-writeline" />
      </div>

      <footer className="print-stop-footer">
        <p className="print-signer">
          Naam vuller: <span className="print-writeline print-writeline--inline" />
          {assignedUserName && <span className="print-signer-name">{assignedUserName}</span>}
        </p>
        <p className="print-route">
          <span>Vorige: {index === 0 ? 'Start' : kioskTitle(previousKiosk) || '—'}</span>
          <span>
            Volgende:{' '}
            {index === totalStops - 1 ? 'Einde ronde' : kioskTitle(nextKiosk) || '—'}
          </span>
        </p>
      </footer>
    </section>
  )
}
