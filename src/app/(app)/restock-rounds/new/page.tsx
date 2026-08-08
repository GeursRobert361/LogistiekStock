'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AppHeader } from '@/components/layout/AppHeader'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { EmptyState } from '@/components/shared/EmptyState'
import { ListSkeleton } from '@/components/shared/LoadingSkeleton'
import { repositories } from '@/repositories'
import { useAuth } from '@/context/AuthContext'
import {
  findEventWithOpenRestockWork,
  getRestockOverview,
  startPalletRound,
} from '@/services/restockPlanningService'
import { orderEventsByRelevance } from '@/domain/events/eventSelection'
import { EventStatus } from '@/types'
import type { Event, Kiosk, Product, Ring } from '@/types'

/** Eén regel op het scherm: een product met wat er nog van open staat. */
interface OpenProduct {
  product: Product
  packages: number
  kioskCount: number
}

export default function PickPalletPage() {
  const { profile } = useAuth()
  const router = useRouter()

  const [events, setEvents] = useState<Event[]>([])
  const [rings, setRings] = useState<Ring[]>([])
  const [eventId, setEventId] = useState('')
  const [ringId, setRingId] = useState('')
  const [openByRing, setOpenByRing] = useState<Map<string, OpenProduct[]>>(new Map())
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [roundCount, setRoundCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isStarting, setIsStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Evenementen en ringen liggen vast zolang dit scherm openstaat.
  useEffect(() => {
    Promise.all([repositories.event().getEvents(), repositories.kiosk().getRings()])
      .then(async ([eventList, ringList]) => {
        const usable = orderEventsByRelevance(
          eventList.filter((event) => event.status !== EventStatus.ARCHIVED)
        )
        setEvents(usable)
        setRings(ringList)

        // Wie een pallet komt pakken wil het evenement waar nog iets ligt, niet
        // de wedstrijd van vorige maand die al helemaal gevuld is.
        const withWork = await findEventWithOpenRestockWork(usable)
        setEventId((current) => current || (withWork?.id ?? usable[0]?.id ?? ''))
      })
      .catch((loadError: unknown) => {
        console.error('[pallet] Evenementen laden mislukt.', loadError)
        setError('De evenementen konden niet worden geladen.')
        setIsLoading(false)
      })
  }, [])

  const loadOpenWork = useCallback(async (currentEventId: string) => {
    setIsLoading(true)

    const [productList, kioskList, rounds] = await Promise.all([
      repositories.product().getProducts({ activeOnly: false }),
      repositories.kiosk().getKiosks(),
      repositories.restock().getRounds(currentEventId),
    ])
    const products = new Map(productList.map((p) => [p.id, p]))
    const ringOfKiosk = new Map(kioskList.map((k: Kiosk) => [k.id, k.ringId]))

    const overview = await getRestockOverview(currentEventId, products)

    // Een pallet rijdt door één ring, dus het openstaande werk wordt daar ook
    // per ring geteld. Hetzelfde product in twee ringen zijn twee regels.
    const perRing = new Map<string, Map<string, OpenProduct>>()
    for (const [productId, entry] of overview.byProduct) {
      const product = products.get(productId)
      if (!product) continue

      for (const perKiosk of entry.perKiosk) {
        const kioskRingId = ringOfKiosk.get(perKiosk.kioskId)
        if (!kioskRingId) continue

        const forRing = perRing.get(kioskRingId) ?? new Map<string, OpenProduct>()
        const row = forRing.get(productId) ?? { product, packages: 0, kioskCount: 0 }
        row.packages += perKiosk.packages
        row.kioskCount += 1
        forRing.set(productId, row)
        perRing.set(kioskRingId, forRing)
      }
    }

    const sorted = new Map(
      [...perRing].map(([id, rows]) => [
        id,
        [...rows.values()].sort((a, b) => b.packages - a.packages),
      ])
    )

    setOpenByRing(sorted)
    setRoundCount(rounds.length)
    setSelected(new Set())
    setRingId((current) => (sorted.has(current) ? current : ([...sorted.keys()][0] ?? '')))
    setIsLoading(false)
  }, [])

  useEffect(() => {
    if (!eventId) return
    loadOpenWork(eventId).catch((loadError: unknown) => {
      console.error('[pallet] Openstaand werk laden mislukt.', loadError)
      setError('Het openstaande werk kon niet worden geladen.')
      setIsLoading(false)
    })
  }, [eventId, loadOpenWork])

  const ringsWithWork = useMemo(
    () => rings.filter((ring) => (openByRing.get(ring.id)?.length ?? 0) > 0),
    [rings, openByRing]
  )

  const rows = openByRing.get(ringId) ?? []
  const selectedRows = rows.filter((row) => selected.has(row.product.id))
  const selectedPackages = selectedRows.reduce((sum, row) => sum + row.packages, 0)

  function toggle(productId: string) {
    setSelected((previous) => {
      const next = new Set(previous)
      if (next.has(productId)) next.delete(productId)
      else next.add(productId)
      return next
    })
  }

  async function handleStart() {
    if (!profile || selectedRows.length === 0) return

    setIsStarting(true)
    setError(null)
    try {
      const { round, firstStopId } = await startPalletRound({
        eventId,
        ringId,
        productIds: selectedRows.map((row) => row.product.id),
        productNames: new Map(selectedRows.map((row) => [row.product.id, row.product.name])),
        userId: profile.id,
        sequenceNumber: roundCount + 1,
      })

      // Zonder halte valt er niets te rijden; dan is de rondepagina het
      // eerlijkste antwoord — daar staat wat er wél mee gebeurd is.
      router.push(
        firstStopId
          ? `/restock-rounds/${round.id}/stop/${firstStopId}`
          : `/restock-rounds/${round.id}`
      )
    } catch (startError) {
      console.error('[pallet] Ronde starten mislukt.', startError)
      setError(startError instanceof Error ? startError.message : 'Starten is mislukt.')
      setIsStarting(false)
    }
  }

  return (
    <>
      <AppHeader title="Pallet pakken" backHref="/restock-rounds" />

      <div className="space-y-3 p-4 pb-28">
        {error && (
          <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
            {error}
          </p>
        )}

        {events.length > 1 && (
          <Select
            label="Evenement"
            value={eventId}
            onChange={(e) => setEventId(e.target.value)}
            options={events.map((event) => ({ value: event.id, label: event.name }))}
          />
        )}

        {ringsWithWork.length > 1 && (
          <fieldset>
            <legend className="mb-1 text-sm font-medium text-gray-700">Ring</legend>
            <div className="grid grid-cols-2 gap-2">
              {ringsWithWork.map((ring) => (
                <label
                  key={ring.id}
                  className={`flex min-h-12 cursor-pointer items-center justify-center rounded-xl border px-2 text-center text-sm font-medium ${
                    ringId === ring.id
                      ? 'border-arena-red bg-red-50 text-arena-red'
                      : 'border-gray-300 bg-white text-gray-800'
                  }`}
                >
                  <input
                    type="radio"
                    name="ring"
                    value={ring.id}
                    checked={ringId === ring.id}
                    onChange={() => {
                      setRingId(ring.id)
                      setSelected(new Set())
                    }}
                    className="sr-only"
                  />
                  {ring.name}
                </label>
              ))}
            </div>
          </fieldset>
        )}

        {isLoading ? (
          <ListSkeleton count={6} />
        ) : rows.length === 0 ? (
          <EmptyState
            title="Niets te vullen"
            description="Er staat voor dit evenement geen tekort meer open. Keur eerst een telling goed."
            icon="✅"
          />
        ) : (
          <>
            <p className="text-sm text-gray-600">
              Tik aan wat je op de pallet hebt staan. De route wordt daarop gemaakt.
            </p>

            <ul className="space-y-1.5">
              {rows.map((row) => {
                const isSelected = selected.has(row.product.id)
                return (
                  <li key={row.product.id}>
                    <button
                      type="button"
                      onClick={() => toggle(row.product.id)}
                      aria-pressed={isSelected}
                      className={`flex min-h-16 w-full items-center gap-3 rounded-xl border px-3 py-2 text-left ${
                        isSelected
                          ? 'border-arena-red bg-red-50'
                          : 'border-gray-200 bg-white active:bg-gray-50'
                      }`}
                    >
                      {/* Vinkje én kleur: op een fel verlicht bediengangscherm
                          is kleur alleen niet genoeg. */}
                      <span
                        aria-hidden="true"
                        className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md border-2 text-sm font-bold ${
                          isSelected
                            ? 'border-arena-red bg-arena-red text-white'
                            : 'border-gray-300 text-transparent'
                        }`}
                      >
                        ✓
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold text-gray-900">
                          {row.product.name}
                        </span>
                        <span className="block text-xs text-gray-600">
                          {row.kioskCount} {row.kioskCount === 1 ? 'kiosk' : 'kiosken'}
                        </span>
                      </span>
                      <span className="whitespace-nowrap text-right">
                        <span className="block text-xl font-bold text-gray-900">
                          {row.packages}
                        </span>
                        <span className="block text-xs text-gray-600">
                          {row.product.packagingUnit}
                        </span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </div>

      {rows.length > 0 && (
        <div className="fixed bottom-[4.5rem] left-0 right-0 z-30 border-t border-gray-200 bg-white p-4 shadow-[0_-4px_12px_rgba(0,0,0,0.06)]">
          <Button
            size="lg"
            className="w-full"
            disabled={isStarting || selectedRows.length === 0}
            onClick={() => void handleStart()}
          >
            {isStarting
              ? 'Bezig…'
              : selectedRows.length === 0
                ? 'Tik aan wat je hebt gepakt'
                : `Rijden — ${selectedRows.length} ${
                    selectedRows.length === 1 ? 'product' : 'producten'
                  }, ${selectedPackages} verpakkingen →`}
          </Button>
        </div>
      )}
    </>
  )
}
