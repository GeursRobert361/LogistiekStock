'use client'

import { use, useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AppHeader } from '@/components/layout/AppHeader'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/shared/EmptyState'
import { DeliveryProductRow } from '@/components/restock/DeliveryProductRow'
import { KioskPlate } from '@/components/shared/KioskPlate'
import { repositories } from '@/repositories'
import { useAuth } from '@/context/AuthContext'
import {
  completeStop,
  getRoundPlan,
  getStopPlan,
  registerDelivery,
  flushPendingDeliveryWrites,
  type StopPlan,
} from '@/services/deliveryService'
import type { DeliveryReason, Kiosk, Product } from '@/types'

export default function RestockStopPage({
  params,
}: {
  params: Promise<{ roundId: string; stopId: string }>
}) {
  const { roundId, stopId } = use(params)
  const { profile } = useAuth()
  const router = useRouter()

  const [stopPlan, setStopPlan] = useState<StopPlan | null>(null)
  const [products, setProducts] = useState<Map<string, Product>>(new Map())
  const [kiosk, setKiosk] = useState<Kiosk | null>(null)
  const [notes, setNotes] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isWorking, setIsWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const plan = await getStopPlan(roundId, stopId)
    const [productList, kioskData] = await Promise.all([
      repositories.product().getProducts({ activeOnly: false }),
      repositories.kiosk().getKioskById(plan.stop.kioskId),
    ])
    setStopPlan(plan)
    setProducts(new Map(productList.map((p) => [p.id, p])))
    setKiosk(kioskData)
    setNotes(plan.stop.notes ?? '')
    setIsLoading(false)
  }, [roundId, stopId])

  useEffect(() => {
    load().catch((loadError: unknown) => {
      console.error('[aflevering] Laden mislukt.', loadError)
      setError('Deze halte kon niet worden geladen.')
      setIsLoading(false)
    })
  }, [load])

  async function handleDelivery(params: {
    productId: string
    plannedPackages: number
    deliveredPackages: number
    reason?: DeliveryReason
    reasonNotes?: string
  }) {
    if (!profile) return
    setError(null)
    try {
      await registerDelivery({ roundId, stopId, userId: profile.id, ...params })
      await load()
    } catch (deliveryError) {
      console.error('[aflevering] Registreren mislukt.', deliveryError)
      setError(
        deliveryError instanceof Error ? deliveryError.message : 'Opslaan is mislukt.'
      )
      throw deliveryError
    }
  }

  async function handleCompleteStop() {
    setIsWorking(true)
    setError(null)
    try {
      await flushPendingDeliveryWrites()
      await completeStop(stopId, notes)

      const plan = await getRoundPlan(roundId)
      const next = plan.stops.find((stop) => !stop.completedAt)
      if (next) {
        router.push(`/restock-rounds/${roundId}/stop/${next.id}`)
      } else {
        router.push(`/restock-rounds/${roundId}`)
      }
    } catch (completeError) {
      console.error('[aflevering] Halte afronden mislukt.', completeError)
      setError('De halte kon niet worden afgerond.')
      setIsWorking(false)
    }
  }

  if (isLoading) {
    return (
      <>
        <AppHeader title="Aflevering" backHref={`/restock-rounds/${roundId}`} />
        <div className="p-4 text-center text-gray-500">Laden…</div>
      </>
    )
  }

  if (!stopPlan) {
    return (
      <>
        <AppHeader title="Aflevering" backHref={`/restock-rounds/${roundId}`} />
        <div className="p-4">
          <EmptyState title="Halte niet gevonden" icon="❌" />
        </div>
      </>
    )
  }

  const allHandled = stopPlan.products.every((p) => p.isDelivered)

  return (
    <>
      <AppHeader title={stopPlan.round.name} backHref={`/restock-rounds/${roundId}`} />

      {/* Het kiosknummer als bord — dit is waar de vuller op stuurt */}
      <div className="sticky top-14 z-30 border-b border-concrete-line bg-concrete px-4 py-2.5">
        <KioskPlate
          number={kiosk?.number}
          eyebrow={`Stop ${stopPlan.stopNumber} van ${stopPlan.totalStops}`}
          status={stopPlan.isCompleted ? 'Afgerond' : undefined}
        />
      </div>

      <div className="space-y-3 p-4">
        {error && (
          <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
            {error}
          </p>
        )}

        {stopPlan.products.map((item) => (
          <DeliveryProductRow
            key={item.productId}
            product={products.get(item.productId)}
            plan={item}
            onSubmit={handleDelivery}
          />
        ))}

        <div className="rounded-xl border border-gray-200 bg-white p-3">
          <label htmlFor="stop-notes" className="mb-1 block text-sm font-medium text-gray-700">
            Notitie bij deze kiosk
          </label>
          <textarea
            id="stop-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Optioneel"
            className="w-full rounded-xl border border-gray-300 p-3 text-base text-gray-900 placeholder:text-gray-400 focus:border-arena-red focus:outline-none focus:ring-2 focus:ring-arena-red/30"
          />
        </div>
      </div>

      <div className="sticky bottom-[5.5rem] z-30 space-y-2 border-t border-gray-200 bg-white p-4 shadow-[0_-4px_12px_rgba(0,0,0,0.06)]">
        {!allHandled && (
          <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900">
            Nog {stopPlan.products.filter((p) => !p.isDelivered).length} product(en) te bevestigen
          </p>
        )}
        <Button
          size="lg"
          className="w-full"
          disabled={isWorking || !allHandled}
          onClick={() => void handleCompleteStop()}
        >
          {isWorking ? 'Bezig…' : 'Kiosk klaar — volgende →'}
        </Button>
      </div>
    </>
  )
}
