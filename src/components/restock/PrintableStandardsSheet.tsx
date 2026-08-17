import { kioskTitle } from '@/lib/kiosk'
import { formatProductQuantity } from '@/lib/productQuantity'
import { categoryStorageNoteFor, storageNoteFor } from '@/lib/storageNotes'
import { fromQuarterUnits } from '@/lib/quarterUnits'
import type { Kiosk, Product } from '@/types'

/**
 * De bestellijst van één kiosk op één A4.
 *
 * Naar het model van de papieren lijsten die er al lagen: per soort product een
 * eigen blokje, met de norm voorgedrukt onder "Standaard" en een lege kolom
 * "Bestellen" om met de hand in te vullen.
 *
 * In twee kolommen naast elkaar, net als op het papier waar dit vandaan komt.
 * Dat is niet alleen vorm: één doorlopende tabel van vijftig regels moest zo
 * ver samengeperst worden dat hij op 8,5pt uitkwam. Naast elkaar past dezelfde
 * inhoud op ruim elf punt, met witruimte tussen de blokjes.
 *
 * Anders dan de vullijst hangt deze niet aan een vulronde. Hij komt uit de
 * normen, en die zijn er altijd — ook als er niets geteld is en er niets bij te
 * vullen valt. Dat is precies waarvoor je hem meeneemt: je loopt langs en
 * schrijft op wat er moet komen.
 */

/** Waarboven de blokjes krapper moeten om binnen één A4 te blijven. */
const COMPACT_FROM_LINES = 44

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

  // Artikelen, notitieregels, de kop van elk blokje en de kolomnamen erin
  // tellen allemaal mee voor de hoogte.
  const lineCount = withNotes.reduce(
    (sum, group) =>
      sum + 2 + group.rows.length + group.rows.filter((row) => row.note).length,
    0
  )

  return (
    <section
      className={`print-kiosk-page${lineCount >= COMPACT_FROM_LINES ? ' print-kiosk-page--compact' : ''}`}
      aria-label={`Bestellijst ${kioskTitle(kiosk)}`}
      data-sheet-index={index + 1}
      data-kiosk-number={kiosk?.number}
      data-ring={kiosk?.ringId}
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
        <div className="print-columns">
          {withNotes.map((group) => (
            /* Elk soort product een eigen blokje; `break-inside: avoid` in de
               CSS houdt zo'n blokje bij elkaar in één kolom. */
            <table key={group.categoryName} className="print-block">
              <caption className="print-block-name">{group.categoryName}</caption>
              <thead>
                <tr>
                  <th scope="col" className="print-col-product">
                    Artikel
                  </th>
                  <th scope="col" className="print-col-standard">
                    Standaard
                  </th>
                  <th scope="col" className="print-col-order">
                    Bestellen
                  </th>
                </tr>
              </thead>
              <tbody>
                {group.rows.map((row) => (
                  <tr key={row.product.id}>
                    <td className="print-col-product">
                      <span className="print-product-name">{row.product.name}</span>
                      {row.note && <span className="print-storage-note">↳ {row.note}</span>}
                    </td>
                    <td className="print-col-standard">
                      {formatProductQuantity(
                        row.product,
                        fromQuarterUnits(row.targetQuantityQuarters)
                      )}
                    </td>
                    {/* Leeg: hier schrijft de vuller op wat er moet komen. */}
                    <td className="print-col-order" />
                  </tr>
                ))}
              </tbody>
            </table>
          ))}
        </div>
      )}

      <footer className="print-stop-footer">
        <p className="print-label">Storing / opmerking</p>
        <span className="print-writeline" />
        <span className="print-writeline" />
      </footer>
    </section>
  )
}
