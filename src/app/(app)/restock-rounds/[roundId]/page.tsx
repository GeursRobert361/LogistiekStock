'use client'

import { use, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AppHeader } from '@/components/layout/AppHeader'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { ConfirmDialog } from '@/components/ui/Dialog'
import { EmptyState } from '@/components/shared/EmptyState'
import { repositories } from '@/repositories'
import { useAuth } from '@/context/AuthContext'
import { claimRound, setLoadedQuantities, startRound, cancelRound } from '@/services/restockPlanningService'
import { completeRound, getRoundPlan, getNextStop, type RoundPlan } from '@/services/deliveryService'
import { ROUND_STATUS_LABEL } from '@/lib/roundStatus'
import { RestockRoundStatus, UserRole } from '@/types'
import type { Kiosk, Product } from '@/types'

export default function RestockRoundDetailPage({
  params,
}: {
  params: Promise<{ roundId: string }>
}) {
  const { roundId } = use(params)
  const { profile, hasAnyRole } = useAuth()
  const router = useRouter()

  const [plan, setPlan] = useState<RoundPlan | null>(null)
  const [products, setProducts] = useState<Map<string, Product>>(new Map())
  const [kiosks, setKiosks] = useState<Map<string, Kiosk>>(new Map())
  const [loadedInput, setLoadedInput] = useState<Map<string, string>>(new Map())
  const [isLoading, setIsLoading] = useState(true)
  const [isWorking, setIsWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [showCompleteDialog, setShowCompleteDialog] = useState(false)

  const canPlan = hasAnyRole([UserRole.PLANNER, UserRole.ADMIN])

  const load = useCallback(async () => {
    const [roundPlan, productList, kioskList] = await Promise.all([
      getRoundPlan(roundId),
      repositories.product().getProducts({ activeOnly: false }),
      repositories.kiosk().getKiosks(),
    ])
    setPlan(roundPlan)
    setProducts(new Map(productList.map((p) => [p.id, p])))
    setKiosks(new Map(kioskList.map((k) => [k.id, k])))
    setLoadedInput(
      new Map(roundPlan.items.map((item) => [item.productId, String(item.loadedPackages)]))
    )
    setIsLoading(false)
  }, [roundId])

  useEffect(() => {
    load().catch((loadError: unknown) => {
      console.error('[vulronde] Laden mislukt.', loadError)
      setError('De vulronde kon niet worden geladen.')
      setIsLoading(false)
    })
  }, [load])

  async function handleConfirmLoad() {
    if (!plan) return
    setIsWorking(true)
    setError(null)
    try {
      const loaded = new Map<string, number>()
      for (const item of plan.items) {
        const raw = (loadedInput.get(item.productId) ?? '').replace(',', '.').trim()
        const value = raw === '' ? 0 : Number(raw)
        if (!Number.isFinite(value) || value < 0 || !Number.isInteger(value)) {
          throw new Error('Vul per product een heel aantal verpakkingen in.')
        }
        loaded.set(item.productId, value)
      }
      if ([...loaded.values()].every((value) => value === 0)) {
        throw new Error('Er is niets geladen — vul minstens één aantal in.')
      }

      await setLoadedQuantities(roundId, loaded)
      await load()
    } catch (loadError) {
      console.error('[vulronde] Laden vastleggen mislukt.', loadError)
      setError(loadError instanceof Error ? loadError.message : 'Opslaan is mislukt.')
    } finally {
      setIsWorking(false)
    }
  }

  async function handleClaim() {
    if (!profile) return
    setIsWorking(true)
    try {
      await claimRound(roundId, profile.id)
      await startRound(roundId)
      const refreshed = await getRoundPlan(roundId)
      const next = getNextStop(refreshed)
      if (next) {
        router.push(`/restock-rounds/${roundId}/stop/${next.id}`)
      } else {
        await load()
      }
    } catch (claimError) {
      console.error('[vulronde] Ronde aannemen mislukt.', claimError)
      setError('De ronde kon niet worden aangenomen.')
      setIsWorking(false)
    }
  }

  async function handleComplete() {
    setShowCompleteDialog(false)
    setIsWorking(true)
    try {
      await completeRound(roundId)
      await load()
    } catch (completeError) {
      console.error('[vulronde] Afronden mislukt.', completeError)
      setError('De ronde kon niet worden afgerond.')
    } finally {
      setIsWorking(false)
    }
  }

  async function handleCancel() {
    setShowCancelDialog(false)
    setIsWorking(true)
    try {
      await cancelRound(roundId)
      router.push('/restock-rounds')
    } catch (cancelError) {
      console.error('[vulronde] Annuleren mislukt.', cancelError)
      setError('De ronde kon niet worden geannuleerd.')
      setIsWorking(false)
    }
  }

  if (isLoading) {
    return (
      <>
        <AppHeader title="Vulronde" backHref="/restock-rounds" />
        <div className="p-4 text-center text-gray-500">Laden…</div>
      </>
    )
  }

  if (!plan) {
    return (
      <>
        <AppHeader title="Vulronde" backHref="/restock-rounds" />
        <div className="p-4">
          <EmptyState title="Vulronde niet gevonden" icon="❌" />
        </div>
      </>
    )
  }

  const { round } = plan
  const isPicking = round.status === RestockRoundStatus.PICKING
  const isReady = round.status === RestockRoundStatus.READY
  const isRunning =
    round.status === RestockRoundStatus.CLAIMED || round.status === RestockRoundStatus.IN_PROGRESS
  const nextStop = getNextStop(plan)

  return (
    <>
      <AppHeader title={round.name} backHref="/restock-rounds" />
      <div className="space-y-4 p-4">
        <div className="flex items-center justify-between">
          <Badge variant={round.status === RestockRoundStatus.COMPLETED ? 'success' : 'info'}>
            {ROUND_STATUS_LABEL[round.status]}
          </Badge>
          {plan.stops.length > 0 && (
            <span className="text-sm text-gray-600">
              {plan.completedStops} van {plan.stops.length} kiosken
            </span>
          )}
        </div>

        {error && (
          <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
            {error}
          </p>
        )}

        {/* ── Pallet laden ─────────────────────────────────────────────── */}
        {isPicking && (
          <section aria-labelledby="load-heading">
            <h2 id="load-heading" className="mb-1 text-lg font-bold text-gray-900">
              Pallet laden
            </h2>
            <p className="mb-3 text-sm text-gray-600">
              Vul in wat er werkelijk op de pallet gaat. Dat aantal is leidend voor de route.
            </p>

            <div className="space-y-2">
              {plan.items.map((item) => {
                const product = products.get(item.productId)
                return (
                  <Card key={item.id}>
                    <CardContent className="py-3">
                      <p className="font-semibold text-gray-900">
                        {product?.name ?? item.productId}
                      </p>
                      <p className="mb-2 text-sm text-gray-600">
                        Nodig: {item.proposedPackages} {product?.packagingUnit ?? ''}
                      </p>
                      <label
                        htmlFor={`loaded-${item.productId}`}
                        className="mb-1 block text-sm font-medium text-gray-700"
                      >
                        Geladen
                      </label>
                      <input
                        id={`loaded-${item.productId}`}
                        type="text"
                        inputMode="numeric"
                        value={loadedInput.get(item.productId) ?? ''}
                        onChange={(e) =>
                          setLoadedInput((previous) =>
                            new Map(previous).set(item.productId, e.target.value)
                          )
                        }
                        className="h-14 w-full rounded-xl border border-gray-300 text-center text-2xl font-bold text-gray-900 focus:border-arena-red focus:outline-none focus:ring-2 focus:ring-arena-red/30"
                      />
                    </CardContent>
                  </Card>
                )
              })}
            </div>

            <Button
              size="lg"
              className="mt-3 w-full"
              disabled={isWorking}
              onClick={() => void handleConfirmLoad()}
            >
              {isWorking ? 'Bezig…' : 'Route maken →'}
            </Button>
          </section>
        )}

        {/* ── Lading ───────────────────────────────────────────────────── */}
        {!isPicking && (
          <section aria-labelledby="cargo-heading">
            <h3
              id="cargo-heading"
              className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500"
            >
              Op de pallet
            </h3>
            <div className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 bg-white">
              {plan.items.map((item) => {
                const product = products.get(item.productId)
                const remaining = plan.remainingByProduct.get(item.productId) ?? 0
                return (
                  <div key={item.id} className="flex items-center justify-between px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-gray-900">
                        {product?.name ?? item.productId}
                      </p>
                      <p className="text-xs text-gray-600">
                        Geladen {item.loadedPackages} · geleverd {item.deliveredPackages}
                      </p>
                    </div>
                    <p className="ml-2 whitespace-nowrap text-sm font-bold text-gray-900">
                      nog {remaining}
                    </p>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* ── Route ────────────────────────────────────────────────────── */}
        {plan.stops.length > 0 && (
          <section aria-labelledby="route-heading">
            <h3
              id="route-heading"
              className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500"
            >
              Route ({plan.stops.length} kiosken)
            </h3>
            <div className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 bg-white">
              {plan.stops.map((stop, index) => {
                const stopItems = plan.stopItems.filter((i) => i.restockRoundStopId === stop.id)
                const content = (
                  <div className="flex min-h-14 items-center justify-between px-4 py-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900">
                        {index + 1}. Kiosk {kiosks.get(stop.kioskId)?.number ?? stop.kioskId}
                      </p>
                      <p className="truncate text-xs text-gray-600">
                        {stopItems
                          .map(
                            (item) =>
                              `${products.get(item.productId)?.shortName ?? item.productId} ${item.plannedPackages}`
                          )
                          .join(' · ')}
                      </p>
                    </div>
                    <span
                      className={`ml-2 whitespace-nowrap text-sm font-medium ${
                        stop.completedAt ? 'text-green-700' : 'text-gray-500'
                      }`}
                    >
                      {stop.completedAt ? '✓ Klaar' : '○ Open'}
                    </span>
                  </div>
                )

                return isRunning ? (
                  <Link key={stop.id} href={`/restock-rounds/${roundId}/stop/${stop.id}`}>
                    {content}
                  </Link>
                ) : (
                  <div key={stop.id}>{content}</div>
                )
              })}
            </div>
          </section>
        )}

        {/* ── Acties ───────────────────────────────────────────────────── */}
        <div className="space-y-2">
          {isReady && (
            <Button size="lg" className="w-full" disabled={isWorking} onClick={() => void handleClaim()}>
              Ronde aannemen en starten →
            </Button>
          )}

          {isRunning && nextStop && (
            <Link href={`/restock-rounds/${roundId}/stop/${nextStop.id}`} className="block">
              <Button size="lg" className="w-full">
                Verder — kiosk {kiosks.get(nextStop.kioskId)?.number ?? ''}
              </Button>
            </Link>
          )}

          {isRunning && !nextStop && (
            <Button size="lg" className="w-full" onClick={() => setShowCompleteDialog(true)}>
              Vulronde afronden ✓
            </Button>
          )}

          {canPlan && (isPicking || isReady) && (
            <Button
              variant="outline"
              size="md"
              className="w-full"
              onClick={() => setShowCancelDialog(true)}
            >
              Ronde annuleren
            </Button>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={showCancelDialog}
        onClose={() => setShowCancelDialog(false)}
        onConfirm={() => void handleCancel()}
        isDestructive
        title="Ronde annuleren"
        message="De gereserveerde voorraad komt weer beschikbaar in de vulplanning."
        confirmLabel="Annuleren"
        cancelLabel="Terug"
      />

      <ConfirmDialog
        open={showCompleteDialog}
        onClose={() => setShowCompleteDialog(false)}
        onConfirm={() => void handleComplete()}
        title="Vulronde afronden"
        message="Wat niet geleverd is, komt terug in de vulplanning. Doorgaan?"
        confirmLabel="Afronden"
      />
    </>
  )
}
