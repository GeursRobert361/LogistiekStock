'use client'

import { QuarterQuantityInput } from './QuarterQuantityInput'
import { calculateRestockQuantity } from '@/domain/counting/calculateRestock'
import { fromQuarterUnits, formatQuantity } from '@/lib/quarterUnits'
import { cn } from '@/lib/utils'
import type { Product } from '@/types'

interface ProductCountRowProps {
  product: Product
  /** Target quantity in quarter units (from norm) */
  targetQuantityQuarters: number
  /** Current counted value in quarter units */
  countedQuantityQuarters: number
  onCountChange: (productId: string, valueQuarters: number) => void
  halfPackageThresholdPercentage?: number
}

export function ProductCountRow({
  product,
  targetQuantityQuarters,
  countedQuantityQuarters,
  onCountChange,
  halfPackageThresholdPercentage = 80,
}: ProductCountRowProps) {
  const targetQty = fromQuarterUnits(targetQuantityQuarters)
  const countedQty = fromQuarterUnits(countedQuantityQuarters)

  const result = calculateRestockQuantity({
    targetQuantity: targetQty,
    countedQuantity: countedQty,
    halfPackageThresholdPercentage,
  })

  const isFull = result.restockQuantity === 0
  const isHigh = countedQty > targetQty * 1.2

  return (
    <div
      className={cn(
        'rounded-xl border p-3',
        isFull ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-white'
      )}
    >
      {/* Product naam + eenheid */}
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-gray-900">{product.name}</p>
          <p className="text-xs text-gray-500">
            Norm: {formatQuantity(targetQty)} {product.packagingUnit}
          </p>
        </div>
        {/* Bijvullen badge */}
        <div
          className={cn(
            'flex-shrink-0 rounded-lg px-2.5 py-1 text-sm font-bold',
            isFull
              ? 'bg-green-100 text-green-700'
              : result.restockQuantity >= 5
                ? 'bg-red-100 text-red-700'
                : 'bg-orange-100 text-orange-700'
          )}
          aria-label={`Bij te vullen: ${result.restockQuantity} ${product.packagingUnit}`}
        >
          {isFull ? '✓ Vol' : `+${result.restockQuantity}`}
        </div>
      </div>

      {/* Input */}
      <QuarterQuantityInput
        value={countedQty}
        onChange={(val) => onCountChange(product.id, Math.round(val * 4))}
        step={product.inputStep as 1 | 0.5 | 0.25}
        targetQuantity={targetQty}
      />

      {/* Waarschuwing */}
      {isHigh && (
        <p className="mt-2 rounded-lg bg-yellow-50 px-3 py-1.5 text-xs text-yellow-700" role="alert">
          ⚠️ Geteld aantal ligt 20% boven de norm
        </p>
      )}
    </div>
  )
}
