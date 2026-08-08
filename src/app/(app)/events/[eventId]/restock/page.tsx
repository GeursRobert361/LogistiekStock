'use client'

import { use, useCallback, useEffect, useMemo, useState } from 'react'
import { kioskTitle } from '@/lib/kiosk'
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
  type RingRestockOverview,
} from '@/services/restockPlanningService'
import { ROUND_STATUS_LABEL } from '@/lib/roundStatus'
import type { Kiosk, Product, RestockRound, Ring } from '@/types'

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
  const [rings, setRings] = useState<Map<string, Ring>>(new Map())
  const [rounds, setRounds] = useState<RestockRound[]>([])
  const [expandedKey, setExpandedKey] = useState<string | null>(null)
  /** Selectie voor een gemengde pallet, per ring apart bijgehouden. */
  const [selectedByRing, setSelectedByRing] = useState<Map<string, Set<string>>>(new Map())
  const [isLoading, setIsLoading] = useState(true)
  const [isWorking, setIsWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [productList, kioskList, ringList, roundList] = await Promise.all([
      repositories.product().getProducts({ activeOnly: false }),
      repositories.kiosk().getKiosks(),
      repositories.kiosk().getRings(),
      repositories.restock().getRounds(eventId),
    ])

    const productMap = new Map(productList.map((p) => [p.id, p]))
    setProducts(productMap)
    setKiosks(new Map(kioskList.map((k) => [k.id, k])))
    setRings(new Map(ringList.map((r) => [r.id, r])))
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

  const activeRoundCount = useMemo(() => rounds.filter(isRoundActive).length, [rounds])

  /** Ringen met werk, in de volgorde waarin ze in het stadion liggen. */
  const ringSections = useMemo(() => {
    if (!overview) return []
    return [...overview.byRing.values()].sort((a, b) => {
      const left = rings.get(a.ringId)
      const right = rings.get(b.ringId)
      return (left?.sortOrder ?? 0) - (right?.sortOrder ?? 0)
    })
  }, [overview, rings])

  function ringName(ringId: string): string {
    return rings.get(ringId)?.name ?? 'Onbekende ring'
  }

  async function handleCreateProductRound(ringId: string, productId: string) {
    const product = products.get(productId)
    if (!profile || !product) return

    setIsWorking(true)
    setError(null)
    try {
      const round = await createProductRound({
        eventId,
        ringId,
        ringName: ringName(ringId),
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

  async function handleCreateMixedPallet(ringId: string) {
    // De selectie hoort bij één ring; producten uit een andere ring kunnen hier
    // dus niet op terechtkomen. Een pallet rijdt door één ring.
    const productIds = [...(selectedByRing.get(ringId) ?? [])]
    if (!profile || productIds.length === 0) return

    setIsWorking(true)
    setError(null)
    try {
      const round = await createMixedPalletRound({
        eventId,
        ringId,
        ringName: ringName(ringId),
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

  function toggleForPallet(ringId: string, productId: string) {
    setSelectedByRing((previous) => {
      const next = new Map(previous)
      const forRing = new Set(next.get(ringId) ?? [])
      if (forRing.has(productId)) forRing.delete(productId)
      else forRing.add(productId)
      next.set(ringId, forRing)
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

  return (
    <>
      <AppHeader title="Vulplanning" backHref={`/events/${eventId}`} />
      <div className="space-y-5 p-4">
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
                    <CardContent className="flex items-center justify-between gap-2 py-3">
                      <p className="min-w-0 truncate font-medium text-gray-900">{round.name}</p>
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

        {ringSections.length === 0 ? (
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
          ringSections.map((ring) => (
            <RingSection
              key={ring.ringId}
              ring={ring}
              name={ringName(ring.ringId)}
              kiosks={kiosks}
              expandedKey={expandedKey}
              onToggleExpand={setExpandedKey}
              selected={selectedByRing.get(ring.ringId) ?? new Set()}
              onToggleSelect={(productId) => toggleForPallet(ring.ringId, productId)}
              isWorking={isWorking}
              onCreateProductRound={(productId) =>
                void handleCreateProductRound(ring.ringId, productId)
              }
              onCreateMixedPallet={() => void handleCreateMixedPallet(ring.ringId)}
            />
          ))
        )}
      </div>
    </>
  )
}

interface RingSectionProps {
  ring: RingRestockOverview
  name: string
  kiosks: Map<string, Kiosk>
  expandedKey: string | null
  onToggleExpand: (key: string | null) => void
  selected: Set<string>
  onToggleSelect: (productId: string) => void
  isWorking: boolean
  onCreateProductRound: (productId: string) => void
  onCreateMixedPallet: () => void
}

/**
 * Alles van één ring bij elkaar.
 *
 * De ring staat boven de aantallen en niet ergens in een detailregel: met een
 * pallet in de hand is dat het eerste wat je moet weten.
 */
function RingSection({
  ring,
  name,
  kiosks,
  expandedKey,
  onToggleExpand,
  selected,
  onToggleSelect,
  isWorking,
  onCreateProductRound,
  onCreateMixedPallet,
}: RingSectionProps) {
  const totalPackages = [...ring.byProduct.values()].reduce(
    (sum, demand) => sum + demand.total,
    0
  )

  return (
    <section aria-labelledby={`ring-${ring.ringId}`} className="space-y-3">
      <div className="border-b-2 border-arena-red pb-1">
        <h2 id={`ring-${ring.ringId}`} className="text-lg font-bold text-gray-900">
          {name}
        </h2>
        <p className="text-xs text-gray-600">
          {ring.byProduct.size} {ring.byProduct.size === 1 ? 'product' : 'producten'} ·{' '}
          {totalPackages} open
        </p>
      </div>

      {ring.productRoundItems.length > 0 && (
        <div>
          <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-gray-500">
            Eigen ronde
          </h3>
          <p className="mb-2 text-xs text-gray-600">Grote aantallen die een hele pallet vullen.</p>

          <div className="space-y-2">
            {ring.productRoundItems.map((item) => {
              const key = `${ring.ringId}:${item.product.id}`
              const isExpanded = expandedKey === key
              return (
                <Card key={key}>
                  <CardContent className="py-3">
                    <button
                      type="button"
                      onClick={() => onToggleExpand(isExpanded ? null : key)}
                      aria-expanded={isExpanded}
                      className="flex w-full items-start justify-between gap-2 text-left"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900">{item.product.name}</p>
                        <p className="text-sm text-gray-600">
                          {item.totalRequiredPackages} {item.product.packagingUnit} ·{' '}
                          {item.affectedKioskIds.length} kiosken · {name}
                        </p>
                        {item.ownRoundReason && (
                          <p className="mt-0.5 text-xs text-gray-500">
                            {OWN_ROUND_REASON_LABEL[item.ownRoundReason]}
                          </p>
                        )}
                      </div>
                      <span aria-hidden="true" className="text-gray-400">
                        {isExpanded ? '▲' : '▼'}
                      </span>
                    </button>

                    {isExpanded && (
                      <ul className="mt-2 divide-y divide-gray-100 rounded-lg bg-gray-50">
                        {(ring.byProduct.get(item.product.id)?.perKiosk ?? []).map((entry) => (
                          <li
                            key={entry.kioskId}
                            className="flex justify-between px-3 py-1.5 text-sm"
                          >
                            <span className="text-gray-700">
                              {kioskTitle(kiosks.get(entry.kioskId)) || entry.kioskId}
                            </span>
                            <span className="font-semibold text-gray-900">{entry.packages}</span>
                          </li>
                        ))}
                      </ul>
                    )}

                    <Button
                      size="md"
                      className="mt-3 w-full"
                      disabled={isWorking}
                      onClick={() => onCreateProductRound(item.product.id)}
                    >
                      Productronde maken
                    </Button>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {ring.mixedPalletItems.length > 0 && (
        <div>
          <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-gray-500">
            Gemengde pallet
          </h3>
          <p className="mb-2 text-xs text-gray-600">
            Kies de producten die samen op één pallet gaan. Alles hier hoort bij {name}.
          </p>

          <div className="space-y-1">
            {ring.mixedPalletItems.map((item) => {
              const isSelected = selected.has(item.product.id)
              return (
                <label
                  key={item.product.id}
                  className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 ${
                    isSelected ? 'border-arena-red bg-red-50' : 'border-gray-200 bg-white'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onToggleSelect(item.product.id)}
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
            disabled={isWorking || selected.size === 0}
            onClick={onCreateMixedPallet}
          >
            {selected.size === 0
              ? 'Selecteer producten voor een pallet'
              : `Pallet maken voor ${name} (${selected.size} producten)`}
          </Button>
        </div>
      )}
    </section>
  )
}

const OWN_ROUND_REASON_LABEL: Record<string, string> = {
  PRODUCT_INSTELLING: 'Dit product krijgt altijd een eigen ronde',
  AANTAL: 'Aantal boven de drempel voor een eigen ronde',
  PALLETBELASTING: 'Vult naar schatting een hele pallet',
}
