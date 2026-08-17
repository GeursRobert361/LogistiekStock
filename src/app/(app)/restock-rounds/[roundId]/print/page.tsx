'use client'

import { use, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { repositories } from '@/repositories'
import { useAuth } from '@/context/AuthContext'
import { getRoundPlan, type RoundPlan } from '@/services/deliveryService'
import {
  PrintableRestockStop,
  MAX_ITEMS_PER_PAGE,
} from '@/components/restock/PrintableRestockStop'
import { kioskTitle } from '@/lib/kiosk'
import { formatDate } from '@/lib/utils'
import type { Event, Kiosk, Product, Ring } from '@/types'
import './print.css'

/**
 * De vulronde op papier: één kiosk per A4.
 *
 * Niet elke vuller wil de hele ronde met een telefoon in zijn hand lopen. Dit
 * is dezelfde ronde, alleen anders getoond — er wordt niets herberekend en
 * niets weggeschreven. Het openen van deze pagina claimt de ronde niet, start
 * hem niet en maakt geen leveringen aan; wie een lijst wil printen mag daarmee
 * niet per ongeluk een ronde activeren.
 *
 * Printen gebeurt met de browser (`window.print()`), zodat er geen
 * PDF-bibliotheek bij hoeft. "Opslaan als pdf" zit daar bij elke browser in.
 */

interface PrintData {
  plan: RoundPlan
  products: Map<string, Product>
  categoryNames: Map<string, string>
  kiosks: Map<string, Kiosk>
  ring: Ring | undefined
  event: Event | undefined
}

export default function RestockRoundPrintPage({
  params,
}: {
  params: Promise<{ roundId: string }>
}) {
  const { roundId } = use(params)
  const { profile } = useAuth()

  const [data, setData] = useState<PrintData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    // Precies dezelfde bron als het digitale scherm; alleen lezen.
    const [plan, productList, categories, kioskList, rings] = await Promise.all([
      getRoundPlan(roundId),
      repositories.product().getProducts({ activeOnly: false }),
      repositories.product().getCategories({ includeInactive: true }),
      repositories.kiosk().getKiosks(),
      repositories.kiosk().getRings(),
    ])

    const event = await repositories
      .event()
      .getEventById(plan.round.eventId)
      .catch(() => null)

    setData({
      plan,
      products: new Map(productList.map((p) => [p.id, p])),
      categoryNames: new Map(categories.map((c) => [c.id, c.name])),
      kiosks: new Map(kioskList.map((k) => [k.id, k])),
      ring: rings.find((r) => r.id === plan.round.ringId),
      event: event ?? undefined,
    })
    setIsLoading(false)
  }, [roundId])

  useEffect(() => {
    load().catch((loadError: unknown) => {
      console.error('[vullijst] Laden mislukt.', loadError)
      setError('De vullijst kon niet worden geladen.')
      setIsLoading(false)
    })
  }, [load])

  if (isLoading) {
    return <p className="no-print p-4 text-center text-gray-500">Laden…</p>
  }

  if (error || !data) {
    return (
      <div className="no-print p-4">
        <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
          {error ?? 'De vullijst kon niet worden geladen.'}
        </p>
        <Link href={`/restock-rounds/${roundId}`} className="mt-3 inline-block underline">
          ← Terug naar vulronde
        </Link>
      </div>
    )
  }

  const { plan, products, categoryNames, kiosks, ring, event } = data
  const { round, stops } = plan

  // Alleen voorgedrukt wanneer het zonder extra query kan: de ingelogde
  // gebruiker is de toegewezen vuller. Anders blijft de regel leeg om zelf in
  // te vullen — dat is een papieren controle, geen digitale verplichting.
  const assignedUserName =
    profile && round.assignedUserId === profile.id ? profile.displayName : undefined

  // Regels weglaten om een pagina te halen mag niet: dan loopt er iemand met
  // een incomplete lijst rond. Melden dus, op het scherm.
  const tooLong = stops
    .map((stop) => ({
      stop,
      count: plan.stopItems.filter((item) => item.restockRoundStopId === stop.id).length,
    }))
    .filter((entry) => entry.count > MAX_ITEMS_PER_PAGE)

  return (
    <>
      <div className="no-print flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 py-3">
        <Link href={`/restock-rounds/${roundId}`} className="text-sm font-medium underline">
          ← Terug naar vulronde
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-600">
            {stops.length} {stops.length === 1 ? 'pagina' : "pagina's"}
          </span>
          {/* Bewust geen window.print() bij het openen: eerst kijken, dan
              printen. */}
          <button
            type="button"
            onClick={() => window.print()}
            className="min-h-11 rounded-xl bg-arena-red px-4 font-semibold text-white"
          >
            Printen
          </button>
        </div>
      </div>

      {tooLong.length > 0 && (
        <div className="no-print px-4 pt-3">
          <p role="alert" className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {tooLong.length === 1 ? 'Eén kiosk heeft' : `${tooLong.length} kiosken hebben`} meer
            producten dan er op één A4 passen (
            {tooLong.map((entry) => kioskTitle(kiosks.get(entry.stop.kioskId))).join(', ')}). Er
            wordt niets weggelaten; die pagina loopt door op een tweede vel.
          </p>
        </div>
      )}

      <div className="print-sheet">
        {stops.length === 0 ? (
          <p className="no-print p-4 text-center text-gray-600">
            Deze vulronde heeft nog geen route. Maak eerst de route, dan is er wat te printen.
          </p>
        ) : (
          stops.map((stop, index) => (
            <PrintableRestockStop
              key={stop.id}
              stop={stop}
              stopItems={plan.stopItems.filter((item) => item.restockRoundStopId === stop.id)}
              products={products}
              categoryNames={categoryNames}
              kiosk={kiosks.get(stop.kioskId)}
              index={index}
              totalStops={stops.length}
              previousKiosk={index > 0 ? kiosks.get(stops[index - 1]!.kioskId) : undefined}
              nextKiosk={
                index < stops.length - 1 ? kiosks.get(stops[index + 1]!.kioskId) : undefined
              }
              roundName={describeRound({ round: round.name, ring: ring?.name, event, date: round.createdAt })}
              assignedUserName={assignedUserName}
            />
          ))
        )}
      </div>
    </>
  )
}

/**
 * De regel onder de kiosknaam: waar dit vel bij hoort.
 *
 * Op één regel en klein, want het staat op elke pagina. Wat ontbreekt valt
 * gewoon weg in plaats van als "onbekend" te blijven staan.
 */
function describeRound(parts: {
  round: string
  ring?: string
  event?: Event
  date?: string
}): string {
  return [
    'StockFlow — Vullijst',
    parts.event?.name,
    parts.ring,
    parts.round,
    parts.date ? formatDate(parts.date.slice(0, 10)) : undefined,
  ]
    .filter(Boolean)
    .join(' · ')
}
