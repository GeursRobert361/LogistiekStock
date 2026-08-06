'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { ProductCountRow } from './ProductCountRow'
import type { Product, KioskProductStandard } from '@/types'

interface CategoryAccordionProps {
  categoryName: string
  products: Product[]
  standards: Map<string, KioskProductStandard>
  counts: Map<string, number> // productId → quarter units
  onCountChange: (productId: string, quarters: number) => void
  defaultOpen?: boolean
}

export function CategoryAccordion({
  categoryName,
  products,
  standards,
  counts,
  onCountChange,
  defaultOpen = true,
}: CategoryAccordionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  const filledCount = products.filter((p) => {
    const counted = counts.get(p.id)
    return counted !== undefined && counted > 0
  }).length

  const isComplete = filledCount === products.length

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200">
      <button
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between bg-gray-50 px-4 py-3"
      >
        <div className="flex items-center gap-2">
          <span className="font-semibold text-gray-900">{categoryName}</span>
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-xs font-medium',
              isComplete ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'
            )}
            aria-label={`${filledCount} van ${products.length} ingevuld`}
          >
            {filledCount}/{products.length}
          </span>
        </div>
        <span aria-hidden="true" className="text-gray-400">
          {isOpen ? '▲' : '▼'}
        </span>
      </button>

      {isOpen && (
        <div className="divide-y divide-gray-100 bg-white">
          {products.map((product) => {
            const std = standards.get(product.id)
            const targetQuarters = std?.targetQuantityQuarters ?? 0
            const countedQuarters = counts.get(product.id) ?? 0

            return (
              <div key={product.id} className="p-3">
                <ProductCountRow
                  product={product}
                  targetQuantityQuarters={targetQuarters}
                  countedQuantityQuarters={countedQuarters}
                  onCountChange={onCountChange}
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
