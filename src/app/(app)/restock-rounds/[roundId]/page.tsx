'use client'

import { use, useCallback, useEffect, useState } from 'react'
import { kioskTitle } from '@/lib/kiosk'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AppHeader } from '@/components/layout/AppHeader'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { ConfirmDialog } from '@/components/ui/Dialog'
import { EmptyState } from '@/components/shared/EmptyState'
import { repositories } from '@/repositories'
import { useAuth } from '@/context/AuthContext'
import { claimRound, planRouteForRound, startRound, cancelRound } from '@/services/restockPlanningService'
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
      await planRouteForRound(roundId)
      await load()
    } catch (routeError) {
      console.error('[vulronde] Route maken mislukt.', routeError)
      setError(routeError instanceof Error ? routeError.message : 'Route maken is mislukt.')
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
  const openStops = plan.stops.length - plan.completedStops
  // Wie de pallet zelf heeft gepakt mag hem ook zelf weer weggooien.
  const isMine =
    profile !== null &&
    (round.assignedUserId === profile.id || round.createdById === profile.id)
  const stillNeeded = [...plan.stillNeededByProduct.values()].sort(
    (a, b) => b.packages - a.packages
  )

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

        {/* ── Stapellijst ──────────────────────────────────────────────── */}
        {isPicking && (
          <section aria-labelledby="load-heading">
            <h2 id="load-heading" className="mb-1 text-lg font-bold text-gray-900">
              Op de pallet zetten
            </h2>
            <p className="mb-3 text-sm text-gray-600">
              Dit gaat er in totaal naar de kiosken. Past het niet in één keer, haal dan onderweg
              bij — de route blijft hetzelfde.
            </p>

            <div className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 bg-white">
              {plan.items.map((item) => {
                const product = products.get(item.productId)
                return (
                  <div key={item.id} className="flex items-center justify-between px-3 py-3">
                    <p className="min-w-0 truncate font-medium text-gray-900">
                      {product?.name ?? item.productId}
                    </p>
                    <p className="ml-3 whitespace-nowrap text-right">
                      <span className="text-2xl font-bold text-gray-900">
                        {item.proposedPackages}
                      </span>{' '}
                      <span className="text-sm text-gray-600">
                        {product?.packagingUnit ?? ''}
                      </span>
                    </p>
                  </div>
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

        {/* ── Nog nodig ────────────────────────────────────────────────── */}
        {!isPicking && stillNeeded.length > 0 && (
          <section aria-labelledby="cargo-heading">
            <h3
              id="cargo-heading"
              className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500"
            >
              Nog nodig
            </h3>
            <div className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 bg-white">
              {stillNeeded.map((entry) => {
                const product = products.get(entry.productId)
                return (
                  <div
                    key={entry.productId}
                    className="flex items-center justify-between px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-gray-900">
                        {product?.name ?? entry.productId}
                      </p>
                      <p className="text-xs text-gray-600">
                        {entry.kioskCount} {entry.kioskCount === 1 ? 'kiosk' : 'kiosken'} te gaan
                      </p>
                    </div>
                    <p className="ml-2 whitespace-nowrap text-right">
                      <span className="text-lg font-bold text-gray-900">{entry.packages}</span>{' '}
                      <span className="text-xs text-gray-600">
                        {product?.packagingUnit ?? ''}
                      </span>
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
                        {index + 1}. {kioskTitle(kiosks.get(stop.kioskId)) || stop.kioskId}
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
            <>
              <Link href={`/restock-rounds/${roundId}/stop/${nextStop.id}`} className="block">
                <Button size="lg" className="w-full">
                  Verder — {kioskTitle(kiosks.get(nextStop.kioskId))}
                </Button>
              </Link>
              {/* Stoppen kan altijd: een lege pallet, een dienst die erop zit,
                  een ronde die niet meer klopt. Wat er nog stond, komt terug
                  in de vulplanning. */}
              <Button
                variant="outline"
                size="lg"
                className="w-full"
                disabled={isWorking}
                onClick={() => setShowCompleteDialog(true)}
              >
                Ronde stoppen
              </Button>
            </>
          )}

          {isRunning && !nextStop && (
            <Button size="lg" className="w-full" onClick={() => setShowCompleteDialog(true)}>
              Vulronde afronden ✓
            </Button>
          )}

          {(canPlan || isMine) && (isPicking || isReady) && (
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
        title={openStops > 0 ? 'Ronde stoppen' : 'Vulronde afronden'}
        message={
          openStops > 0
            ? `${openStops} ${openStops === 1 ? 'kiosk staat' : 'kiosken staan'} nog open. ` +
              'Wat daar nog heen moest, komt terug in de vulplanning en kan op een volgende ' +
              'pallet mee. Wat je al geleverd hebt blijft staan.'
            : 'Wat niet geleverd is, komt terug in de vulplanning. Doorgaan?'
        }
        confirmLabel={openStops > 0 ? 'Stoppen' : 'Afronden'}
        cancelLabel="Terug"
      />
    </>
  )
}
