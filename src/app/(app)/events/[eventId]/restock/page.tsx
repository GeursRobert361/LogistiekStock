'use client'

import { use, useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AppHeader } from '@/components/layout/AppHeader'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/shared/EmptyState'
import { repositories } from '@/repositories'
import { useAuth } from '@/context/AuthContext'
import {
  createMixedPalletRound,
  createProductRound,
  getRestockOverview,
  isRoundActive,
  type RestockOverview,
} from '@/services/restockPlanningService'
import { ROUND_STATUS_LABEL } from '@/lib/roundStatus'
import type { Kiosk, Product, RestockRound } from '@/types'

export default function RestockPlanningPage({
  params,
}: {
  params: Promise<{ eventId: string }>
}) {
  const { eventId } = use(params)
  const { profile } = useAuth()
  const router = useRouter()

  const [overview, setOverview] = useState<RestockOverview | null>(null)
  const [products, setProducts] = useState<Map<string, Product>>(new Map())
  const [kiosks, setKiosks] = useState<Map<string, Kiosk>>(new Map())
  const [rounds, setRounds] = useState<RestockRound[]>([])
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null)
  const [selectedForPallet, setSelectedForPallet] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(true)
  const [isWorking, setIsWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [productList, kioskList, roundList] = await Promise.all([
      repositories.product().getProducts({ activeOnly: false }),
      repositories.kiosk().getKiosks(),
      repositories.restock().getRounds(eventId),
    ])

    const productMap = new Map(productList.map((p) => [p.id, p]))
    setProducts(productMap)
    setKiosks(new Map(kioskList.map((k) => [k.id, k])))
    setRounds(roundList)
    setOverview(await getRestockOverview(eventId, productMap))
    setIsLoading(false)
  }, [eventId])

  useEffect(() => {
    load().catch((loadError: unknown) => {
      console.error('[vulplanning] Laden mislukt.', loadError)
      setError('De vulplanning kon niet worden geladen.')
      setIsLoading(false)
    })
  }, [load])

  /** Ring van een product bepalen we uit de kiosken waar vraag is. */
  const ringForProduct = useCallback(
    (productId: string): string | null => {
      const perKiosk = overview?.byProduct.get(productId)?.perKiosk ?? []
      for (const entry of perKiosk) {
        const kiosk = kiosks.get(entry.kioskId)
        if (kiosk) return kiosk.ringId
      }
      return null
    },
    [overview, kiosks]
  )

  const activeRoundCount = useMemo(() => rounds.filter(isRoundActive).length, [rounds])

  async function handleCreateProductRound(productId: string) {
    const product = products.get(productId)
    const ringId = ringForProduct(productId)
    if (!profile || !product || !ringId) return

    setIsWorking(true)
    setError(null)
    try {
      const round = await createProductRound({
        eventId,
        ringId,
        productId,
        productName: product.name,
        createdById: profile.id,
      })
      router.push(`/restock-rounds/${round.id}`)
    } catch (createError) {
      console.error('[vulplanning] Productronde maken mislukt.', createError)
      setError(createError instanceof Error ? createError.message : 'Ronde maken is mislukt.')
      setIsWorking(false)
    }
  }

  async function handleCreateMixedPallet() {
    const productIds = [...selectedForPallet]
    const ringId = productIds.map(ringForProduct).find((id): id is string => id !== null)
    if (!profile || productIds.length === 0 || !ringId) return

    setIsWorking(true)
    setError(null)
    try {
      const round = await createMixedPalletRound({
        eventId,
        ringId,
        productIds,
        createdById: profile.id,
        sequenceNumber: rounds.length + 1,
      })
      router.push(`/restock-rounds/${round.id}`)
    } catch (createError) {
      console.error('[vulplanning] Gemengde pallet maken mislukt.', createError)
      setError(createError instanceof Error ? createError.message : 'Pallet maken is mislukt.')
      setIsWorking(false)
    }
  }

  function toggleForPallet(productId: string) {
    setSelectedForPallet((previous) => {
      const next = new Set(previous)
      if (next.has(productId)) {
        next.delete(productId)
      } else {
        next.add(productId)
      }
      return next
    })
  }

  if (isLoading) {
    return (
      <>
        <AppHeader title="Vulplanning" backHref={`/events/${eventId}`} />
        <div className="p-4 text-center text-gray-500">Laden…</div>
      </>
    )
  }

  const hasOpenWork =
    (overview?.productRoundItems.length ?? 0) + (overview?.mixedPalletItems.length ?? 0) > 0

  return (
    <>
      <AppHeader title="Vulplanning" backHref={`/events/${eventId}`} />
      <div className="space-y-4 p-4">
        {error && (
          <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
            {error}
          </p>
        )}

        {rounds.length > 0 && (
          <section aria-labelledby="rounds-heading">
            <h3
              id="rounds-heading"
              className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500"
            >
              Vulrondes ({activeRoundCount} actief)
            </h3>
            <div className="space-y-1">
              {rounds.map((round) => (
                <Link key={round.id} href={`/restock-rounds/${round.id}`} className="block">
                  <Card className="active:bg-gray-100">
                    <CardContent className="flex items-center justify-between py-3">
                      <p className="font-medium text-gray-900">{round.name}</p>
                      <Badge variant={round.status === 'COMPLETED' ? 'success' : 'info'}>
                        {ROUND_STATUS_LABEL[round.status]}
                      </Badge>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        )}

        {!hasOpenWork ? (
          <EmptyState
            title="Niets meer te plannen"
            description={
              rounds.length > 0
                ? 'Alle tekorten zijn ingepland of geleverd.'
                : 'Keur eerst een telling goed; daarna verschijnen hier de tekorten.'
            }
            icon="✅"
          />
        ) : (
          <>
            {/* ── Productrondes ────────────────────────────────────────── */}
            {overview!.productRoundItems.length > 0 && (
              <section aria-labelledby="product-rounds-heading">
                <h3
                  id="product-rounds-heading"
                  className="mb-1 text-sm font-semibold uppercase tracking-wide text-gray-500"
                >
                  Eigen ronde
                </h3>
                <p className="mb-2 text-xs text-gray-600">
                  Grote aantallen die een hele pallet vullen.
                </p>

                <div className="space-y-2">
                  {overview!.productRoundItems.map((item) => (
                    <Card key={item.product.id}>
                      <CardContent className="py-3">
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedProductId(
                              expandedProductId === item.product.id ? null : item.product.id
                            )
                          }
                          aria-expanded={expandedProductId === item.product.id}
                          className="flex w-full items-start justify-between gap-2 text-left"
                        >
                          <div className="min-w-0">
                            <p className="font-semibold text-gray-900">{item.product.name}</p>
                            <p className="text-sm text-gray-600">
                              Totaal: {item.totalRequiredPackages} {item.product.packagingUnit} ·{' '}
                              {item.affectedKioskIds.length} kiosken
                            </p>
                            {item.ownRoundReason && (
                              <p className="mt-0.5 text-xs text-gray-500">
                                {OWN_ROUND_REASON_LABEL[item.ownRoundReason]}
                              </p>
                            )}
                          </div>
                          <span aria-hidden="true" className="text-gray-400">
                            {expandedProductId === item.product.id ? '▲' : '▼'}
                          </span>
                        </button>

                        {expandedProductId === item.product.id && (
                          <ul className="mt-2 divide-y divide-gray-100 rounded-lg bg-gray-50">
                            {(overview!.byProduct.get(item.product.id)?.perKiosk ?? []).map(
                              (entry) => (
                                <li
                                  key={entry.kioskId}
                                  className="flex justify-between px-3 py-1.5 text-sm"
                                >
                                  <span className="text-gray-700">
                                    Kiosk {kiosks.get(entry.kioskId)?.number ?? entry.kioskId}
                                  </span>
                                  <span className="font-semibold text-gray-900">
                                    {entry.packages}
                                  </span>
                                </li>
                              )
                            )}
                          </ul>
                        )}

                        <Button
                          size="md"
                          className="mt-3 w-full"
                          disabled={isWorking}
                          onClick={() => void handleCreateProductRound(item.product.id)}
                        >
                          Productronde maken
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            )}

            {/* ── Gemengde pallet ──────────────────────────────────────── */}
            {overview!.mixedPalletItems.length > 0 && (
              <section aria-labelledby="mixed-heading">
                <h3
                  id="mixed-heading"
                  className="mb-1 text-sm font-semibold uppercase tracking-wide text-gray-500"
                >
                  Gemengde pallet
                </h3>
                <p className="mb-2 text-xs text-gray-600">
                  Kies de producten die samen op één pallet gaan.
                </p>

                <div className="space-y-1">
                  {overview!.mixedPalletItems.map((item) => {
                    const isSelected = selectedForPallet.has(item.product.id)
                    return (
                      <label
                        key={item.product.id}
                        className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 ${
                          isSelected
                            ? 'border-arena-red bg-red-50'
                            : 'border-gray-200 bg-white'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleForPallet(item.product.id)}
                          className="h-5 w-5 flex-shrink-0 accent-arena-red"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium text-gray-900">
                            {item.product.name}
                          </span>
                          <span className="block text-xs text-gray-600">
                            {item.affectedKioskIds.length} kiosken
                          </span>
                        </span>
                        <span className="whitespace-nowrap text-lg font-bold text-gray-900">
                          {item.totalRequiredPackages}
                        </span>
                      </label>
                    )
                  })}
                </div>

                <Button
                  size="lg"
                  className="mt-3 w-full"
                  disabled={isWorking || selectedForPallet.size === 0}
                  onClick={() => void handleCreateMixedPallet()}
                >
                  {selectedForPallet.size === 0
                    ? 'Selecteer producten voor een pallet'
                    : `Pallet maken (${selectedForPallet.size} producten)`}
                </Button>
              </section>
            )}
          </>
        )}
      </div>
    </>
  )
}

const OWN_ROUND_REASON_LABEL: Record<string, string> = {
  PRODUCT_INSTELLING: 'Dit product krijgt altijd een eigen ronde',
  AANTAL: 'Aantal boven de drempel voor een eigen ronde',
  PALLETBELASTING: 'Vult naar schatting een hele pallet',
}
