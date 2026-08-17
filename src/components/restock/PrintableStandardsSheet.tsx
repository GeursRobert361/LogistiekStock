import { kioskTitle } from '@/lib/kiosk'
import { formatProductQuantity } from '@/lib/productQuantity'
import { categoryStorageNoteFor, storageNoteFor } from '@/lib/storageNotes'
import { fromQuarterUnits } from '@/lib/quarterUnits'
import type { Kiosk, Product } from '@/types'

/**
 * De bestellijst van één kiosk op één A4.
 *
 * Naar het model van de papieren lijsten die er al lagen: per soort product een
 * blokje, met de norm voorgedrukt onder "Standaard" en een lege kolom
 * "Bestellen" om met de hand in te vullen.
 *
 * Anders dan de vullijst hangt deze niet aan een vulronde. Hij komt uit de
 * normen, en die zijn er altijd — ook als er niets geteld is en er niets bij
 * te vullen valt. Dat is precies waarvoor je hem meeneemt: je loopt langs en
 * schrijft op wat er moet komen.
 */

/** Zie `PrintableRestockStop`: dezelfde gemeten grenzen, dezelfde A4. */
const COMPACT_FROM_LINES = 18
const DENSE_FROM_LINES = 30

export interface StandardsSheetRow {
  product: Product
  /** De norm in kwarteenheden, zoals hij in de stamdata staat. */
  targetQuantityQuarters: number
}

export interface StandardsSheetGroup {
  categoryName: string
  rows: StandardsSheetRow[]
}

export interface PrintableStandardsSheetProps {
  kiosk: Kiosk | undefined
  groups: StandardsSheetGroup[]
  /** Nulgebaseerd; op papier staat `index + 1`. */
  index: number
  totalSheets: number
  /** Eén regel onder de kiosknaam: waar dit vel bij hoort. */
  subtitle: string
}

function densityClass(lineCount: number): string {
  if (lineCount >= DENSE_FROM_LINES) return ' print-kiosk-page--dense'
  if (lineCount >= COMPACT_FROM_LINES) return ' print-kiosk-page--compact'
  return ''
}

export function PrintableStandardsSheet({
  kiosk,
  groups,
  index,
  totalSheets,
  subtitle,
}: PrintableStandardsSheetProps) {
  const withNotes = groups.map((group) => ({
    ...group,
    rows: group.rows.map((row) => ({
      ...row,
      note:
        storageNoteFor(kiosk, row.product) ??
        categoryStorageNoteFor(kiosk, group.categoryName),
    })),
  }))

  // Productregels, notitieregels en de kop van elk blokje tellen allemaal mee
  // voor de hoogte van het vel.
  const lineCount = withNotes.reduce(
    (sum, group) =>
      sum + 1 + group.rows.length + group.rows.filter((row) => row.note).length,
    0
  )

  return (
    <section
      className={`print-kiosk-page${densityClass(lineCount)}`}
      aria-label={`Bestellijst ${kioskTitle(kiosk)}`}
      data-sheet-index={index + 1}
      data-kiosk-number={kiosk?.number}
    >
      <header className="print-stop-header">
        <p className="print-stop-counter">
          Bestellijst · blad {index + 1} van {totalSheets}
        </p>
        <h2 className="print-kiosk-name">{kioskTitle(kiosk).toUpperCase()}</h2>
        <p className="print-round-name">{subtitle}</p>
      </header>

      {withNotes.length === 0 ? (
        <p className="print-empty">Voor deze kiosk staan geen normen ingesteld.</p>
      ) : (
        <table className="print-table">
          <thead>
            <tr>
              <th scope="col" className="print-col-product">
                Artikel
              </th>
              <th scope="col" className="print-col-planned">
                Standaard
              </th>
              <th scope="col" className="print-col-delivered">
                Bestellen
              </th>
            </tr>
          </thead>
          {withNotes.map((group) => (
            <tbody key={group.categoryName}>
              <tr className="print-group-row">
                {/* Het soort product als tussenkop, zoals op de papieren lijst
                    de blokjes per soort. */}
                <th scope="colgroup" colSpan={3} className="print-group-name">
                  {group.categoryName}
                </th>
              </tr>
              {group.rows.map((row) => (
                <tr key={row.product.id}>
                  <td className="print-col-product">
                    <span className="print-product-name">{row.product.name}</span>
                    {row.note && <span className="print-storage-note">↳ {row.note}</span>}
                  </td>
                  <td className="print-col-planned">
                    {formatProductQuantity(
                      row.product,
                      fromQuarterUnits(row.targetQuantityQuarters)
                    )}
                  </td>
                  {/* Leeg: hier schrijft de vuller op wat er moet komen. */}
                  <td className="print-col-delivered" />
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      )}

      <div className="print-remarks">
        <p className="print-label">Storing / opmerking</p>
        <span className="print-writeline" />
        <span className="print-writeline" />
      </div>

      <footer className="print-stop-footer">
        <p className="print-signer">
          Naam: <span className="print-writeline print-writeline--inline" />
        </p>
      </footer>
    </section>
  )
}
