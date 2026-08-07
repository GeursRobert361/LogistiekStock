'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { kioskTitle } from '@/lib/kiosk'
import { AppHeader } from '@/components/layout/AppHeader'
import { Select } from '@/components/ui/Select'
import { EmptyState } from '@/components/shared/EmptyState'
import { ListSkeleton } from '@/components/shared/LoadingSkeleton'
import { ConsumptionBar } from '@/components/data/ConsumptionBar'
import { repositories } from '@/repositories'
import {
  findNextEvent,
  getConsumptionOverview,
  type ConsumptionOverview,
} from '@/services/consumptionService'
import { totalsByProduct } from '@/domain/analytics/consumption'
import { fromQuarterUnits, formatQuantity } from '@/lib/quarterUnits'
import { formatDate } from '@/lib/utils'
import type { Event, Kiosk, Product } from '@/types'

type ViewMode = 'PRODUCTEN' | 'KIOSKEN'

export default function DataPage() {
  return (
    <Suspense
      fallback={
        <>
          <AppHeader title="Data" />
          <div className="p-4">
            <ListSkeleton count={6} />
          </div>
        </>
      }
    >
      <DataView />
    </Suspense>
  )
}

function DataView() {
  const searchParams = useSearchParams()

  const [events, setEvents] = useState<Event[]>([])
  const [eventId, setEventId] = useState(searchParams.get('event') ?? '')
  const [overview, setOverview] = useState<ConsumptionOverview | null>(null)
  const [products, setProducts] = useState<Map<string, Product>>(new Map())
  const [kiosks, setKiosks] = useState<Map<string, Kiosk>>(new Map())
  const [mode, setMode] = useState<ViewMode>('PRODUCTEN')
  const [openId, setOpenId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Stamdata en de keuzelijst met evenementen: die veranderen hier niet.
  useEffect(() => {
    Promise.all([
      repositories.event().getEvents(),
      repositories.product().getProducts({ activeOnly: false }),
      repositories.kiosk().getKiosks(),
    ])
      .then(([eventList, productList, kioskList]) => {
        const sorted = [...eventList].sort((a, b) => b.date.localeCompare(a.date))
        setEvents(sorted)
        setProducts(new Map(productList.map((p) => [p.id, p])))
        setKiosks(new Map(kioskList.map((k) => [k.id, k])))

        // Standaard het laatste evenement waar een opvolger voor is: alleen
        // daar valt verbruik van te berekenen.
        setEventId(
          (current) =>
            current ||
            (sorted.find((event) => findNextEvent(sorted, event.id) !== null)?.id ??
              sorted[0]?.id ??
              '')
        )
      })
      .catch((loadError: unknown) => {
        console.error('[data] Laden mislukt.', loadError)
        setError('De gegevens konden niet worden geladen.')
        setIsLoading(false)
      })
  }, [])

  const loadOverview = useCallback(
    async (currentEventId: string, allEvents: Event[]) => {
      setIsLoading(true)
      const event = allEvents.find((candidate) => candidate.id === currentEventId)
      if (!event) {
        setOverview(null)
        setIsLoading(false)
        return
      }
      setOverview(await getConsumptionOverview(event, allEvents))
      setOpenId(null)
      setIsLoading(false)
    },
    []
  )

  useEffect(() => {
    if (!eventId || events.length === 0) return
    loadOverview(eventId, events).catch((loadError: unknown) => {
      console.error('[data] Verbruik berekenen mislukt.', loadError)
      setError('Het verbruik kon niet worden berekend.')
      setIsLoading(false)
    })
  }, [eventId, events, loadOverview])

  const productTotals = useMemo(
    () => totalsByProduct(overview?.rows ?? []),
    [overview]
  )

  const kioskTotals = useMemo(
    () =>
      (overview?.rows ?? [])
        .filter((row) => row.totalConsumedQuarters > 0)
        .sort((a, b) => b.totalConsumedQuarters - a.totalConsumedQuarters),
    [overview]
  )

  const event = events.find((candidate) => candidate.id === eventId)

  return (
    <>
      <AppHeader title="Data" />
      <div className="space-y-3 p-4">
        {error && (
          <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
            {error}
          </p>
        )}

        <Select
          label="Evenement"
          value={eventId}
          onChange={(e) => setEventId(e.target.value)}
          options={events.map((option) => ({
            value: option.id,
            label: `${option.name} — ${formatDate(option.date)}`,
          }))}
        />

        {isLoading ? (
          <ListSkeleton count={6} />
        ) : !event ? (
          <EmptyState title="Geen evenementen" icon="📊" />
        ) : overview?.blocker ? (
          <EmptyState title="Nog geen verbruik" description={BLOCKER_TEXT[overview.blocker]} icon="⏳" />
        ) : (
          <>
            <div className="rounded-xl bg-gray-50 px-3 py-3">
              <p className="text-sm text-gray-700">
                Verbruikt tijdens <strong>{event.name}</strong>, gemeten met de telling van{' '}
                <strong>{overview?.nextEvent?.name}</strong>.
              </p>
              <p className="mt-1 text-xs text-gray-600">
                Wat er stond + wat er is bijgevuld − wat er daarna nog stond. Balken zijn binnen
                één lijst te vergelijken; de eenheid verschilt per product.
              </p>
            </div>

            <fieldset>
              <legend className="sr-only">Weergave</legend>
              <div className="grid grid-cols-2 gap-2">
                {(['PRODUCTEN', 'KIOSKEN'] as ViewMode[]).map((value) => (
                  <label
                    key={value}
                    className={`flex min-h-11 cursor-pointer items-center justify-center rounded-xl border text-sm font-medium ${
                      mode === value
                        ? 'border-arena-red bg-red-50 text-arena-red'
                        : 'border-gray-300 bg-white text-gray-800'
                    }`}
                  >
                    <input
                      type="radio"
                      name="mode"
                      value={value}
                      checked={mode === value}
                      onChange={() => {
                        setMode(value)
                        setOpenId(null)
                      }}
                      className="sr-only"
                    />
                    {value === 'PRODUCTEN' ? 'Per product' : 'Per kiosk'}
                  </label>
                ))}
              </div>
            </fieldset>

            {mode === 'PRODUCTEN' ? (
              productTotals.length === 0 ? (
                <EmptyState title="Niets verbruikt" description="Er ging niets doorheen." icon="📊" />
              ) : (
                <div className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 bg-white">
                  {productTotals.map((total) => {
                    const product = products.get(total.productId)
                    const isOpen = openId === total.productId
                    const max = productTotals[0]!.consumedQuarters
                    return (
                      <div key={total.productId}>
                        <ConsumptionBar
                          label={product?.name ?? total.productId}
                          sublabel={`${total.perKiosk.length} ${
                            total.perKiosk.length === 1 ? 'kiosk' : 'kiosken'
                          }`}
                          value={`${formatQuantity(fromQuarterUnits(total.consumedQuarters))} ${
                            product?.packagingUnit ?? ''
                          }`}
                          amount={total.consumedQuarters}
                          max={max}
                          isOpen={isOpen}
                          onClick={() => setOpenId(isOpen ? null : total.productId)}
                        />
                        {isOpen && (
                          <div className="divide-y divide-gray-100 border-t border-gray-100 bg-gray-50 pl-3">
                            {total.perKiosk.map((entry) => (
                              <ConsumptionBar
                                key={entry.kioskId}
                                label={kioskTitle(kiosks.get(entry.kioskId)) || entry.kioskId}
                                value={formatQuantity(fromQuarterUnits(entry.consumedQuarters))}
                                amount={entry.consumedQuarters}
                                max={total.perKiosk[0]!.consumedQuarters}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            ) : kioskTotals.length === 0 ? (
              <EmptyState title="Niets verbruikt" description="Er ging niets doorheen." icon="📊" />
            ) : (
              <div className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 bg-white">
                {kioskTotals.map((row) => {
                  const isOpen = openId === row.kioskId
                  const max = kioskTotals[0]!.totalConsumedQuarters
                  const perProduct = row.products
                    .filter((item) => (item.consumedQuarters ?? 0) > 0)
                    .sort((a, b) => (b.consumedQuarters ?? 0) - (a.consumedQuarters ?? 0))

                  return (
                    <div key={row.kioskId}>
                      <ConsumptionBar
                        label={kioskTitle(kiosks.get(row.kioskId)) || row.kioskId}
                        sublabel={`${perProduct.length} producten`}
                        value={formatQuantity(fromQuarterUnits(row.totalConsumedQuarters))}
                        amount={row.totalConsumedQuarters}
                        max={max}
                        isOpen={isOpen}
                        onClick={() => setOpenId(isOpen ? null : row.kioskId)}
                      />
                      {isOpen && (
                        <div className="divide-y divide-gray-100 border-t border-gray-100 bg-gray-50 pl-3">
                          {perProduct.map((item) => (
                            <ConsumptionBar
                              key={item.productId}
                              label={products.get(item.productId)?.name ?? item.productId}
                              value={`${formatQuantity(
                                fromQuarterUnits(item.consumedQuarters ?? 0)
                              )} ${products.get(item.productId)?.packagingUnit ?? ''}`}
                              amount={item.consumedQuarters ?? 0}
                              max={perProduct[0]!.consumedQuarters ?? 1}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}

const BLOCKER_TEXT: Record<string, string> = {
  GEEN_TELLING: 'Voor dit evenement is nog geen telling goedgekeurd.',
  GEEN_VOLGEND_EVENEMENT:
    'Verbruik blijkt uit de telling vóór het volgende evenement. Zodra dat er is, staat het hier.',
  VOLGENDE_NIET_GETELD:
    'Het volgende evenement staat er wel, maar daar is nog niet geteld. Na die telling staat het verbruik hier.',
}
