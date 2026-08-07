'use client'

import { QuarterQuantityInput } from './QuarterQuantityInput'
import { calculateRestockQuantity } from '@/domain/counting/calculateRestock'
import { fromQuarterUnits, formatQuantity } from '@/lib/quarterUnits'
import { cn } from '@/lib/utils'
import type { Product } from '@/types'

interface ProductCountRowProps {
  product: Product
  /** Norm in kwarteenheden. */
  targetQuantityQuarters: number
  /** Getelde waarde in kwarteenheden, of `undefined` als er nog niet geteld is. */
  countedQuantityQuarters: number | undefined
  onCountChange: (productId: string, valueQuarters: number) => void
  onCountClear: (productId: string) => void
  halfPackageThresholdPercentage?: number
}

export function ProductCountRow({
  product,
  targetQuantityQuarters,
  countedQuantityQuarters,
  onCountChange,
  onCountClear,
  halfPackageThresholdPercentage = 80,
}: ProductCountRowProps) {
  const targetQty = fromQuarterUnits(targetQuantityQuarters)
  const isCounted = countedQuantityQuarters !== undefined
  const countedQty = isCounted ? fromQuarterUnits(countedQuantityQuarters) : undefined

  // Zolang er niet geteld is, bestaat er geen bijvuladvies. Een ontbrekende
  // waarde is nadrukkelijk niet hetzelfde als 0.
  const result =
    countedQty === undefined
      ? null
      : calculateRestockQuantity({
          targetQuantity: targetQty,
          countedQuantity: countedQty,
          halfPackageThresholdPercentage,
        })

  const isFull = result !== null && result.restockQuantity === 0
  const isAboveNorm = countedQty !== undefined && targetQty > 0 && countedQty > targetQty * 1.2

  return (
    <div
      className={cn(
        'rounded-xl border p-3',
        !isCounted
          ? 'border-dashed border-gray-300 bg-white'
          : isFull
            ? 'border-green-300 bg-green-50'
            : 'border-orange-200 bg-orange-50/40'
      )}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-gray-900">{product.name}</p>
          <p className="text-xs text-gray-600">
            Norm: {formatQuantity(targetQty)} {product.packagingUnit}
            {' · '}
            Aanwezig: {countedQty === undefined ? '—' : formatQuantity(countedQty)}
          </p>
        </div>

        <div
          className={cn(
            'flex-shrink-0 whitespace-nowrap rounded-lg px-2.5 py-1 text-sm font-bold',
            !isCounted
              ? 'bg-gray-100 text-gray-600'
              : isFull
                ? 'bg-green-100 text-green-800'
                : result !== null && result.restockQuantity >= 5
                  ? 'bg-red-100 text-red-800'
                  : 'bg-orange-100 text-orange-800'
          )}
        >
          {!isCounted
            ? 'Nog tellen'
            : isFull
              ? '✓ Vol'
              : `Bijvullen +${result?.restockQuantity ?? 0}`}
        </div>
      </div>

      <QuarterQuantityInput
        value={countedQty}
        onChange={(val) => onCountChange(product.id, Math.round(val * 4))}
        onClear={() => onCountClear(product.id)}
        step={product.inputStep as 1 | 0.5 | 0.25}
        targetQuantity={targetQty}
      />

      {isCounted && result !== null && !isFull && (
        <p className="mt-2 text-xs text-gray-600">
          Effectief {formatQuantity(result.effectiveQuantity)} → bijvullen{' '}
          <span className="font-semibold">
            {result.restockQuantity} {product.packagingUnit}
          </span>
        </p>
      )}

      {isAboveNorm && (
        <p
          className="mt-2 rounded-lg bg-yellow-50 px-3 py-1.5 text-xs font-medium text-yellow-800"
          role="alert"
        >
          ⚠️ Geteld aantal ligt meer dan 20% boven de norm
        </p>
      )}
    </div>
  )
}
