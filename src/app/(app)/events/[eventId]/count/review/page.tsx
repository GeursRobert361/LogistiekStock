'use client'

import { use, useCallback, useEffect, useMemo, useState } from 'react'
import { kioskTitle } from '@/lib/kiosk'
import Link from 'next/link'
import { AppHeader } from '@/components/layout/AppHeader'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Select } from '@/components/ui/Select'
import { EmptyState } from '@/components/shared/EmptyState'
import { ConfirmDialog } from '@/components/ui/Dialog'
import { KioskReviewDetail } from '@/components/counting/KioskReviewDetail'
import { repositories } from '@/repositories'
import { useAuth } from '@/context/AuthContext'
import { loadEntryList, loadSessionsForEvent, reopenKiosk } from '@/services/countingService'
import { syncService } from '@/services/syncService'
import {
  approveSession,
  getApprovalBlockers,
  getSessionOverview,
  ROUTE_STATUS_LABEL,
  type SessionOverview,
  type RouteKioskStatus,
} from '@/services/countSessionService'
import { aggregateRestockTotals } from '@/domain/restocking/aggregateTotals'
import { CountSessionStatus, UserRole } from '@/types'
import type { CountEntry, Kiosk, KioskCount, Product, ProductCategory, Ring } from '@/types'

const STATUS_ICON: Record<RouteKioskStatus, string> = {
  COMPLETED: '✓',
  SKIPPED: '⚠',
  IN_PROGRESS: '◐',
  NOT_STARTED: '○',
}

const STATUS_CLASS: Record<RouteKioskStatus, string> = {
  COMPLETED: 'text-green-700',
  SKIPPED: 'text-amber-700',
  IN_PROGRESS: 'text-blue-700',
  NOT_STARTED: 'text-gray-500',
}

type TotalsFilter = 'all' | 'shortages'

export default function CountReviewPage({
  params,
}: {
  params: Promise<{ eventId: string }>
}) {
  const { eventId } = use(params)
  const { hasRole } = useAuth()

  const [overviews, setOverviews] = useState<SessionOverview[]>([])
  const [entriesByKioskCount, setEntriesByKioskCount] = useState<Map<string, CountEntry[]>>(
    new Map()
  )
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<ProductCategory[]>([])
  const [kiosks, setKiosks] = useState<Kiosk[]>([])
  const [rings, setRings] = useState<Ring[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const [openKioskId, setOpenKioskId] = useState<string | null>(null)
  const [totalsFilter, setTotalsFilter] = useState<TotalsFilter>('all')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [ringFilter, setRingFilter] = useState('')
  const [approvingSessionId, setApprovingSessionId] = useState<string | null>(null)
  const [approvalBlockers, setApprovalBlockers] = useState<string[]>([])
  const [isApproving, setIsApproving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const canApprove = hasRole(UserRole.PLANNER) || hasRole(UserRole.ADMIN)

  const load = useCallback(async () => {
    // Wie hier direct vanaf de laatste kiosk binnenkomt, loopt vóór de sync
    // uit: de server weet dan nog niet dat die kiosk klaar is. Eerst legen,
    // dan pas tellen — anders staat er een kiosk op "bezig" die het allang niet
    // meer is.
    await syncService.flush().catch((flushError: unknown) => {
      console.warn('[review] Wegschrijven vóór het overzicht mislukt.', flushError)
    })

    const [sessions, productList, categoryList, kioskList, ringList] = await Promise.all([
      loadSessionsForEvent(eventId),
      repositories.product().getProducts({ activeOnly: false }),
      repositories.product().getCategories(),
      repositories.kiosk().getKiosks(),
      repositories.kiosk().getRings(),
    ])

    setProducts(productList)
    setCategories(categoryList)
    setKiosks(kioskList)
    setRings(ringList)

    const nextOverviews = await Promise.all(sessions.map(getSessionOverview))
    setOverviews(nextOverviews)

    const entries = new Map<string, CountEntry[]>()
    for (const overview of nextOverviews) {
      for (const kiosk of overview.kiosks) {
        if (!kiosk.kioskCount) continue
        entries.set(kiosk.kioskCount.id, await loadEntryList(kiosk.kioskCount.id))
      }
    }
    setEntriesByKioskCount(entries)
    setIsLoading(false)
  }, [eventId])

  useEffect(() => {
    load().catch((loadError: unknown) => {
      console.error('[review] Laden mislukt.', loadError)
      setError('De tellingen konden niet worden geladen.')
      setIsLoading(false)
    })
  }, [load])

  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products])
  const kioskById = useMemo(() => new Map(kiosks.map((k) => [k.id, k])), [kiosks])

  const allKioskCounts = useMemo(
    () =>
      overviews.flatMap((o) =>
        o.kiosks.map((k) => k.kioskCount).filter((kc): kc is KioskCount => kc !== null)
      ),
    [overviews]
  )

  const totals = useMemo(
    () => aggregateRestockTotals(allKioskCounts, entriesByKioskCount),
    [allKioskCounts, entriesByKioskCount]
  )

  const ringIds = useMemo(
    () => [...new Set(overviews.map((o) => o.session.ringId))],
    [overviews]
  )

  const visibleTotals = useMemo(() => {
    const kioskIdsInRing =
      ringFilter === ''
        ? null
        : new Set(kiosks.filter((k) => k.ringId === ringFilter).map((k) => k.id))

    return totals
      .map((total) => {
        const perKiosk =
          kioskIdsInRing === null
            ? total.perKiosk
            : total.perKiosk.filter((entry) => kioskIdsInRing.has(entry.kioskId))
        return {
          ...total,
          perKiosk,
          totalPackages: perKiosk.reduce((sum, k) => sum + k.packages, 0),
        }
      })
      .filter((total) => {
        if (total.totalPackages === 0) return false
        if (categoryFilter && productById.get(total.productId)?.categoryId !== categoryFilter) {
          return false
        }
        if (totalsFilter === 'shortages' && total.totalPackages === 0) return false
        return true
      })
  }, [totals, categoryFilter, ringFilter, totalsFilter, kiosks, productById])

  async function openApproveDialog(sessionId: string) {
    const overview = overviews.find((o) => o.session.id === sessionId)
    if (!overview) return
    const blockers = await getApprovalBlockers(overview)
    setApprovalBlockers(blockers.map((b) => b.message))
    setApprovingSessionId(sessionId)
  }

  async function handleApprove() {
    const overview = overviews.find((o) => o.session.id === approvingSessionId)
    if (!overview) return
    setIsApproving(true)
    setError(null)
    try {
      const result = await approveSession(overview.session)
      setMessage(
        `Telling goedgekeurd. ${result.requirementCount} bijvulregels aangemaakt ` +
          `(${result.totalPackages} verpakkingen).`
      )
      setApprovingSessionId(null)
      await load()
    } catch (approveError) {
      console.error('[review] Goedkeuren mislukt.', approveError)
      setError(
        approveError instanceof Error ? approveError.message : 'Goedkeuren is mislukt.'
      )
    } finally {
      setIsApproving(false)
    }
  }

  async function handleReopen(kioskCount: KioskCount) {
    try {
      await reopenKiosk(kioskCount)
      await load()
      setMessage('Kiosk heropend. De teller kan de kiosk opnieuw invullen.')
    } catch (reopenError) {
      console.error('[review] Heropenen mislukt.', reopenError)
      setError('De kiosk kon niet worden heropend.')
    }
  }

  if (isLoading) {
    return (
      <>
        <AppHeader title="Telling controleren" backHref={`/events/${eventId}`} />
        <div className="p-4 text-center text-gray-500">Laden…</div>
      </>
    )
  }

  if (overviews.length === 0) {
    return (
      <>
        <AppHeader title="Telling controleren" backHref={`/events/${eventId}`} />
        <div className="p-4">
          <EmptyState
            title="Geen telrondes"
            description="Er is nog geen telronde gestart voor dit evenement."
            icon="📋"
            action={
              <Link href={`/events/${eventId}/count/start`}>
                <Button>Telronde starten</Button>
              </Link>
            }
          />
        </div>
      </>
    )
  }

  return (
    <>
      <AppHeader title="Telling controleren" backHref={`/events/${eventId}`} />
      <div className="space-y-4 p-4">
        {message && (
          <p role="status" className="rounded-xl bg-green-50 px-3 py-2 text-sm font-medium text-green-900">
            {message}
          </p>
        )}
        {error && (
          <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
            {error}
          </p>
        )}

        {/* ── Totaal bijvullen ─────────────────────────────────────────── */}
        <section aria-labelledby="totals-heading">
          <h3
            id="totals-heading"
            className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500"
          >
            Totaal bijvullen
          </h3>

          <div className="mb-2 grid grid-cols-2 gap-2">
            <Select
              label="Categorie"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              options={[
                { value: '', label: 'Alle categorieën' },
                ...categories.map((c) => ({ value: c.id, label: c.name })),
              ]}
            />
            <Select
              label="Ring"
              value={ringFilter}
              onChange={(e) => setRingFilter(e.target.value)}
              options={[
                { value: '', label: 'Alle ringen' },
                ...ringIds.map((id) => ({
                  value: id,
                  label: rings.find((r) => r.id === id)?.name ?? id,
                })),
              ]}
            />
          </div>

          <div className="mb-2 flex gap-2">
            {(['all', 'shortages'] as const).map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setTotalsFilter(filter)}
                className={`min-h-11 flex-1 rounded-xl border px-3 text-sm font-medium ${
                  totalsFilter === filter
                    ? 'border-arena-red bg-red-50 text-arena-red'
                    : 'border-gray-300 bg-white text-gray-700'
                }`}
              >
                {filter === 'all' ? 'Alle producten' : 'Alleen tekorten'}
              </button>
            ))}
          </div>

          {visibleTotals.length === 0 ? (
            <p className="rounded-xl border border-gray-200 bg-white px-3 py-4 text-center text-sm text-gray-600">
              Geen tekorten gevonden.
            </p>
          ) : (
            <div className="space-y-1">
              {visibleTotals.map((total) => {
                const product = productById.get(total.productId)
                return (
                  <Card key={total.productId}>
                    <CardContent className="flex items-center justify-between py-2.5">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-gray-900">
                          {product?.name ?? total.productId}
                        </p>
                        <p className="text-xs text-gray-600">
                          {total.perKiosk.length}{' '}
                          {total.perKiosk.length === 1 ? 'kiosk' : 'kiosken'}
                        </p>
                      </div>
                      <p className="ml-3 whitespace-nowrap text-lg font-bold text-gray-900">
                        {total.totalPackages}{' '}
                        <span className="text-xs font-medium text-gray-600">
                          {product?.packagingUnit ?? ''}
                        </span>
                      </p>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </section>

        {/* ── Telrondes ────────────────────────────────────────────────── */}
        {overviews.map((overview) => (
          <section key={overview.session.id} aria-labelledby={`session-${overview.session.id}`}>
            <div className="mb-2 flex items-center justify-between">
              <h3
                id={`session-${overview.session.id}`}
                className="text-sm font-semibold uppercase tracking-wide text-gray-500"
              >
                Telronde {overview.session.startedAt.slice(0, 10)}
              </h3>
              <Badge
                variant={
                  overview.session.status === CountSessionStatus.APPROVED
                    ? 'success'
                    : overview.session.status === CountSessionStatus.SUBMITTED
                      ? 'info'
                      : 'default'
                }
              >
                {SESSION_STATUS_LABEL[overview.session.status]}
              </Badge>
            </div>

            <Card className="mb-2">
              <CardContent className="py-3">
                <p className="mb-2 text-center text-sm font-semibold text-gray-900">
                  {overview.completedCount} van {overview.totalCount} kiosken afgerond
                </p>
                <div className="grid grid-cols-4 gap-2 text-center">
                  <Stat value={overview.completedCount} label="Afgerond" tone="text-green-700" />
                  <Stat value={overview.skippedCount} label="Overgeslagen" tone="text-amber-700" />
                  <Stat value={overview.inProgressCount} label="Bezig" tone="text-blue-700" />
                  <Stat value={overview.notStartedCount} label="Niet geteld" tone="text-gray-500" />
                </div>
              </CardContent>
            </Card>

            <div className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 bg-white">
              {overview.kiosks.map((routeKiosk) => {
                const kiosk = kioskById.get(routeKiosk.kioskId)
                const isOpen = openKioskId === routeKiosk.kioskId
                return (
                  <div key={routeKiosk.kioskId}>
                    <button
                      type="button"
                      onClick={() => setOpenKioskId(isOpen ? null : routeKiosk.kioskId)}
                      aria-expanded={isOpen}
                      className="flex min-h-14 w-full items-center justify-between px-4 py-3 text-left"
                    >
                      <span className="text-base font-semibold text-gray-900">
                        {kiosk ? kioskTitle(kiosk) : routeKiosk.kioskId}
                      </span>
                      <span
                        className={`text-sm font-medium ${STATUS_CLASS[routeKiosk.status]}`}
                      >
                        <span aria-hidden="true">{STATUS_ICON[routeKiosk.status]}</span>{' '}
                        {ROUTE_STATUS_LABEL[routeKiosk.status]}
                      </span>
                    </button>

                    {isOpen && (
                      <div className="border-t border-gray-100 bg-gray-50 p-3">
                        <KioskReviewDetail
                          kioskCount={routeKiosk.kioskCount}
                          entries={
                            routeKiosk.kioskCount
                              ? (entriesByKioskCount.get(routeKiosk.kioskCount.id) ?? [])
                              : []
                          }
                          productById={productById}
                          canReopen={canApprove}
                          onReopen={handleReopen}
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {canApprove && overview.session.status !== CountSessionStatus.APPROVED && (
              <Button
                size="lg"
                className="mt-3 w-full"
                onClick={() => void openApproveDialog(overview.session.id)}
              >
                Telling goedkeuren →
              </Button>
            )}
            {overview.session.status === CountSessionStatus.APPROVED && (
              <Link href={`/events/${eventId}/restock`} className="mt-3 block">
                <Button size="lg" className="w-full">
                  Naar vulplanning →
                </Button>
              </Link>
            )}
          </section>
        ))}
      </div>

      <ConfirmDialog
        open={approvingSessionId !== null && approvalBlockers.length === 0}
        onClose={() => setApprovingSessionId(null)}
        onConfirm={() => void handleApprove()}
        isLoading={isApproving}
        title="Telling goedkeuren"
        message={
          'Na goedkeuren wordt de bijvullijst gegenereerd en kan de telling niet meer ' +
          'zomaar worden aangepast. Doorgaan?'
        }
        confirmLabel="Goedkeuren"
      />

      <ConfirmDialog
        open={approvingSessionId !== null && approvalBlockers.length > 0}
        onClose={() => setApprovingSessionId(null)}
        onConfirm={() => setApprovingSessionId(null)}
        title="Nog niet goed te keuren"
        message={approvalBlockers.join(' ')}
        confirmLabel="Begrepen"
        cancelLabel="Sluiten"
      />
    </>
  )
}

const SESSION_STATUS_LABEL: Record<CountSessionStatus, string> = {
  [CountSessionStatus.NOT_STARTED]: 'Niet gestart',
  [CountSessionStatus.IN_PROGRESS]: 'Bezig',
  [CountSessionStatus.PAUSED]: 'Gepauzeerd',
  [CountSessionStatus.SUBMITTED]: 'Ingediend',
  [CountSessionStatus.APPROVED]: 'Goedgekeurd',
  [CountSessionStatus.REOPENED]: 'Heropend',
}

function Stat({ value, label, tone }: { value: number; label: string; tone: string }) {
  return (
    <div>
      <p className={`text-2xl font-bold ${tone}`}>{value}</p>
      <p className="text-[11px] leading-tight text-gray-600">{label}</p>
    </div>
  )
}
