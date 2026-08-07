'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { AppHeader } from '@/components/layout/AppHeader'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/shared/EmptyState'
import { ListSkeleton } from '@/components/shared/LoadingSkeleton'
import { repositories } from '@/repositories'
import { useAuth } from '@/context/AuthContext'
import { ROUND_STATUS_LABEL, FINISHED_STATUSES, RUNNING_STATUSES } from '@/lib/roundStatus'
import { RestockRoundStatus } from '@/types'
import type { Event, Product, RestockRound, RestockRoundItem } from '@/types'

interface RoundWithItems {
  round: RestockRound
  items: RestockRoundItem[]
  eventName: string
}

export default function RestockRoundsPage() {
  const { profile } = useAuth()
  const [rounds, setRounds] = useState<RoundWithItems[]>([])
  const [products, setProducts] = useState<Map<string, Product>>(new Map())
  const [isLoading, setIsLoading] = useState(true)

  const load = useCallback(async () => {
    const [events, productList] = await Promise.all([
      repositories.event().getEvents(),
      repositories.product().getProducts({ activeOnly: false }),
    ])
    setProducts(new Map(productList.map((p) => [p.id, p])))

    const collected: RoundWithItems[] = []
    for (const event of events as Event[]) {
      for (const round of await repositories.restock().getRounds(event.id)) {
        collected.push({
          round,
          items: await repositories.restock().getRoundItems(round.id),
          eventName: event.name,
        })
      }
    }
    setRounds(collected)
    setIsLoading(false)
  }, [])

  useEffect(() => {
    load().catch((error: unknown) => {
      console.error('[vulrondes] Laden mislukt.', error)
      setIsLoading(false)
    })
  }, [load])

  const available = rounds.filter((r) => r.round.status === RestockRoundStatus.READY)
  const mine = rounds.filter(
    (r) => RUNNING_STATUSES.includes(r.round.status) && r.round.assignedUserId === profile?.id
  )
  const others = rounds.filter(
    (r) =>
      !available.includes(r) &&
      !mine.includes(r) &&
      r.round.status !== RestockRoundStatus.CANCELLED
  )

  return (
    <>
      <AppHeader title="Vulrondes" />
      <div className="space-y-5 p-4">
        {isLoading ? (
          <ListSkeleton count={3} />
        ) : rounds.length === 0 ? (
          <EmptyState
            title="Geen vulrondes"
            description="Zodra een planner een pallet heeft samengesteld, verschijnt die hier."
            icon="📦"
          />
        ) : (
          <>
            {mine.length > 0 && (
              <RoundSection title="Jouw ronde" rounds={mine} products={products} />
            )}
            <RoundSection
              title="Beschikbare vulrondes"
              rounds={available}
              products={products}
              emptyText="Er staat op dit moment geen pallet klaar."
            />
            {others.length > 0 && (
              <RoundSection title="Overige rondes" rounds={others} products={products} />
            )}
          </>
        )}
      </div>
    </>
  )
}

function RoundSection({
  title,
  rounds,
  products,
  emptyText,
}: {
  title: string
  rounds: RoundWithItems[]
  products: Map<string, Product>
  emptyText?: string
}) {
  return (
    <section aria-label={title}>
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">{title}</h3>
      {rounds.length === 0 ? (
        <p className="rounded-xl border border-gray-200 bg-white px-3 py-4 text-center text-sm text-gray-600">
          {emptyText ?? 'Niets te tonen.'}
        </p>
      ) : (
        <div className="space-y-2">
          {rounds.map(({ round, items, eventName }) => (
            <Link key={round.id} href={`/restock-rounds/${round.id}`} className="block">
              <Card className="active:bg-gray-100">
                <CardContent className="py-3">
                  <div className="mb-1 flex items-start justify-between gap-2">
                    <p className="font-semibold text-gray-900">{round.name}</p>
                    <Badge
                      variant={
                        FINISHED_STATUSES.includes(round.status)
                          ? 'success'
                          : round.status === RestockRoundStatus.READY
                            ? 'info'
                            : 'default'
                      }
                    >
                      {ROUND_STATUS_LABEL[round.status]}
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-500">{eventName}</p>
                  <ul className="mt-1.5 space-y-0.5">
                    {items.map((item) => (
                      <li key={item.id} className="flex justify-between text-sm">
                        <span className="truncate text-gray-700">
                          {products.get(item.productId)?.name ?? item.productId}
                        </span>
                        <span className="ml-2 whitespace-nowrap font-semibold text-gray-900">
                          {item.loadedPackages} {products.get(item.productId)?.packagingUnit ?? ''}
                        </span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}
