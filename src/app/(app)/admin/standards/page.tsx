'use client'

import { useEffect, useState } from 'react'
import { AppHeader } from '@/components/layout/AppHeader'
import { ListSkeleton } from '@/components/shared/LoadingSkeleton'
import { repositories } from '@/repositories'
import { fromQuarterUnits, formatQuantity } from '@/lib/quarterUnits'
import type { Product, Ring } from '@/types'

interface MatrixData {
  products: Product[]
  kiosks: Array<{ id: string; number: number }>
  standards: Record<string, Record<string, { targetQuantityQuarters: number }>>
}

export default function AdminStandardsPage() {
  const [rings, setRings] = useState<Ring[]>([])
  const [activeRingId, setActiveRingId] = useState<string | null>(null)
  const [matrix, setMatrix] = useState<MatrixData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    repositories.kiosk().getRings().then((r) => {
      setRings(r)
      if (r[0]) {
        setActiveRingId(r[0].id)
      }
      setIsLoading(false)
    })
  }, [])

  useEffect(() => {
    if (!activeRingId) return
    setIsLoading(true)
    repositories.product().getStandardMatrix(activeRingId).then((m) => {
      setMatrix(m)
      setIsLoading(false)
    })
  }, [activeRingId])

  return (
    <>
      <AppHeader title="Voorraadnormen" backHref="/dashboard" />
      <div className="p-4">
        {/* Ring selector */}
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
          {rings.map((ring) => (
            <button
              key={ring.id}
              type="button"
              onClick={() => setActiveRingId(ring.id)}
              className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                activeRingId === ring.id
                  ? 'bg-arena-red text-white'
                  : 'bg-gray-100 text-gray-700'
              }`}
            >
              {ring.name}
            </button>
          ))}
        </div>

        {isLoading || !matrix ? (
          <ListSkeleton count={3} />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr>
                  <th className="sticky left-0 bg-white py-2 pr-3 text-left font-semibold text-gray-700">
                    Product
                  </th>
                  {matrix.kiosks.map((k) => (
                    <th
                      key={k.id}
                      className="min-w-[3rem] px-1 py-2 text-center font-medium text-gray-500"
                    >
                      {k.number}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrix.products.map((product) => (
                  <tr key={product.id} className="border-t border-gray-100">
                    <td className="sticky left-0 bg-white py-2 pr-3 font-medium text-gray-800">
                      {product.shortName}
                    </td>
                    {matrix.kiosks.map((kiosk) => {
                      const std = matrix.standards[product.id]?.[kiosk.id]
                      const qty = std ? fromQuarterUnits(std.targetQuantityQuarters) : 0
                      return (
                        <td
                          key={kiosk.id}
                          className={`px-1 py-2 text-center ${qty === 0 ? 'text-gray-300' : 'text-gray-900'}`}
                        >
                          {qty === 0 ? '–' : formatQuantity(qty)}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
