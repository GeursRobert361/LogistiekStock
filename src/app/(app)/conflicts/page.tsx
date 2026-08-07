'use client'

import { useCallback, useEffect, useState } from 'react'
import { kioskTitle } from '@/lib/kiosk'
import { AppHeader } from '@/components/layout/AppHeader'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/shared/EmptyState'
import { ListSkeleton } from '@/components/shared/LoadingSkeleton'
import { repositories } from '@/repositories'
import { useAuth } from '@/context/AuthContext'
import {
  getCountEntryConflicts,
  resolveConflict,
  type ConflictChoice,
  type CountEntryConflict,
} from '@/services/conflictService'
import { formatQuantity, fromQuarterUnits } from '@/lib/quarterUnits'
import { formatDateTime } from '@/lib/utils'
import type { Kiosk, KioskCount, Product } from '@/types'

export default function ConflictsPage() {
  const { profile } = useAuth()
  const [conflicts, setConflicts] = useState<CountEntryConflict[]>([])
  const [products, setProducts] = useState<Map<string, Product>>(new Map())
  const [kioskByCountId, setKioskByCountId] = useState<Map<string, Kiosk>>(new Map())
  const [isLoading, setIsLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const items = await getCountEntryConflicts()
    setConflicts(items)

    const [productList, kioskList] = await Promise.all([
      repositories.product().getProducts({ activeOnly: false }),
      repositories.kiosk().getKiosks(undefined, { includeInactive: true }),
    ])
    setProducts(new Map(productList.map((p) => [p.id, p])))

    // Van telregel naar kiosk: via de kiosktelling waar de regel bij hoort.
    const kioskById = new Map(kioskList.map((k) => [k.id, k]))
    const resolved = new Map<string, Kiosk>()
    const seenKioskCountIds = new Set(items.map((item) => item.local.kioskCountId))

    for (const kioskCountId of seenKioskCountIds) {
      const kioskCount = await findKioskCount(kioskCountId)
      const kiosk = kioskCount ? kioskById.get(kioskCount.kioskId) : undefined
      if (kiosk) resolved.set(kioskCountId, kiosk)
    }
    setKioskByCountId(resolved)
    setIsLoading(false)
  }, [])

  useEffect(() => {
    load().catch((loadError: unknown) => {
      console.error('[conflicten] Laden mislukt.', loadError)
      setError('De conflicten konden niet worden geladen.')
      setIsLoading(false)
    })
  }, [load])

  async function handleChoice(item: CountEntryConflict, choice: ConflictChoice) {
    if (!profile) return
    setBusyId(item.conflict.id)
    setError(null)
    try {
      await resolveConflict(item, choice, profile.id)
      await load()
    } catch (resolveError) {
      console.error('[conflicten] Oplossen mislukt.', resolveError)
      setError('De keuze kon niet worden opgeslagen.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <>
      <AppHeader title="Synchronisatieconflicten" backHref="/dashboard" />
      <div className="space-y-3 p-4">
        {error && (
          <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
            {error}
          </p>
        )}

        {isLoading ? (
          <ListSkeleton count={2} />
        ) : conflicts.length === 0 ? (
          <EmptyState
            title="Geen conflicten"
            description="Alle tellingen komen overeen met de server."
            icon="✅"
          />
        ) : (
          <>
            <p className="text-sm text-gray-700">
              Deze producten zijn op dit apparaat geteld terwijl er intussen een andere waarde op
              de server stond. Kies welke telling geldt.
            </p>

            {conflicts.map((item) => {
              const product = products.get(item.local.productId)
              const kiosk = kioskByCountId.get(item.local.kioskCountId)
              const isBusy = busyId === item.conflict.id

              return (
                <Card key={item.conflict.id}>
                  <CardContent className="space-y-3 py-3">
                    <div>
                      <p className="font-semibold text-gray-900">
                        {kiosk ? `${kioskTitle(kiosk)} — ` : ''}
                        {product?.name ?? item.local.productId}
                      </p>
                      <p className="text-xs text-gray-600">
                        Gesignaleerd {formatDateTime(item.conflict.detectedAt)}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <ConflictOption
                        title="Op dit apparaat"
                        quarters={item.local.countedQuantityQuarters}
                        restock={item.local.restockQuantityPackages}
                        modifiedAt={item.local.lastModifiedAt}
                        unit={product?.packagingUnit ?? ''}
                        disabled={isBusy}
                        onChoose={() => void handleChoice(item, 'LOCAL')}
                      />
                      <ConflictOption
                        title="Op de server"
                        quarters={item.server.countedQuantityQuarters}
                        restock={item.server.restockQuantityPackages}
                        modifiedAt={item.server.lastModifiedAt}
                        unit={product?.packagingUnit ?? ''}
                        disabled={isBusy}
                        onChoose={() => void handleChoice(item, 'SERVER')}
                      />
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </>
        )}
      </div>
    </>
  )
}

function ConflictOption({
  title,
  quarters,
  restock,
  modifiedAt,
  unit,
  disabled,
  onChoose,
}: {
  title: string
  quarters: number
  restock: number
  modifiedAt: string
  unit: string
  disabled: boolean
  onChoose: () => void
}) {
  return (
    <div className="flex flex-col rounded-xl border border-gray-200 p-3">
      <p className="text-xs font-medium text-gray-600">{title}</p>
      <p className="text-2xl font-bold text-gray-900">
        {formatQuantity(fromQuarterUnits(quarters))}
      </p>
      <p className="text-xs text-gray-600">
        Bijvullen {restock} {unit}
      </p>
      <p className="mt-0.5 text-[11px] text-gray-500">{formatDateTime(modifiedAt)}</p>
      <Button size="md" className="mt-2 w-full" disabled={disabled} onClick={onChoose}>
        Kies deze
      </Button>
    </div>
  )
}

/** Zoekt de kiosktelling waar een telregel bij hoort, lokaal en anders op de server. */
async function findKioskCount(kioskCountId: string): Promise<KioskCount | null> {
  const { getOfflineDb } = await import('@/lib/db/offlineDb')
  const local = await getOfflineDb().kioskCounts.get(kioskCountId)
  return local ?? null
}
