'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { cn } from '@/lib/utils'
import { DELIVERY_REASON_OPTIONS } from '@/lib/reasons'
import { DeliveryReason } from '@/types'
import type { Product } from '@/types'
import type { StopProductPlan } from '@/services/deliveryService'

interface DeliveryProductRowProps {
  product: Product | undefined
  plan: StopProductPlan
  /** Waar de voorraad van dit product bij deze kiosk ligt, als dat afwijkt. */
  storageNote?: string
  onSubmit: (params: {
    productId: string
    plannedPackages: number
    deliveredPackages: number
    reason?: DeliveryReason
    reasonNotes?: string
  }) => Promise<void>
}

/**
 * Eén product bij één kiosk afleveren.
 *
 * De snelweg is "Alles geleverd" — dat is verreweg het meest voorkomende
 * geval. Wijkt het af, dan verschijnt pas dan het redenveld.
 */
export function DeliveryProductRow({
  product,
  plan,
  storageNote,
  onSubmit,
}: DeliveryProductRowProps) {
  const [delivered, setDelivered] = useState(String(plan.plannedPackages))
  const [reason, setReason] = useState<DeliveryReason | ''>('')
  const [reasonNotes, setReasonNotes] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const deliveredNumber = Number(delivered.replace(',', '.'))
  const isDeviation = Number.isFinite(deliveredNumber) && deliveredNumber !== plan.plannedPackages

  async function submit(amount: number, withReason?: DeliveryReason) {
    setIsSaving(true)
    setError(null)
    try {
      await onSubmit({
        productId: plan.productId,
        plannedPackages: plan.plannedPackages,
        deliveredPackages: amount,
        reason: withReason,
        reasonNotes: withReason === DeliveryReason.ANDERE_REDEN ? reasonNotes : undefined,
      })
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Opslaan is mislukt.')
    } finally {
      setIsSaving(false)
    }
  }

  function handleConfirm() {
    if (!Number.isFinite(deliveredNumber) || deliveredNumber < 0 || !Number.isInteger(deliveredNumber)) {
      setError('Vul een heel aantal verpakkingen in.')
      return
    }
    if (isDeviation && !reason) {
      setError('Kies een reden voor de afwijking.')
      return
    }
    void submit(deliveredNumber, isDeviation ? (reason as DeliveryReason) : undefined)
  }

  if (plan.isDelivered) {
    return (
      <div className="rounded-xl border border-green-300 bg-green-50 p-3">
        <div className="flex items-baseline justify-between gap-2">
          <p className="min-w-0 truncate font-semibold text-gray-900">
            {product?.name ?? plan.productId}
          </p>
          <p className="whitespace-nowrap text-sm font-bold text-green-800">
            ✓ {plan.deliveredPackages} van {plan.plannedPackages} geleverd
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('rounded-xl border p-3', 'border-gray-200 bg-white')}>
      <div className="mb-2">
        <p className="font-semibold text-gray-900">{product?.name ?? plan.productId}</p>

        {/* Waar de voorraad ligt. Staat hier en niet bovenaan de kiosk, omdat
            het pas iets betekent op het moment dat je dit product in handen
            hebt. Verdwijnt zodra de regel bevestigd is: dan is het geen
            aanwijzing meer maar ruis. */}
        {storageNote && (
          <p className="mt-1 flex items-start gap-1.5 rounded-lg bg-amber-50 px-2 py-1.5 text-sm font-medium text-amber-900">
            <span aria-hidden="true">📦</span>
            <span>{storageNote}</span>
          </p>
        )}

        {/* Het aantal dat eruit moet, op afstand leesbaar met een pallet in de
            hand. De norm eronder is de controle achteraf: klopt wat er staat? */}
        <div className="mt-1 flex items-end justify-between gap-3">
          <p className="leading-none">
            <span className="text-5xl font-black text-gray-900">{plan.plannedPackages}</span>{' '}
            <span className="text-base text-gray-700">{product?.packagingUnit ?? ''}</span>
            <span className="mt-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
              Te leveren
            </span>
          </p>
          {plan.targetPackages !== undefined && (
            <p className="whitespace-nowrap text-right leading-none">
              <span className="text-2xl font-bold text-gray-700">{plan.targetPackages}</span>
              <span className="mt-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                Moet er staan
              </span>
            </p>
          )}
        </div>
      </div>

      {!isEditing ? (
        <div className="flex gap-2">
          <Button
            size="lg"
            className="flex-1"
            disabled={isSaving}
            onClick={() => void submit(plan.plannedPackages)}
          >
            Alles geleverd
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={() => setIsEditing(true)}
            disabled={isSaving}
          >
            Anders
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <div>
            <label
              htmlFor={`delivered-${plan.productId}`}
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Geleverd
            </label>
            <input
              id={`delivered-${plan.productId}`}
              type="text"
              inputMode="numeric"
              value={delivered}
              onChange={(e) => {
                setDelivered(e.target.value)
                setError(null)
              }}
              className="h-14 w-full rounded-xl border border-gray-300 text-center text-2xl font-bold text-gray-900 focus:border-arena-red focus:outline-none focus:ring-2 focus:ring-arena-red/30"
            />
          </div>

          {isDeviation && (
            <>
              <Select
                label="Reden van afwijking"
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value as DeliveryReason)
                  setError(null)
                }}
                options={[
                  { value: '', label: 'Kies een reden…' },
                  ...DELIVERY_REASON_OPTIONS,
                ]}
              />
              {reason === DeliveryReason.ANDERE_REDEN && (
                <div>
                  <label
                    htmlFor={`reason-notes-${plan.productId}`}
                    className="mb-1 block text-sm font-medium text-gray-700"
                  >
                    Licht toe
                  </label>
                  <textarea
                    id={`reason-notes-${plan.productId}`}
                    value={reasonNotes}
                    onChange={(e) => setReasonNotes(e.target.value)}
                    rows={2}
                    className="w-full rounded-xl border border-gray-300 p-3 text-base text-gray-900 focus:border-arena-red focus:outline-none focus:ring-2 focus:ring-arena-red/30"
                  />
                </div>
              )}
              <p className="text-xs text-gray-600">
                Het verschil van {Math.max(0, plan.plannedPackages - deliveredNumber)} blijft
                openstaan en komt terug in de vulplanning.
              </p>
            </>
          )}

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="md"
              className="flex-1"
              onClick={() => {
                setIsEditing(false)
                setDelivered(String(plan.plannedPackages))
                setReason('')
                setError(null)
              }}
            >
              Terug
            </Button>
            <Button size="md" className="flex-1" disabled={isSaving} onClick={handleConfirm}>
              {isSaving ? 'Bezig…' : 'Bevestigen'}
            </Button>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-2 text-sm font-medium text-red-700">
          {error}
        </p>
      )}
    </div>
  )
}
