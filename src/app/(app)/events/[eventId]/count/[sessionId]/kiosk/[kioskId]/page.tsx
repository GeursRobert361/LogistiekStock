'use client'

import { use, useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { v4 as uuidv4 } from 'uuid'
import { AppHeader } from '@/components/layout/AppHeader'
import { Button } from '@/components/ui/Button'
import { CategoryAccordion } from '@/components/counting/CategoryAccordion'
import { ConfirmDialog } from '@/components/ui/Dialog'
import { repositories } from '@/repositories'
import { useAuth } from '@/context/AuthContext'
import {
  getLocalSession,
  saveKioskCountLocally,
  saveCountEntryLocally,
} from '@/lib/db/offlineDb'
import { calculateRestockQuantity } from '@/domain/counting/calculateRestock'
import { fromQuarterUnits } from '@/lib/quarterUnits'
import { KioskCountStatus } from '@/types'
import type {
  Kiosk,
  Product,
  ProductCategory,
  KioskProductStandard,
  CountSession,
  KioskCount,
} from '@/types'

interface PageParams {
  eventId: string
  sessionId: string
  kioskId: string
}

export default function KioskCountPage({ params }: { params: Promise<PageParams> }) {
  const { eventId, sessionId, kioskId } = use(params)
  const { profile } = useAuth()
  const router = useRouter()

  const [kiosk, setKiosk] = useState<Kiosk | null>(null)
  const [session, setSession] = useState<CountSession | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<ProductCategory[]>([])
  const [standards, setStandards] = useState<Map<string, KioskProductStandard>>(new Map())
  const [counts, setCounts] = useState<Map<string, number>>(new Map())
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [showSkipDialog, setShowSkipDialog] = useState(false)
  const [kioskCount, setKioskCount] = useState<KioskCount | null>(null)

  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    async function load() {
      const [kioskData, stdList, prodList, catList, storedSession] = await Promise.all([
        repositories.kiosk().getKioskById(kioskId),
        repositories.product().getStandards(kioskId),
        repositories.product().getProducts({ activeOnly: true }),
        repositories.product().getCategories(),
        getLocalSession(sessionId),
      ])

      setKiosk(kioskData)
      setSession(storedSession ?? null)
      setProducts(prodList)
      setCategories(catList)

      const stdMap = new Map(stdList.map((s) => [s.productId, s]))
      setStandards(stdMap)

      // Create/load KioskCount
      const existingCounts = await repositories.count().getKioskCountsForSession(sessionId)
      let kc = existingCounts.find((c) => c.kioskId === kioskId)
      if (!kc && profile) {
        kc = {
          id: uuidv4(),
          countSessionId: sessionId,
          kioskId,
          startedAt: new Date().toISOString(),
          counterId: profile.id,
          status: KioskCountStatus.IN_PROGRESS,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
        await saveKioskCountLocally(kc)
        try {
          await repositories.count().upsertKioskCount(kc)
        } catch {
          // offline
        }
      }
      setKioskCount(kc ?? null)

      // Load existing count entries
      if (kc) {
        const entries = await repositories.count().getEntriesForKioskCount(kc.id)
        const countMap = new Map(entries.map((e) => [e.productId, e.countedQuantityQuarters]))
        setCounts(countMap)
      }

      setIsLoading(false)
    }
    load()
  }, [kioskId, sessionId, profile])

  const handleCountChange = useCallback(
    async (productId: string, quarters: number) => {
      setCounts((prev) => new Map(prev).set(productId, quarters))

      // Debounced autosave
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
      autosaveTimer.current = setTimeout(async () => {
        if (!kioskCount || !profile) return
        const std = standards.get(productId)
        const targetQU = std?.targetQuantityQuarters ?? 0
        const result = calculateRestockQuantity({
          targetQuantity: fromQuarterUnits(targetQU),
          countedQuantity: fromQuarterUnits(quarters),
          halfPackageThresholdPercentage: std?.halfPackageThresholdPercentage ?? 80,
        })

        const entry = {
          id: uuidv4(),
          kioskCountId: kioskCount.id,
          productId,
          targetQuantityQuarters: targetQU,
          countedQuantityQuarters: quarters,
          effectiveQuantityQuarters: Math.round(result.effectiveQuantity * 4),
          restockQuantityPackages: result.restockQuantity,
          appliedFractionRule: result.appliedFractionRule,
          lastModifiedAt: new Date().toISOString(),
          lastModifiedById: profile.id,
        }

        await saveCountEntryLocally(entry)
        try {
          await repositories.count().upsertCountEntry(entry)
        } catch {
          // offline
        }
      }, 500)
    },
    [kioskCount, profile, standards]
  )

  async function handleComplete() {
    if (!kioskCount || !profile) return
    setIsSaving(true)

    const completedKc = {
      ...kioskCount,
      status: KioskCountStatus.COMPLETED,
      completedAt: new Date().toISOString(),
    }
    await saveKioskCountLocally(completedKc)
    try {
      await repositories.count().upsertKioskCount(completedKc)
    } catch {
      // offline
    }

    // Navigeer naar volgende kiosk
    if (session) {
      const routeIndex = session.kioskRoute.indexOf(kioskId)
      const nextKioskId = session.kioskRoute[routeIndex + 1]
      if (nextKioskId) {
        router.push(`/events/${eventId}/count/${sessionId}/kiosk/${nextKioskId}`)
      } else {
        // Laatste kiosk — terug naar evenement
        router.push(`/events/${eventId}/count/review`)
      }
    }
    setIsSaving(false)
  }

  // Voortgang in de route
  const routeIndex = session ? session.kioskRoute.indexOf(kioskId) : 0
  const totalKiosks = session?.kioskRoute.length ?? 1
  const progress = Math.round(((routeIndex + 1) / totalKiosks) * 100)

  // Groepeer producten per categorie
  const categoriesWithProducts = categories
    .map((cat) => ({
      ...cat,
      products: products.filter((p) => p.categoryId === cat.id && standards.has(p.id)),
    }))
    .filter((cat) => cat.products.length > 0)

  if (isLoading) {
    return (
      <>
        <AppHeader title={`Kiosk ${kioskId}`} backHref={`/events/${eventId}`} />
        <div className="p-4 text-center text-gray-500">Laden…</div>
      </>
    )
  }

  return (
    <>
      <AppHeader
        title={`Kiosk ${kiosk?.number ?? ''}`}
        backHref={`/events/${eventId}`}
      />

      {/* Kiosk voortgangsbalk */}
      <div className="sticky top-14 z-30 border-b border-gray-200 bg-white px-4 py-2">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs text-gray-500">
            Kiosk {routeIndex + 1} van {totalKiosks}
          </span>
          <span className="text-xs font-semibold text-gray-700">{progress}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-gray-200">
          <div
            className="h-full rounded-full bg-arena-red transition-all"
            style={{ width: `${progress}%` }}
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Voortgang telronde"
          />
        </div>

        {/* Kiosknummer groot */}
        <div className="mt-2 flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              const prevId = session?.kioskRoute[routeIndex - 1]
              if (prevId) router.push(`/events/${eventId}/count/${sessionId}/kiosk/${prevId}`)
            }}
            disabled={routeIndex === 0}
            aria-label="Vorige kiosk"
            className="rounded-lg p-1 text-gray-400 disabled:opacity-30"
          >
            ◀
          </button>
          <h2 className="text-4xl font-black text-arena-red">{kiosk?.number}</h2>
          <button
            type="button"
            onClick={() => {
              const nextId = session?.kioskRoute[routeIndex + 1]
              if (nextId) router.push(`/events/${eventId}/count/${sessionId}/kiosk/${nextId}`)
            }}
            disabled={routeIndex === totalKiosks - 1}
            aria-label="Volgende kiosk"
            className="rounded-lg p-1 text-gray-400 disabled:opacity-30"
          >
            ▶
          </button>
        </div>
      </div>

      <div className="space-y-3 p-4">
        {categoriesWithProducts.length === 0 ? (
          <p className="py-8 text-center text-gray-500">
            Geen normen ingesteld voor deze kiosk
          </p>
        ) : (
          categoriesWithProducts.map((cat) => (
            <CategoryAccordion
              key={cat.id}
              categoryName={cat.name}
              products={cat.products}
              standards={standards}
              counts={counts}
              onCountChange={handleCountChange}
            />
          ))
        )}

        {/* Acties */}
        <div className="space-y-2 pt-2">
          <Button
            size="lg"
            className="w-full"
            onClick={handleComplete}
            disabled={isSaving}
          >
            {isSaving ? 'Opslaan…' : 'Kiosk afronden ✓'}
          </Button>

          <Button
            variant="outline"
            size="md"
            className="w-full"
            onClick={() => setShowSkipDialog(true)}
          >
            Kiosk overslaan
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={showSkipDialog}
        onClose={() => setShowSkipDialog(false)}
        onConfirm={async () => {
          setShowSkipDialog(false)
          if (kioskCount) {
            const skipped = { ...kioskCount, status: KioskCountStatus.SKIPPED }
            await saveKioskCountLocally(skipped)
            try { await repositories.count().upsertKioskCount(skipped) } catch { /* offline */ }
          }
          const nextId = session?.kioskRoute[routeIndex + 1]
          if (nextId) {
            router.push(`/events/${eventId}/count/${sessionId}/kiosk/${nextId}`)
          } else {
            router.push(`/events/${eventId}/count/review`)
          }
        }}
        title="Kiosk overslaan"
        message="Weet je zeker dat je deze kiosk wilt overslaan? Je kunt de telling later nog aanvullen."
        confirmLabel="Overslaan"
        cancelLabel="Annuleren"
      />
    </>
  )
}
