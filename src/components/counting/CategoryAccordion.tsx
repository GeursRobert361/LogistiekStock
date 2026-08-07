'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { ProductCountRow } from './ProductCountRow'
import type { Product, KioskProductStandard } from '@/types'

interface CategoryAccordionProps {
  categoryName: string
  products: Product[]
  standards: Map<string, KioskProductStandard>
  /** productId → kwarteenheden. Ontbrekende sleutel = nog niet geteld. */
  counts: Map<string, number>
  onCountChange: (productId: string, quarters: number) => void
  onCountClear: (productId: string) => void
  defaultOpen?: boolean
  /** Wanneer gezet, klapt de categorie open en springt de focus naar dit product. */
  focusProductId?: string | null
}

export function CategoryAccordion({
  categoryName,
  products,
  standards,
  counts,
  onCountChange,
  onCountClear,
  defaultOpen = true,
  focusProductId = null,
}: CategoryAccordionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  const containsFocus =
    focusProductId !== null && products.some((p) => p.id === focusProductId)

  useEffect(() => {
    if (containsFocus) setIsOpen(true)
  }, [containsFocus])

  // Een expliciete 0 is ingevuld. Daarom telt de aanwezigheid van de sleutel,
  // niet de waarde.
  const filledCount = products.filter((p) => counts.get(p.id) !== undefined).length
  const isComplete = filledCount === products.length

  return (
    <div className="overflow-hidden rounded-xl border border-concrete-line bg-plate shadow-plate">
      <button
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        aria-expanded={isOpen}
        className="flex min-h-14 w-full items-center justify-between border-b border-concrete-line bg-plate px-4 py-3"
      >
        <div className="flex items-center gap-2">
          <span className="font-semibold text-ink">{categoryName}</span>
          <span
            className={cn(
              'tabular rounded-full px-2 py-0.5 text-xs font-semibold',
              isComplete ? 'bg-emerald-50 text-emerald-800' : 'bg-concrete text-ink-muted'
            )}
          >
            {isComplete ? '✓ ' : ''}
            {filledCount}/{products.length}
          </span>
        </div>
        <span aria-hidden="true" className="text-ink-faint">
          {isOpen ? '▲' : '▼'}
        </span>
      </button>

      {isOpen && (
        <div className="divide-y divide-concrete-line bg-plate">
          {products.map((product) => {
            const std = standards.get(product.id)
            return (
              <div
                key={product.id}
                id={`product-${product.id}`}
                className={cn(
                  '',
                  focusProductId === product.id && 'ring-2 ring-inset ring-arena-red'
                )}
              >
                <ProductCountRow
                  product={product}
                  targetQuantityQuarters={std?.targetQuantityQuarters ?? 0}
                  countedQuantityQuarters={counts.get(product.id)}
                  onCountChange={onCountChange}
                  onCountClear={onCountClear}
                  halfPackageThresholdPercentage={std?.halfPackageThresholdPercentage ?? 80}
                />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
