'use client'

import { use, useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { repositories } from '@/repositories'
import {
  PrintableStandardsSheet,
  type StandardsSheetGroup,
} from '@/components/restock/PrintableStandardsSheet'
import { formatDate } from '@/lib/utils'
import {
  buildStorageNoteLookup,
  EMPTY_STORAGE_NOTES,
  type StorageNoteLookup,
} from '@/lib/storageNotes'
import type { Event, Kiosk, Product, ProductCategory, Ring } from '@/types'
import '../../../print.css'

/**
 * De bestellijst op papier: één kiosk per A4.
 *
 * Naar het model van de papieren lijsten die er al lagen — per soort product
 * een blokje, de norm voorgedrukt, en een lege kolom om in te vullen wat er
 * moet komen.
 *
 * Bewust uit de normen en niet uit een vulronde. Een vulronde bestaat pas als
 * er geteld is en er ergens een tekort uitkwam; deze lijst hoort er te zijn
 * vóórdat iemand de vloer op gaat, ook als er niets gepland staat. Dat was
 * precies wat er misging: een evenement waar alles vol stond leverde geen
 * enkele pagina op.
 *
 * Leest alleen. Openen of printen verandert niets aan het evenement.
 */

interface PrintData {
  event: Event
  rings: Ring[]
  kiosks: Kiosk[]
  products: Map<string, Product>
  categories: ProductCategory[]
  /** De opmerkingen over waar de voorraad per kiosk ligt. */
  storageNotes: StorageNoteLookup
  /** kioskId → productId → norm in kwarteenheden. */
  standards: Map<string, Map<string, number>>
  /**
   * kioskId → productId → bij te vullen verpakkingen volgens de goedgekeurde
   * telling. Leeg zolang er niet geteld is.
   */
  restock: Map<string, Map<string, number>>
}

export default function EventStandardsPrintPage({
  params,
}: {
  params: Promise<{ eventId: string }>
}) {
  const { eventId } = use(params)

  const [data, setData] = useState<PrintData | null>(null)
  const [ringId, setRingId] = useState<string>('alle')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [event, kioskList, ringList, productList, categoryList, noteList] = await Promise.all([
      repositories.event().getEventById(eventId),
      repositories.kiosk().getKiosksByEvent(eventId),
      repositories.kiosk().getRings(),
      repositories.product().getProducts({ activeOnly: true }),
      repositories.product().getCategories(),
      repositories.kiosk().getStorageNotes(),
    ])
    if (!event) throw new Error(`Evenement niet gevonden: ${eventId}`)

    // Alleen de kiosken die voor dit evenement open staan; een dichte kiosk
    // krijgt geen vel.
    const open = kioskList.filter((kiosk) => kiosk.isOpenForEvent !== false)
    const ringsInUse = ringList.filter((ring) => open.some((k) => k.ringId === ring.id))

    // Eén matrixquery per ring in plaats van een normenlijst per kiosk.
    const standards = new Map<string, Map<string, number>>()
    for (const ring of ringsInUse) {
      const matrix = await repositories.product().getStandardMatrix(ring.id)
      for (const [productId, perKiosk] of Object.entries(matrix.standards)) {
        for (const standard of Object.values(perKiosk)) {
          if (!standard.isActive || standard.targetQuantityQuarters <= 0) continue
          if (!standards.has(standard.kioskId)) standards.set(standard.kioskId, new Map())
          standards.get(standard.kioskId)!.set(productId, standard.targetQuantityQuarters)
        }
      }
    }

    // Wat de goedgekeurde telling heeft opgeleverd. Bestaat die niet, dan is
    // deze lijst leeg en blijft de kolom "Vullen" open om zelf in te vullen.
    const requirements = await repositories
      .restock()
      .getRequirements(eventId)
      .catch((requirementError: unknown) => {
        console.warn('[bestellijst] Bijvulregels niet te laden.', requirementError)
        return []
      })

    const restock = new Map<string, Map<string, number>>()
    for (const requirement of requirements) {
      if (requirement.requiredPackages <= 0) continue
      if (!restock.has(requirement.kioskId)) restock.set(requirement.kioskId, new Map())
      restock.get(requirement.kioskId)!.set(requirement.productId, requirement.requiredPackages)
    }

    setData({
      event,
      rings: ringsInUse,
      kiosks: open,
      products: new Map(productList.map((p) => [p.id, p])),
      categories: categoryList,
      storageNotes: buildStorageNoteLookup(noteList),
      standards,
      restock,
    })
    setIsLoading(false)
  }, [eventId])

  useEffect(() => {
    load().catch((loadError: unknown) => {
      console.error('[bestellijst] Laden mislukt.', loadError)
      setError('De bestellijst kon niet worden geladen.')
      setIsLoading(false)
    })
  }, [load])

  const sheets = useMemo(() => {
    if (!data) return []

    // Eerst op ring en dan pas op kiosk: beide ringen tellen hun kiosken vanaf
    // sortOrder 10, dus sorteren op sortOrder alleen schoof 101 en 401 door
    // elkaar heen.
    const ringOrder = new Map(data.rings.map((ring) => [ring.id, ring.sortOrder]))
    const kiosks = data.kiosks
      .filter((kiosk) => ringId === 'alle' || kiosk.ringId === ringId)
      .filter((kiosk) => (data.standards.get(kiosk.id)?.size ?? 0) > 0)
      .sort(
        (a, b) =>
          (ringOrder.get(a.ringId) ?? 0) - (ringOrder.get(b.ringId) ?? 0) ||
          a.sortOrder - b.sortOrder
      )

    return kiosks.map((kiosk) => {
      const perProduct = data.standards.get(kiosk.id) ?? new Map<string, number>()
      const perProductRestock = data.restock.get(kiosk.id)

      // Gegroepeerd per soort product, in de volgorde van de catalogus — zoals
      // de blokjes op de papieren lijst.
      const groups: StandardsSheetGroup[] = data.categories
        .map((category) => ({
          categoryName: category.name,
          categoryId: category.id,
          // flatMap in plaats van map + filter: dan hoeft er geen typepredicaat
          // omheen om te vertellen dat het product bestaat.
          rows: [...perProduct]
            .flatMap(([productId, quarters]) => {
              const product = data.products.get(productId)
              if (!product || product.categoryId !== category.id) return []
              return [
                {
                  product,
                  targetQuantityQuarters: quarters,
                  restockPackages: perProductRestock?.get(productId),
                },
              ]
            })
            .sort((a, b) => a.product.sortOrder - b.product.sortOrder),
        }))
        .filter((group) => group.rows.length > 0)

      return { kiosk, groups }
    })
  }, [data, ringId])

  if (isLoading) {
    return <p className="no-print p-4 text-center text-gray-500">Laden…</p>
  }

  if (error || !data) {
    return (
      <div className="no-print p-4">
        <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
          {error ?? 'De bestellijst kon niet worden geladen.'}
        </p>
        <Link href={`/events/${eventId}`} className="mt-3 inline-block underline">
          ← Terug naar evenement
        </Link>
      </div>
    )
  }

  const subtitle = [
    'StockFlow — Bestellijst',
    data.event.name,
    formatDate(data.event.date),
  ].join(' · ')

  return (
    <>
      <div className="no-print flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 py-3">
        <Link href={`/events/${eventId}`} className="text-sm font-medium underline">
          ← Terug naar evenement
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-600">
            {sheets.length} {sheets.length === 1 ? 'pagina' : "pagina's"}
          </span>
          <button
            type="button"
            onClick={() => window.print()}
            className="min-h-11 rounded-xl bg-arena-red px-4 font-semibold text-white"
          >
            Printen
          </button>
        </div>
      </div>

      {/* Je print zelden allebei de ringen tegelijk: de een gaat naar de vuller
          van boven, de ander naar die van beneden. */}
      {data.rings.length > 1 && (
        <div
          role="group"
          aria-label="Welke ring"
          className="no-print flex flex-wrap gap-2 border-b border-gray-200 bg-white px-4 py-3"
        >
          {[{ id: 'alle', name: 'Beide ringen' }, ...data.rings].map((ring) => (
            <button
              key={ring.id}
              type="button"
              aria-pressed={ringId === ring.id}
              onClick={() => setRingId(ring.id)}
              className={`min-h-11 rounded-xl border px-4 font-medium ${
                ringId === ring.id
                  ? 'border-arena-red bg-red-50 text-arena-red'
                  : 'border-gray-300 bg-white text-gray-800'
              }`}
            >
              {ring.name}
            </button>
          ))}
        </div>
      )}

      <div className="print-sheet">
        {sheets.length === 0 ? (
          <p className="no-print p-4 text-center text-gray-600">
            Voor de kiosken van dit evenement staan geen normen ingesteld.
          </p>
        ) : (
          sheets.map(({ kiosk, groups }, index) => (
            <PrintableStandardsSheet
              key={kiosk.id}
              kiosk={kiosk}
              groups={groups}
              index={index}
              totalSheets={sheets.length}
              subtitle={subtitle}
              storageNotes={data?.storageNotes ?? EMPTY_STORAGE_NOTES}
            />
          ))
        )}
      </div>
    </>
  )
}
