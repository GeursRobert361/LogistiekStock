'use client'

import { Button } from '@/components/ui/Button'
import { fromQuarterUnits, formatQuantity } from '@/lib/quarterUnits'
import { KioskCountStatus } from '@/types'
import type { CountEntry, KioskCount, Product } from '@/types'

interface KioskReviewDetailProps {
  kioskCount: KioskCount | null
  entries: CountEntry[]
  productById: Map<string, Product>
  canReopen: boolean
  onReopen: (kioskCount: KioskCount) => void
}

/**
 * Detail van één getelde kiosk: wat er stond, wat dat effectief is en wat
 * er bij moet. Ook de notitie en de reden van overslaan horen hier thuis —
 * dat is de context die de planner nodig heeft.
 */
export function KioskReviewDetail({
  kioskCount,
  entries,
  productById,
  canReopen,
  onReopen,
}: KioskReviewDetailProps) {
  if (!kioskCount) {
    return <p className="text-sm text-gray-600">Deze kiosk is nog niet geteld.</p>
  }

  const sorted = [...entries].sort((a, b) => {
    const left = productById.get(a.productId)?.sortOrder ?? 0
    const right = productById.get(b.productId)?.sortOrder ?? 0
    return left - right
  })

  return (
    <div className="space-y-3">
      {kioskCount.status === KioskCountStatus.SKIPPED && kioskCount.skipReason && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <span className="font-semibold">Overgeslagen:</span> {kioskCount.skipReason}
        </p>
      )}

      {kioskCount.generalNotes && (
        <p className="rounded-lg bg-white px-3 py-2 text-sm text-gray-800">
          <span className="font-semibold">Notitie:</span> {kioskCount.generalNotes}
        </p>
      )}

      {sorted.length === 0 ? (
        <p className="text-sm text-gray-600">Geen telregels vastgelegd.</p>
      ) : (
        <ul className="divide-y divide-gray-200 overflow-hidden rounded-lg bg-white">
          {sorted.map((entry) => {
            const product = productById.get(entry.productId)
            const needsRestock = entry.restockQuantityPackages > 0
            return (
              <li key={entry.id} className="px-3 py-2">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm font-medium text-gray-900">
                    {product?.shortName ?? entry.productId}
                  </span>
                  <span
                    className={`whitespace-nowrap text-sm font-bold ${
                      needsRestock ? 'text-orange-800' : 'text-green-800'
                    }`}
                  >
                    {needsRestock ? `+${entry.restockQuantityPackages}` : '✓ Vol'}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-gray-600">
                  Norm {formatQuantity(fromQuarterUnits(entry.targetQuantityQuarters))} · Geteld{' '}
                  {formatQuantity(fromQuarterUnits(entry.countedQuantityQuarters))} · Effectief{' '}
                  {formatQuantity(fromQuarterUnits(entry.effectiveQuantityQuarters))}
                </p>
              </li>
            )
          })}
        </ul>
      )}

      {canReopen && kioskCount.status !== KioskCountStatus.IN_PROGRESS && (
        <Button variant="outline" size="md" className="w-full" onClick={() => onReopen(kioskCount)}>
          Kiosk heropenen
        </Button>
      )}
    </div>
  )
}
