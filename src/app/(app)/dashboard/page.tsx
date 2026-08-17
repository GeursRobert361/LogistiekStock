'use client'

import { useCallback, useEffect, useState } from 'react'
import { kioskTitle } from '@/lib/kiosk'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AppHeader } from '@/components/layout/AppHeader'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { EventStatusBadge } from '@/components/shared/EventStatusBadge'
import { ListSkeleton } from '@/components/shared/LoadingSkeleton'
import { EmptyState } from '@/components/shared/EmptyState'
import { useAuth } from '@/context/AuthContext'
import { repositories } from '@/repositories'
import { loadSessionsForEvent } from '@/services/countingService'
import {
  getSessionOverview,
  getNextOpenKioskId,
  isResumable,
  type SessionOverview,
} from '@/services/countSessionService'
import { getRestockOverview } from '@/services/restockPlanningService'
import { getIncidents, isOpen } from '@/services/incidentService'
import { getEventFocus, type EventFocus, type EventFocusKind } from '@/domain/events/eventSelection'
import { createEventFromAgenda } from '@/services/eventService'
import { ROUND_STATUS_LABEL, RUNNING_STATUSES } from '@/lib/roundStatus'
import { PERMISSIONS } from '@/lib/permissions'
import { RestockRoundStatus } from '@/types'
import type { AgendaEntry, Incident, Kiosk, Product, RestockRound } from '@/types'
import { formatDate } from '@/lib/utils'
import { IconAdmin, IconCount } from '@/components/layout/NavIcons'

/**
 * Wat er boven de kaart staat. "Eerstvolgende" hoort alleen bij iets dat nog
 * moet komen — een wedstrijd van gisteren zo noemen was precies de verwarring
 * die dit scherm opleverde toen de laatste wedstrijd gespeeld was.
 */
const FOCUS_HEADING: Record<EventFocusKind, string> = {
  RUNNING: 'Actief evenement',
  UPCOMING: 'Eerstvolgende evenement',
  PLANNED: 'Eerstvolgende evenement',
  PAST: 'Laatste evenement',
  NONE: 'Evenement',
}

interface DashboardData {
  focus: EventFocus
  resumableSessions: SessionOverview[]
  allSessions: SessionOverview[]
  shortages: Array<{ product: Product; packages: number }>
  rounds: RestockRound[]
  openIncidents: Incident[]
  kiosks: Map<string, Kiosk>
}

export default function DashboardPage() {
  const router = useRouter()
  const { profile, hasAnyRole } = useAuth()
  const [data, setData] = useState<DashboardData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isCreatingEvent, setIsCreatingEvent] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const canCount = hasAnyRole([...PERMISSIONS.COUNT])
  const canReview = hasAnyRole([...PERMISSIONS.REVIEW_COUNTS])
  const canPlanRestock = hasAnyRole([...PERMISSIONS.PLAN_RESTOCK])
  const canExecuteRestock = hasAnyRole([...PERMISSIONS.EXECUTE_RESTOCK])
  const canManageMasterData = hasAnyRole([...PERMISSIONS.MANAGE_MASTER_DATA])
  const canManageEvents = hasAnyRole([...PERMISSIONS.MANAGE_EVENTS])

  const load = useCallback(async () => {
    // De agenda hoort erbij: is de laatste wedstrijd gespeeld en afgerond, dan
    // bestaat het volgende evenement nog niet en weet alleen de kalender waar
    // dit scherm over moet gaan.
    const [events, agenda] = await Promise.all([
      repositories.event().getEvents(),
      repositories
        .event()
        .getAgenda()
        .catch((error: unknown) => {
          console.warn('[dashboard] Agenda niet te laden.', error)
          return []
        }),
    ])
    const focus = getEventFocus({ events, agenda })
    const event = focus.event

    if (!event) {
      setData({
        focus,
        resumableSessions: [],
        allSessions: [],
        shortages: [],
        rounds: [],
        openIncidents: [],
        kiosks: new Map(),
      })
      setIsLoading(false)
      return
    }

    const [sessions, productList, kioskList, rounds, incidents] = await Promise.all([
      loadSessionsForEvent(event.id),
      repositories.product().getProducts({ activeOnly: false }),
      repositories.kiosk().getKiosks(),
      repositories.restock().getRounds(event.id),
      getIncidents({ eventId: event.id }),
    ])

    const productMap = new Map(productList.map((p) => [p.id, p]))
    const overviews = await Promise.all(sessions.map(getSessionOverview))

    const restockOverview = await getRestockOverview(event.id, productMap)
    const shortages = [...restockOverview.byProduct.entries()]
      .map(([productId, entry]) => ({ product: productMap.get(productId), packages: entry.total }))
      .filter((item): item is { product: Product; packages: number } => item.product !== undefined)
      .sort((a, b) => b.packages - a.packages)
      .slice(0, 5)

    setData({
      focus,
      resumableSessions: overviews.filter(
        (overview) => isResumable(overview.session) && !overview.isFullyHandled
      ),
      allSessions: overviews,
      shortages,
      rounds,
      openIncidents: incidents.filter(isOpen),
      kiosks: new Map(kioskList.map((k) => [k.id, k])),
    })
    setIsLoading(false)
  }, [])

  useEffect(() => {
    load().catch((error: unknown) => {
      console.error('[dashboard] Laden mislukt.', error)
      setIsLoading(false)
    })
  }, [load])

  if (isLoading || !data) {
    return (
      <>
        <AppHeader />
        <div className="space-y-4 p-4">
          <ListSkeleton count={3} />
        </div>
      </>
    )
  }

  const { focus, resumableSessions, allSessions, shortages, rounds, openIncidents, kiosks } = data
  const event = focus.event

  /**
   * De agendaregel wordt hier pas een evenement. Dat scheelt een formulier op
   * de dag dat er geteld moet worden: alles staat open, en een kiosk die dicht
   * moet zet je daarna bij het evenement zelf.
   */
  async function startFromAgenda(entry: AgendaEntry) {
    if (!profile || isCreatingEvent) return
    setIsCreatingEvent(true)
    setCreateError(null)
    try {
      const created = await createEventFromAgenda(entry, profile.id)
      router.push(`/events/${created.id}/count/start`)
    } catch (error) {
      console.error('[dashboard] Evenement aanmaken mislukt.', error)
      setCreateError('Het evenement kon niet worden aangemaakt.')
      setIsCreatingEvent(false)
    }
  }

  const countedKiosks = allSessions.reduce((sum, o) => sum + o.completedCount + o.skippedCount, 0)
  const totalKiosks = allSessions.reduce((sum, o) => sum + o.totalCount, 0)
  const availableRounds = rounds.filter((r) => r.status === RestockRoundStatus.READY)
  const runningRounds = rounds.filter((r) => RUNNING_STATUSES.includes(r.status))
  const finishedRounds = rounds.filter((r) => r.status === RestockRoundStatus.COMPLETED)

  return (
    <>
      <AppHeader />
      <div className="space-y-5 p-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">
            Hallo, {profile?.displayName?.split(' ')[0]}
          </h2>
          <p className="text-sm text-gray-600">
            {new Intl.DateTimeFormat('nl-NL', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            }).format(new Date())}
          </p>
        </div>

        {focus.kind === 'NONE' ? (
          <EmptyState
            title="Geen evenementen"
            description={
              canManageEvents
                ? 'Zet de kalender in Beheer → Agenda, of maak zelf een evenement aan.'
                : 'Er staat op dit moment geen evenement gepland.'
            }
            icon="📅"
            action={
              canManageEvents ? (
                <Link href="/events/new">
                  <Button>Evenement aanmaken</Button>
                </Link>
              ) : undefined
            }
          />
        ) : focus.kind === 'PLANNED' && focus.agendaEntry ? (
          <>
            {/* ── Uit de agenda: bestaat nog niet als evenement ─────────── */}
            <section aria-labelledby="event-heading">
              <h3
                id="event-heading"
                className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500"
              >
                {FOCUS_HEADING.PLANNED}
              </h3>
              <Card>
                <CardContent className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-semibold text-gray-900">{focus.agendaEntry.name}</p>
                    <p className="text-sm text-gray-600">{formatDate(focus.agendaEntry.date)}</p>
                  </div>
                  <Badge variant="default">Uit de agenda</Badge>
                </CardContent>
              </Card>
            </section>

            {canManageEvents ? (
              <section aria-label="Beginnen met dit evenement">
                <Button
                  size="lg"
                  className="w-full"
                  disabled={isCreatingEvent}
                  onClick={() => void startFromAgenda(focus.agendaEntry!)}
                >
                  {isCreatingEvent ? 'Bezig…' : 'Telronde starten'}
                </Button>
                <p className="mt-1 text-center text-sm text-gray-600">
                  Alle ringen en kiosken doen mee.{' '}
                  <Link href="/events/new" className="underline">
                    Zelf instellen
                  </Link>
                </p>
                {createError && (
                  <p
                    role="alert"
                    className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-800"
                  >
                    {createError}
                  </p>
                )}
              </section>
            ) : (
              <p className="rounded-xl border border-gray-200 bg-white px-3 py-4 text-center text-sm text-gray-600">
                Dit evenement is nog niet aangemaakt. Een planner zet het klaar.
              </p>
            )}

            {(canManageMasterData || canPlanRestock) && <AdminShortcuts />}
          </>
        ) : event ? (
          <>
            {/* ── Actief evenement ─────────────────────────────────────── */}
            <section aria-labelledby="event-heading">
              {/* "Actief" alleen als er ook echt geteld of gevuld wordt, en
                  "eerstvolgende" alleen als het nog moet komen. */}
              <h3
                id="event-heading"
                className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500"
              >
                {FOCUS_HEADING[focus.kind]}
              </h3>
              <Link href={`/events/${event.id}`} className="block">
                <Card className="active:bg-gray-100">
                  <CardContent className="flex items-center justify-between py-3">
                    <div>
                      <p className="font-semibold text-gray-900">{event.name}</p>
                      <p className="text-sm text-gray-600">{formatDate(event.date)}</p>
                    </div>
                    <EventStatusBadge status={event.status} />
                  </CardContent>
                </Card>
              </Link>
            </section>

            {/* ── Teller: verder met de telling ────────────────────────── */}
            {canCount && resumableSessions.length > 0 && (
              <section aria-label="Openstaande telronde">
                {resumableSessions.map((overview) => {
                  const nextKioskId = getNextOpenKioskId(overview)
                  if (!nextKioskId) return null
                  return (
                    <Link
                      key={overview.session.id}
                      href={`/events/${event.id}/count/${overview.session.id}/kiosk/${nextKioskId}`}
                      className="block"
                    >
                      <Button size="lg" className="w-full">
                        Verder met telling — {kioskTitle(kiosks.get(nextKioskId))}
                      </Button>
                      <p className="mt-1 text-center text-sm text-gray-600">
                        {overview.completedCount + overview.skippedCount} van{' '}
                        {overview.totalCount} kiosken
                      </p>
                    </Link>
                  )
                })}
              </section>
            )}

            {canCount && resumableSessions.length === 0 && (
              <Link href={`/events/${event.id}/count/start`} className="block">
                <Button size="lg" className="w-full">
                  Telronde starten
                </Button>
              </Link>
            )}

            {/* ── Planner: stand van zaken ─────────────────────────────── */}
            {canReview && totalKiosks > 0 && (
              <section aria-labelledby="counting-heading">
                <h3
                  id="counting-heading"
                  className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500"
                >
                  Telling
                </h3>
                <Link href={`/events/${event.id}/count/review`} className="block">
                  <Card className="active:bg-gray-100">
                    <CardContent className="py-3">
                      <p className="text-lg font-bold text-gray-900">
                        {countedKiosks} / {totalKiosks} afgerond
                      </p>
                      <p className="text-sm text-gray-600">Telling controleren →</p>
                    </CardContent>
                  </Card>
                </Link>
              </section>
            )}

            {canPlanRestock && shortages.length > 0 && (
              <section aria-labelledby="shortage-heading">
                <h3
                  id="shortage-heading"
                  className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500"
                >
                  Bij te vullen
                </h3>
                <Link href={`/events/${event.id}/restock`} className="block">
                  <Card className="active:bg-gray-100">
                    <CardContent className="space-y-1 py-3">
                      {shortages.map(({ product, packages }) => (
                        <div key={product.id} className="flex justify-between text-sm">
                          <span className="truncate text-gray-800">{product.name}</span>
                          <span className="ml-2 font-bold text-gray-900">{packages}</span>
                        </div>
                      ))}
                      <p className="pt-1 text-sm text-gray-600">Naar vulplanning →</p>
                    </CardContent>
                  </Card>
                </Link>
              </section>
            )}

            {/* ── Vuller: beschikbare rondes ───────────────────────────── */}
            {canExecuteRestock && (
              <section aria-labelledby="rounds-heading">
                <h3
                  id="rounds-heading"
                  className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500"
                >
                  Vulrondes
                </h3>
                {/* Zelf een pallet pakken is de snelste weg naar de vloer en
                    staat daarom boven de lijst met wat er al klaarstaat. */}
                <Link href="/restock-rounds/new" className="mb-2 block">
                  <Button size="lg" className="w-full">
                    Pallet pakken →
                  </Button>
                </Link>
                {rounds.length === 0 ? (
                  <p className="rounded-xl border border-gray-200 bg-white px-3 py-4 text-center text-sm text-gray-600">
                    Er staat nog geen pallet klaar.
                  </p>
                ) : (
                  <Link href="/restock-rounds" className="block">
                    <Card className="active:bg-gray-100">
                      <CardContent className="py-3">
                        <div className="mb-2 flex gap-3 text-sm text-gray-700">
                          <span>{runningRounds.length} bezig</span>
                          <span>{availableRounds.length} klaar</span>
                          <span>{finishedRounds.length} afgerond</span>
                        </div>
                        {availableRounds.slice(0, 3).map((round) => (
                          <div key={round.id} className="flex justify-between text-sm">
                            <span className="truncate text-gray-800">{round.name}</span>
                            <Badge variant="info">{ROUND_STATUS_LABEL[round.status]}</Badge>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  </Link>
                )}
              </section>
            )}

            {/* ── Storingen ────────────────────────────────────────────── */}
            <section aria-labelledby="incidents-heading">
              <h3
                id="incidents-heading"
                className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500"
              >
                Storingen
              </h3>
              <Link href="/incidents" className="block">
                <Card className="active:bg-gray-100">
                  <CardContent className="flex items-center justify-between py-3">
                    <p className="text-gray-800">
                      {openIncidents.length === 0
                        ? 'Geen open storingen'
                        : `${openIncidents.length} open ${openIncidents.length === 1 ? 'storing' : 'storingen'}`}
                    </p>
                    <span aria-hidden="true" className="text-gray-400">
                      →
                    </span>
                  </CardContent>
                </Card>
              </Link>
            </section>

            {/* ── Beheer alleen voor wie er iets mag ───────────────────── */}
            {(canManageMasterData || canPlanRestock) && <AdminShortcuts />}
          </>
        ) : null}
      </div>
    </>
  )
}

function AdminShortcuts() {
  return (
    <section aria-labelledby="admin-heading">
      <h3
        id="admin-heading"
        className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500"
      >
        Beheer
      </h3>
      <div className="grid grid-cols-2 gap-2">
        <ShortcutCard href="/admin/standards" Icon={IconCount} label="Normen" />
        <ShortcutCard href="/admin" Icon={IconAdmin} label="Alle instellingen" />
      </div>
    </section>
  )
}

function ShortcutCard({
  href,
  Icon,
  label,
}: {
  href: string
  Icon: React.ComponentType<{ className?: string }>
  label: string
}) {
  return (
    <Link href={href}>
      <Card className="active:bg-concrete-light">
        <CardContent className="flex min-h-20 flex-col items-center justify-center gap-1.5 py-4 text-center">
          <Icon className="h-6 w-6 text-ink-muted" />
          <span className="text-sm font-semibold text-ink">{label}</span>
        </CardContent>
      </Card>
    </Link>
  )
}
