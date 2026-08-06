'use client'

import { use, useEffect, useMemo, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { v4 as uuidv4 } from 'uuid'
import { AppHeader } from '@/components/layout/AppHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { repositories } from '@/repositories'
import { useAuth } from '@/context/AuthContext'
import { generateCircularKioskRoute } from '@/domain/routing/kioskRoute'
import { RouteDirection, CountSessionStatus, SyncStatus } from '@/types'
import { saveCountSessionLocally } from '@/lib/db/offlineDb'
import type { Ring, Kiosk } from '@/types'

export default function CountStartPage({
  params,
}: {
  params: Promise<{ eventId: string }>
}) {
  const { eventId } = use(params)
  const { profile } = useAuth()
  const router = useRouter()

  const [rings, setRings] = useState<Ring[]>([])
  const [kiosks, setKiosks] = useState<Array<Kiosk & { isOpenForEvent: boolean }>>([])
  const [selectedRingId, setSelectedRingId] = useState('')
  const [startKioskId, setStartKioskId] = useState('')
  const [direction, setDirection] = useState<RouteDirection>(RouteDirection.ASCENDING)
  const [isLoading, setIsLoading] = useState(true)
  const [isStarting, setIsStarting] = useState(false)
  const [previewRoute, setPreviewRoute] = useState<number[]>([])

  useEffect(() => {
    async function load() {
      const [r, k] = await Promise.all([
        repositories.kiosk().getRings(),
        repositories.kiosk().getKiosksByEvent(eventId),
      ])
      setRings(r)
      setKiosks(k)
      if (r[0]) {
        setSelectedRingId(r[0].id)
      }
      setIsLoading(false)
    }
    load()
  }, [eventId])

  const ringKiosks = useMemo(
    () =>
      kiosks
        .filter((k) => k.ringId === selectedRingId && k.isActive && k.isOpenForEvent)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [kiosks, selectedRingId]
  )

  useEffect(() => {
    if (ringKiosks.length === 0) return
    if (!startKioskId && ringKiosks[0]) {
      setStartKioskId(ringKiosks[0].id)
    }
  }, [ringKiosks, startKioskId])

  useEffect(() => {
    if (!startKioskId || ringKiosks.length === 0) return
    const route = generateCircularKioskRoute({
      kiosks: ringKiosks,
      startKioskId,
      direction,
    })
    setPreviewRoute(
      route
        .slice(0, 5)
        .map((k) => {
          const kiosk = ringKiosks.find((rk) => rk.id === k.id)
          return kiosk?.number ?? 0
        })
    )
  }, [startKioskId, direction, ringKiosks])

  async function handleStart(e: FormEvent) {
    e.preventDefault()
    if (!profile || !startKioskId) return
    setIsStarting(true)

    const route = generateCircularKioskRoute({
      kiosks: ringKiosks,
      startKioskId,
      direction,
    })

    const sessionId = uuidv4()
    const session = {
      id: sessionId,
      userId: profile.id,
      eventId,
      ringId: selectedRingId,
      startKioskId,
      direction,
      kioskRoute: route.map((k) => k.id),
      startedAt: new Date().toISOString(),
      status: CountSessionStatus.IN_PROGRESS,
      syncStatus: SyncStatus.LOCAL,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    // Sla lokaal op — werkt ook offline
    await saveCountSessionLocally(session)

    // Probeer ook op server op te slaan
    try {
      await repositories.count().createSession(session)
    } catch {
      // Offline — outbox synchroniseert later
    }

    const firstKioskId = route[0]?.id
    if (firstKioskId) {
      router.push(`/events/${eventId}/count/${sessionId}/kiosk/${firstKioskId}`)
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

          {/* Startkiosk */}
          <Select
            label="Startkiosk"
            value={startKioskId}
            onChange={(e) => setStartKioskId(e.target.value)}
            options={ringKiosks.map((k) => ({
              value: k.id,
              label: `Kiosk ${k.number}`,
            }))}
          />

          {/* Richting */}
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-gray-700">Looprichting</legend>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: RouteDirection.ASCENDING, label: '↪ Rechtsom (oplopend)' },
                { value: RouteDirection.DESCENDING, label: '↩ Linksom (aflopend)' },
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
                <p className="text-sm text-gray-600">
                  {previewRoute.join(' → ')} → …
                </p>
                <p className="mt-1 text-xs text-gray-400">
                  ({ringKiosks.length} kiosken totaal)
                </p>
              </CardContent>
            </Card>
          )}

          <Button type="submit" size="lg" className="w-full" disabled={isStarting || !startKioskId}>
            {isStarting ? 'Bezig…' : 'Telronde starten →'}
          </Button>
        </form>
      </div>
    </>
  )
}
