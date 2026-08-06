'use client'

import { useEffect, useState } from 'react'
import { AppHeader } from '@/components/layout/AppHeader'
import { Card, CardContent } from '@/components/ui/Card'
import { repositories } from '@/repositories'
import type { Ring } from '@/types'

export default function AdminRingsPage() {
  const [rings, setRings] = useState<Ring[]>([])

  useEffect(() => {
    repositories.kiosk().getRings().then(setRings)
  }, [])

  return (
    <>
      <AppHeader title="Ringen" backHref="/dashboard" />
      <div className="space-y-2 p-4">
        {rings.map((ring) => (
          <Card key={ring.id}>
            <CardContent className="py-3">
              <p className="font-semibold text-gray-900">{ring.name}</p>
              {ring.description && (
                <p className="text-sm text-gray-500">{ring.description}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  )
}
