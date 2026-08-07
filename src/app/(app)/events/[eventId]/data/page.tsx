'use client'

import { use, useCallback, useEffect, useState } from 'react'
import { kioskTitle } from '@/lib/kiosk'
import { AppHeader } from '@/components/layout/AppHeader'
import { Card, CardContent } from '@/components/ui/Card'
import { Select } from '@/components/ui/Select'
import { EmptyState } from '@/components/shared/EmptyState'
import { ListSkeleton } from '@/components/shared/LoadingSkeleton'
import { repositories } from '@/repositories'
import { getConsumptionOverview, type ConsumptionOverview } from '@/services/consumptionService'
import { fromQuarterUnits, formatQuantity } from '@/lib/quarterUnits'
import type { Event, Kiosk, Product, Ring } from '@/types'

export default function EventDataPage({
  params,
}: {
  params: Promise<{ eventId: string }>
}) {
  const { eventId } = use(params)

  const [event, setEvent] = useState<Event | null>(null)
  const [overview, setOverview] = useState<ConsumptionOverview | null>(null)
  const [products, setProducts] = useState<Map<string, Product>>(new Map())
  const [kiosks, setKiosks] = useState<Map<string, Kiosk>>(new Map())
  const [rings, setRings] = useState<Ring[]>([])
  const [ringFilter, setRingFilter] = useState('')
  const [expandedKioskId, setExpandedKioskId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [events, productList, kioskList, ringList] = await Promise.all([
      repositories.event().getEvents(),
      repositories.product().getProducts({ activeOnly: false }),
      repositories.kiosk().getKiosks(),
      repositories.kiosk().getRings(),
    ])

    const found = events.find((candidate) => candidate.id === eventId) ?? null
    setEvent(found)
    setProducts(new Map(productList.map((p) => [p.id, p])))
    setKiosks(new Map(kioskList.map((k) => [k.id, k])))
    setRings(ringList)

    if (found) setOverview(await getConsumptionOverview(found, events))
    setIsLoading(false)
  }, [eventId])

  useEffect(() => {
    load().catch((loadError: unknown) => {
      console.error('[verbruik] Laden mislukt.', loadError)
      setError('Het verbruik kon niet worden berekend.')
      setIsLoading(false)
    })
  }, [load])

  if (isLoading) {
    return (
      <>
        <AppHeader title="Verbruik" backHref={`/events/${eventId}`} />
        <div className="p-4">
          <ListSkeleton count={5} />
        </div>
      </>
    )
  }

  if (!event) {
    return (
      <>
        <AppHeader title="Verbruik" backHref="/events" />
        <div className="p-4">
          <EmptyState title="Evenement niet gevonden" icon="❌" />
        </div>
      </>
    )
  }

  const rows = (overview?.rows ?? [])
    .filter((row) => !ringFilter || kiosks.get(row.kioskId)?.ringId === ringFilter)
    .sort((a, b) => (kiosks.get(a.kioskId)?.sortOrder ?? 0) - (kiosks.get(b.kioskId)?.sortOrder ?? 0))

  return (
    <>
      <AppHeader title="Verbruik" backHref={`/events/${eventId}`} />
      <div className="space-y-3 p-4">
        {error && (
          <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
            {error}
          </p>
        )}

        <div className="rounded-xl bg-gray-50 px-3 py-3">
          <p className="font-semibold text-gray-900">{event.name}</p>
          <p className="text-sm text-gray-600">
            Verbruikt = wat er stond + wat er is bijgevuld − wat er bij de volgende telling nog
            stond.
          </p>
        </div>

        {overview?.blocker ? (
          <EmptyState title="Nog geen verbruik" description={BLOCKER_TEXT[overview.blocker]} icon="⏳" />
        ) : (
          <>
            <p className="text-sm text-gray-600">
              Afgesloten met de telling van <strong>{overview?.nextEvent?.name}</strong>.
            </p>

            {rings.length > 1 && (
              <Select
                label="Ring"
                value={ringFilter}
                onChange={(e) => setRingFilter(e.target.value)}
                options={[
                  { value: '', label: 'Alle ringen' },
                  ...rings.map((ring) => ({ value: ring.id, label: ring.name })),
                ]}
              />
            )}

            {rows.length === 0 ? (
              <EmptyState title="Geen cijfers" description="Voor deze ring is niets geteld." icon="📊" />
            ) : (
              <div className="space-y-2">
                {rows.map((row) => {
                  const isOpen = expandedKioskId === row.kioskId
                  return (
                    <Card key={row.kioskId}>
                      <CardContent className="py-0">
                        <button
                          type="button"
                          onClick={() => setExpandedKioskId(isOpen ? null : row.kioskId)}
                          aria-expanded={isOpen}
                          className="flex min-h-14 w-full items-center justify-between gap-2 py-3 text-left"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-gray-900">
                              {kioskTitle(kiosks.get(row.kioskId)) || row.kioskId}
                            </p>
                            <p className="text-xs text-gray-600">
                              {row.products.length} producten
                            </p>
                          </div>
                          <div className="flex flex-shrink-0 items-center gap-2">
                            <span className="text-lg font-bold text-gray-900">
                              {formatQuantity(fromQuarterUnits(row.totalConsumedQuarters))}
                            </span>
                            <span aria-hidden="true" className="text-gray-400">
                              {isOpen ? '▲' : '▼'}
                            </span>
                          </div>
                        </button>

                        {isOpen && (
                          <div className="overflow-x-auto pb-3">
                            <table className="min-w-full text-sm">
                              <thead>
                                <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                                  <th className="py-1 pr-3 font-semibold">Product</th>
                                  <th className="py-1 pr-3 text-right font-semibold">Stond</th>
                                  <th className="py-1 pr-3 text-right font-semibold">Bij</th>
                                  <th className="py-1 pr-3 text-right font-semibold">Over</th>
                                  <th className="py-1 text-right font-semibold">Verbruikt</th>
                                </tr>
                              </thead>
                              <tbody>
                                {row.products
                                  .slice()
                                  .sort(
                                    (a, b) =>
                                      (products.get(a.productId)?.sortOrder ?? 0) -
                                      (products.get(b.productId)?.sortOrder ?? 0)
                                  )
                                  .map((item) => (
                                    <tr key={item.productId} className="border-t border-gray-100">
                                      <td className="py-1.5 pr-3 text-gray-900">
                                        {products.get(item.productId)?.shortName ?? item.productId}
                                      </td>
                                      <td className="py-1.5 pr-3 text-right text-gray-600">
                                        {formatQuantity(
                                          fromQuarterUnits(item.countedBeforeQuarters)
                                        )}
                                      </td>
                                      <td className="py-1.5 pr-3 text-right text-gray-600">
                                        {item.deliveredPackages}
                                      </td>
                                      <td className="py-1.5 pr-3 text-right text-gray-600">
                                        {item.countedAfterQuarters === null
                                          ? '—'
                                          : formatQuantity(
                                              fromQuarterUnits(item.countedAfterQuarters)
                                            )}
                                      </td>
                                      <td className="py-1.5 text-right font-bold text-gray-900">
                                        {item.consumedQuarters === null
                                          ? '—'
                                          : formatQuantity(fromQuarterUnits(item.consumedQuarters))}
                                        {item.isImplausible && (
                                          <span
                                            className="ml-1 text-amber-700"
                                            title="Er bleef meer over dan er ooit stond — buiten de app bijgevuld of een telling klopt niet."
                                          >
                                            ⚠
                                          </span>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </CardContent>
                    </Card>
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
    'Het volgende evenement is er wel, maar daar is nog niet geteld. Na die telling staat het verbruik hier.',
}
