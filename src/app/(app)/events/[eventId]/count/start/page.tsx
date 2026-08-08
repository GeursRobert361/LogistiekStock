'use client'

import { use, useEffect, useMemo, useState, type FormEvent } from 'react'
import { kioskLabel, kioskTitle } from '@/lib/kiosk'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AppHeader } from '@/components/layout/AppHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { repositories } from '@/repositories'
import { useAuth } from '@/context/AuthContext'
import { generateCircularKioskRoute } from '@/domain/routing/kioskRoute'
import {
  ActiveSessionExistsError,
  createSession,
  loadSessionsForEvent,
} from '@/services/countingService'
import { findActiveSessionForRing, SESSION_STATUS_LABEL } from '@/domain/counting/sessionStatus'
import { getNextOpenKioskId, getSessionOverview } from '@/services/countSessionService'
import { RouteDirection } from '@/types'
import type { CountSession, Ring, Kiosk } from '@/types'

export default function CountStartPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = use(params)
  const { profile } = useAuth()
  const router = useRouter()

  const [rings, setRings] = useState<Ring[]>([])
  const [kiosks, setKiosks] = useState<Array<Kiosk & { isOpenForEvent: boolean }>>([])
  const [sessions, setSessions] = useState<CountSession[]>([])
  const [selectedRingId, setSelectedRingId] = useState('')
  const [startKioskId, setStartKioskId] = useState('')
  const [direction, setDirection] = useState<RouteDirection>(RouteDirection.ASCENDING)
  const [isLoading, setIsLoading] = useState(true)
  const [isStarting, setIsStarting] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)
  const [previewRoute, setPreviewRoute] = useState<string[]>([])

  useEffect(() => {
    async function load() {
      const [r, k, s] = await Promise.all([
        repositories.kiosk().getRings(),
        repositories.kiosk().getKiosksByEvent(eventId),
        loadSessionsForEvent(eventId),
      ])
      setRings(r)
      setKiosks(k)
      setSessions(s)
      if (r[0]) {
        setSelectedRingId(r[0].id)
      }
      setIsLoading(false)
    }
    load()
  }, [eventId])

  // Voor een ring waar al geteld wordt hoort er geen tweede ronde bij te komen.
  const runningSession = useMemo(
    () => (selectedRingId ? findActiveSessionForRing(sessions, selectedRingId) : null),
    [sessions, selectedRingId]
  )

  // Waar die lopende ronde gebleven is, zodat "verder" ook echt verder gaat.
  const [resumeKioskId, setResumeKioskId] = useState<string | null>(null)
  useEffect(() => {
    if (!runningSession) {
      setResumeKioskId(null)
      return
    }
    let cancelled = false
    const fallback = runningSession.kioskRoute[0] ?? null
    getSessionOverview(runningSession)
      .then((overview) => {
        if (!cancelled) setResumeKioskId(getNextOpenKioskId(overview) ?? fallback)
      })
      .catch(() => {
        if (!cancelled) setResumeKioskId(fallback)
      })
    return () => {
      cancelled = true
    }
  }, [runningSession])

  const ringKiosks = useMemo(
    () =>
      kiosks
        .filter((k) => k.ringId === selectedRingId && k.isActive && k.isOpenForEvent)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [kiosks, selectedRingId]
  )

  // Voorkeurskiosk van de ring: daar kom je de lift uit. Bestaat hij niet
  // (of is hij dicht voor dit evenement), dan de eerste kiosk van de ring.
  useEffect(() => {
    if (ringKiosks.length === 0) return

    const ring = rings.find((r) => r.id === selectedRingId)
    const preferred = ring?.countStartKioskId
    const isUsable = preferred !== undefined && ringKiosks.some((k) => k.id === preferred)

    setStartKioskId((current) => {
      if (current && ringKiosks.some((k) => k.id === current)) return current
      return isUsable ? preferred : (ringKiosks[0]?.id ?? '')
    })
  }, [ringKiosks, rings, selectedRingId])

  useEffect(() => {
    if (!startKioskId || ringKiosks.length === 0) return
    const route = generateCircularKioskRoute({
      kiosks: ringKiosks,
      startKioskId,
      direction,
    })
    setPreviewRoute(
      route.slice(0, 5).map((k) => {
        const kiosk = ringKiosks.find((rk) => rk.id === k.id)
        return kioskLabel(kiosk)
      })
    )
  }, [startKioskId, direction, ringKiosks])

  async function handleStart(e: FormEvent) {
    e.preventDefault()
    if (!profile || !startKioskId) return
    setIsStarting(true)
    setStartError(null)

    try {
      const route = generateCircularKioskRoute({ kiosks: ringKiosks, startKioskId, direction })
      if (route.length === 0) {
        setStartError('Deze ring heeft geen open kiosken voor dit evenement.')
        return
      }

      // De telronde staat direct lokaal; de server volgt via de outbox, zodat
      // starten ook zonder verbinding werkt.
      const session = await createSession({
        userId: profile.id,
        eventId,
        ringId: selectedRingId,
        startKioskId,
        direction,
        kioskRoute: route.map((k) => k.id),
        startedAt: new Date().toISOString(),
      })

      const firstKioskId = route[0]?.id
      if (firstKioskId) {
        router.push(`/events/${eventId}/count/${session.id}/kiosk/${firstKioskId}`)
      }
    } catch (error) {
      console.error('[telling] Telronde starten mislukt.', error)
      if (error instanceof ActiveSessionExistsError) {
        // Iemand anders was net eerder. Het scherm ververst zichzelf en biedt
        // die ronde aan in plaats van er een tweede naast te zetten.
        setSessions(await loadSessionsForEvent(eventId))
        setStartError('Voor deze ring is net een telronde gestart.')
      } else {
        setStartError('De telronde kon niet worden gestart. Probeer het opnieuw.')
      }
    } finally {
      setIsStarting(false)
    }
  }

  if (isLoading) {
    return (
      <>
        <AppHeader title="Telronde starten" backHref={`/events/${eventId}`} />
        <div className="p-4 text-center text-gray-500">Laden…</div>
      </>
    )
  }

  return (
    <>
      <AppHeader title="Telronde starten" backHref={`/events/${eventId}`} />
      <div className="space-y-4 p-4">
        <form onSubmit={handleStart} className="space-y-4">
          {/* Ring selectie */}
          <Select
            label="Ring"
            value={selectedRingId}
            onChange={(e) => {
              setSelectedRingId(e.target.value)
              setStartKioskId('')
            }}
            options={rings.map((r) => ({ value: r.id, label: r.name }))}
          />

          {runningSession && (
            <Card className="border-arena-red">
              <CardContent className="py-3">
                <p className="font-semibold text-gray-900">Voor deze ring loopt al een telronde.</p>
                <p className="mt-0.5 text-sm text-gray-600">
                  Gestart op {new Date(runningSession.startedAt).toLocaleString('nl-NL')} ·{' '}
                  {SESSION_STATUS_LABEL[runningSession.status]}
                </p>
                <p className="mt-2 text-sm text-gray-700">
                  Twee rondes naast elkaar leveren twee tellingen op. Ga verder met deze, of kies
                  hierboven een andere ring.
                </p>
                {resumeKioskId && (
                  <Link
                    href={`/events/${eventId}/count/${runningSession.id}/kiosk/${resumeKioskId}`}
                    className="mt-3 block"
                  >
                    <Button className="w-full" size="lg">
                      Verder met bestaande telronde →
                    </Button>
                  </Link>
                )}
              </CardContent>
            </Card>
          )}

          {/* Bij een lopende ronde valt er niets te starten; alleen te
              hervatten, of een andere ring te kiezen. */}
          {!runningSession && (
            <>
              {/* Startkiosk */}
              <Select
                label="Startkiosk"
                value={startKioskId}
                onChange={(e) => setStartKioskId(e.target.value)}
                options={ringKiosks.map((k) => ({
                  value: k.id,
                  label: kioskTitle(k),
                }))}
              />

              {/* Richting */}
              <fieldset>
                <legend className="mb-2 text-sm font-medium text-gray-700">Looprichting</legend>
                <div className="grid grid-cols-2 gap-2">
                  {/* Neutrale labels. Of oplopend nu linksom of rechtsom
                      uitpakt hangt af van hoe de ring genummerd en gebouwd is,
                      en dat staat nergens vastgelegd. Het nummerverloop klopt
                      altijd, en dat is precies wat de teller voor zich ziet. */}
                  {[
                    { value: RouteDirection.ASCENDING, label: 'Oplopend — 123 → 124' },
                    { value: RouteDirection.DESCENDING, label: 'Aflopend — 123 → 122' },
                  ].map((opt) => (
                    <label
                      key={opt.value}
                      className={`flex cursor-pointer items-center justify-center rounded-xl border p-3 text-sm font-medium transition-colors ${
                        direction === opt.value
                          ? 'border-arena-red bg-red-50 text-arena-red'
                          : 'border-gray-300 bg-white text-gray-700'
                      }`}
                    >
                      <input
                        type="radio"
                        name="direction"
                        value={opt.value}
                        checked={direction === opt.value}
                        onChange={() => setDirection(opt.value)}
                        className="sr-only"
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </fieldset>

              {/* Route preview */}
              {previewRoute.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Route-voorbeeld</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-600">{previewRoute.join(' → ')} → …</p>
                    <p className="mt-1 text-xs text-gray-400">
                      ({ringKiosks.length} kiosken totaal)
                    </p>
                  </CardContent>
                </Card>
              )}

              {startError && (
                <p
                  role="alert"
                  className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-800"
                >
                  {startError}
                </p>
              )}

              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={isStarting || !startKioskId}
              >
                {isStarting ? 'Bezig…' : 'Telronde starten →'}
              </Button>
            </>
          )}
        </form>
      </div>
    </>
  )
}
