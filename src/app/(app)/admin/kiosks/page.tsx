'use client'

import { useEffect, useState } from 'react'
import { AppHeader } from '@/components/layout/AppHeader'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/shared/EmptyState'
import { ListSkeleton } from '@/components/shared/LoadingSkeleton'
import { repositories } from '@/repositories'
import type { Kiosk, Ring } from '@/types'

export default function AdminKiosksPage() {
  const [kiosks, setKiosks] = useState<Kiosk[]>([])
  const [rings, setRings] = useState<Ring[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeRingId, setActiveRingId] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      repositories.kiosk().getRings(),
      repositories.kiosk().getKiosks(),
    ]).then(([r, k]) => {
      setRings(r)
      setKiosks(k)
      setActiveRingId(r[0]?.id ?? null)
      setIsLoading(false)
    })
  }, [])

  const filtered = activeRingId ? kiosks.filter((k) => k.ringId === activeRingId) : kiosks

  return (
    <>
      <AppHeader title="Kiosken beheer" backHref="/dashboard" />
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

        {isLoading ? (
          <ListSkeleton count={5} />
        ) : filtered.length === 0 ? (
          <EmptyState title="Geen kiosken" icon="🏪" />
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {filtered.map((kiosk) => (
              <Card key={kiosk.id}>
                <CardContent className="py-3 text-center">
                  <p className="text-2xl font-bold text-gray-900">{kiosk.number}</p>
                  {kiosk.name && (
                    <p className="mt-0.5 truncate text-xs text-gray-500">{kiosk.name}</p>
                  )}
                  {!kiosk.isActive && (
                    <Badge variant="default" className="mt-1">Inactief</Badge>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
