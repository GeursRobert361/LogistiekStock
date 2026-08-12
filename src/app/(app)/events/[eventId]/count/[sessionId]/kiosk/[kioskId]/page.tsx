'use client'

import { use, useCallback, useEffect, useMemo, useState } from 'react'
import { kioskLabel } from '@/lib/kiosk'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AppHeader } from '@/components/layout/AppHeader'
import { Button } from '@/components/ui/Button'
import { CategoryAccordion } from '@/components/counting/CategoryAccordion'
import { SkipKioskDialog } from '@/components/counting/SkipKioskDialog'
import { KioskPlate } from '@/components/shared/KioskPlate'
import { repositories } from '@/repositories'
import { useAuth } from '@/context/AuthContext'
import {
  clearCount,
  completeKiosk,
  flushPendingCountWrites,
  getCompleteness,
  loadEntries,
  loadOrCreateKioskCount,
  loadSession,
  saveCount,
  saveKioskNotes,
  skipKiosk,
} from '@/services/countingService'
import { finishSessionIfComplete, pauseSession } from '@/services/countSessionService'
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
  const [kioskCount, setKioskCount] = useState<KioskCount | null>(null)
  const [notes, setNotes] = useState('')
  const [showNotes, setShowNotes] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [showSkipDialog, setShowSkipDialog] = useState(false)
  const [focusProductId, setFocusProductId] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  const profileId = profile?.id

  useEffect(() => {
    let cancelled = false

    async function load() {
      setIsLoading(true)
      const [kioskData, standardList, productList, categoryList, storedSession] =
        await Promise.all([
          repositories.kiosk().getKioskById(kioskId),
          repositories.product().getStandards(kioskId),
          repositories.product().getProducts({ activeOnly: true }),
          repositories.product().getCategories(),
          loadSession(sessionId),
        ])

      if (cancelled) return

      setKiosk(kioskData)
      setSession(storedSession)
      setProducts(productList)
      setCategories(categoryList)
      setStandards(new Map(standardList.map((s) => [s.productId, s])))

      if (!profileId) return

      const currentKioskCount = await loadOrCreateKioskCount({
        sessionId,
        kioskId,
        counterId: profileId,
      })
      if (cancelled) return

      setKioskCount(currentKioskCount)
      setNotes(currentKioskCount.generalNotes ?? '')
      setShowNotes(Boolean(currentKioskCount.generalNotes))

      const entries = await loadEntries(currentKioskCount.id)
      if (cancelled) return

      setCounts(new Map([...entries].map(([productId, e]) => [productId, e.countedQuantityQuarters])))
      setIsLoading(false)
    }

    load().catch((error: unknown) => {
      console.error('[telling] Laden van het telscherm mislukt.', error)
      if (!cancelled) setIsLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [kioskId, sessionId, profileId])

  // Wegnavigeren (ook via de browser) mag nooit een wijziging kwijtmaken.
  useEffect(() => {
    function flushNow() {
      void flushPendingCountWrites()
    }
    window.addEventListener('pagehide', flushNow)
    return () => {
      window.removeEventListener('pagehide', flushNow)
      flushNow()
    }
  }, [])

  const handleCountChange = useCallback(
    (productId: string, quarters: number) => {
      // Optimistisch renderen: de teller ziet het cijfer meteen staan.
      setCounts((prev) => new Map(prev).set(productId, quarters))
      setFocusProductId(null)

      if (!kioskCount || !profileId) return
      const standard = standards.get(productId)
      if (!standard) return

      saveCount({
        kioskCountId: kioskCount.id,
        productId,
        standard,
        countedQuarters: quarters,
        userId: profileId,
      }).catch((error: unknown) => {
        console.error('[telling] Opslaan van een telling mislukt.', error)
        setSaveError('Opslaan is mislukt. Probeer de waarde opnieuw in te voeren.')
      })
    },
    [kioskCount, profileId, standards]
  )

  const handleCountClear = useCallback(
    (productId: string) => {
      setCounts((prev) => {
        const next = new Map(prev)
        next.delete(productId)
        return next
      })

      if (!kioskCount || !profileId) return
      clearCount(kioskCount.id, productId, profileId).catch((error: unknown) => {
        console.error('[telling] Wissen van een telling mislukt.', error)
        setSaveError('Wissen is mislukt. Probeer het opnieuw.')
      })
    },
    [kioskCount, profileId]
  )

  const categoriesWithProducts = useMemo(
    () =>
      categories
        .map((cat) => ({
          ...cat,
          products: products
            .filter((p) => p.categoryId === cat.id && standards.has(p.id))
            .sort((a, b) => a.sortOrder - b.sortOrder),
        }))
        .filter((cat) => cat.products.length > 0),
    [categories, products, standards]
  )

  /** Verplicht te tellen: elk actief product met een norm voor deze kiosk. */
  const requiredProductIds = useMemo(
    () => categoriesWithProducts.flatMap((cat) => cat.products.map((p) => p.id)),
    [categoriesWithProducts]
  )

  const completeness = useMemo(
    () => getCompleteness(requiredProductIds, counts),
    [requiredProductIds, counts]
  )

  const routeIndex = session ? session.kioskRoute.indexOf(kioskId) : -1
  const totalKiosks = session?.kioskRoute.length ?? 0
  const stopNumber = routeIndex >= 0 ? routeIndex + 1 : 1
  const progress = totalKiosks > 0 ? Math.round((stopNumber / totalKiosks) * 100) : 0

  const navigateToRouteIndex = useCallback(
    async (index: number) => {
      if (!session) return
      const targetKioskId = session.kioskRoute[index]
      if (!targetKioskId) return
      await flushPendingCountWrites()
      router.push(`/events/${eventId}/count/${sessionId}/kiosk/${targetKioskId}`)
    },
    [session, router, eventId, sessionId]
  )

  function jumpToFirstMissing() {
    const first = completeness.missingProductIds[0]
    if (!first) return
    setFocusProductId(first)
    // De accordeon klapt zelf open; daarna kunnen we scrollen.
    requestAnimationFrame(() => {
      document.getElementById(`product-${first}`)?.scrollIntoView({ block: 'center' })
    })
  }

  async function handleComplete() {
    if (!kioskCount || !session || !completeness.isComplete) return
    setIsSaving(true)
    setSaveError(null)
    try {
      const completed = await completeKiosk(kioskCount)
      setKioskCount(completed)
      await goToNextStop()
    } catch (error) {
      console.error('[telling] Kiosk afronden mislukt.', error)
      setSaveError('Afronden is mislukt. Probeer het opnieuw.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleSkip(reason: string) {
    if (!kioskCount) return
    setShowSkipDialog(false)
    setIsSaving(true)
    setSaveError(null)
    try {
      const skipped = await skipKiosk(kioskCount, reason)
      setKioskCount(skipped)
      await goToNextStop()
    } catch (error) {
      console.error('[telling] Kiosk overslaan mislukt.', error)
      setSaveError('Overslaan is mislukt. Probeer het opnieuw.')
    } finally {
      setIsSaving(false)
    }
  }

  /** Volgende halte, of naar de review wanneer de ronde klaar is. */
  async function goToNextStop() {
    if (!session) return
    await flushPendingCountWrites()

    const finished = await finishSessionIfComplete(session)
    if (finished) {
      router.push(`/events/${eventId}/count/review?session=${session.id}`)
      return
    }

    const nextKioskId = session.kioskRoute[routeIndex + 1]
    if (nextKioskId) {
      router.push(`/events/${eventId}/count/${sessionId}/kiosk/${nextKioskId}`)
      return
    }
    router.push(`/events/${eventId}/count/review?session=${session.id}`)
  }

  async function handlePause() {
    if (!session) return
    await flushPendingCountWrites()
    await pauseSession(session)
    router.push(`/events/${eventId}`)
  }

  async function handleNotesBlur() {
    if (!kioskCount) return
    if ((kioskCount.generalNotes ?? '') === notes.trim()) return
    try {
      const updated = await saveKioskNotes(kioskCount, notes)
      setKioskCount(updated)
    } catch (error) {
      console.error('[telling] Opslaan van de kiosknotitie mislukt.', error)
      setSaveError('De notitie kon niet worden opgeslagen.')
    }
  }

  // Bij het doorklikken naar de volgende kiosk hergebruikt de router dit
  // component: de state van de vórige kiosk staat er dan nog even in. Zonder
  // deze controle zijn "Afronden" en "Overslaan" één frame lang actief op de
  // verkeerde kiosk — en slaat een snelle teller de vorige nóg eens over in
  // plaats van deze.
  if (isLoading || kioskCount?.kioskId !== kioskId) {
    return (
      <>
        <AppHeader title="Kiosk" backHref={`/events/${eventId}`} />
        <div className="p-4 text-center text-gray-500">Laden…</div>
      </>
    )
  }

  const isDone =
    kioskCount?.status === KioskCountStatus.COMPLETED ||
    kioskCount?.status === KioskCountStatus.SKIPPED

  return (
    <>
      {/* Het bord toont het kiosknummer al; de titel herhaalt dat niet. */}
      <AppHeader title="Tellen" backHref={`/events/${eventId}`} />

      {/* Voortgang + het kiosknummer als bord */}
      <div className="sticky top-14 z-30 border-b border-concrete-line bg-concrete px-4 py-2.5">
        <div className="h-1.5 overflow-hidden rounded-full bg-concrete-deep">
          <div
            className="h-full rounded-full bg-arena-red transition-[width] duration-300"
            style={{ width: `${progress}%` }}
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Voortgang telronde"
          />
        </div>

        <div className="mt-2 flex items-center gap-3">
          <button
            type="button"
            onClick={() => void navigateToRouteIndex(routeIndex - 1)}
            disabled={routeIndex <= 0}
            aria-label="Vorige kiosk"
            className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg text-ink-muted disabled:opacity-25"
          >
            ◀
          </button>

          <KioskPlate
            className="flex-1"
            label={kioskLabel(kiosk)}
            eyebrow={`Stop ${stopNumber} van ${totalKiosks}`}
            status={
              isDone
                ? kioskCount?.status === KioskCountStatus.SKIPPED
                  ? 'Overgeslagen'
                  : 'Afgerond'
                : undefined
            }
          />

          <button
            type="button"
            onClick={() => void navigateToRouteIndex(routeIndex + 1)}
            disabled={routeIndex < 0 || routeIndex >= totalKiosks - 1}
            aria-label="Volgende kiosk"
            className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg text-ink-muted disabled:opacity-25"
          >
            ▶
          </button>
        </div>
      </div>

      <div className="space-y-3 p-4">
        {saveError && (
          <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
            {saveError}
          </p>
        )}

        {categoriesWithProducts.length === 0 ? (
          <p className="py-8 text-center text-gray-600">
            Geen voorraadnormen ingesteld voor deze kiosk.
          </p>
        ) : (
          categoriesWithProducts.map((cat) => (
            <CategoryAccordion
              key={cat.id}
              categoryName={cat.name}
              products={cat.products}
              kiosk={kiosk}
              standards={standards}
              counts={counts}
              onCountChange={handleCountChange}
              onCountClear={handleCountClear}
              focusProductId={focusProductId}
            />
          ))
        )}

        {/* Kiosknotitie */}
        <div className="rounded-xl border border-gray-200 bg-white p-3">
          {showNotes ? (
            <>
              <label
                htmlFor="kiosk-notes"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Notitie bij deze kiosk
              </label>
              <textarea
                id="kiosk-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                onBlur={handleNotesBlur}
                rows={3}
                placeholder="Bijv. koeling links defect, voorraad staat deels achterin"
                className="w-full rounded-xl border border-gray-300 p-3 text-base text-gray-900 placeholder:text-gray-400 focus:border-arena-red focus:outline-none focus:ring-2 focus:ring-arena-red/30"
              />
            </>
          ) : (
            <button
              type="button"
              onClick={() => setShowNotes(true)}
              className="min-h-11 w-full text-left text-sm font-medium text-gray-700"
            >
              Notitie toevoegen
            </button>
          )}
        </div>

        <Link
          href={`/incidents/new?eventId=${eventId}&kioskId=${kioskId}`}
          className="block"
        >
          <Button variant="outline" size="md" className="w-full">
            Storing melden
          </Button>
        </Link>
      </div>

      {/* Acties — onder handbereik, boven de bottom navigation */}
      <div className="sticky bottom-[5.5rem] z-30 space-y-2 border-t border-gray-200 bg-white p-4 shadow-[0_-4px_12px_rgba(0,0,0,0.06)]">
        {!completeness.isComplete && requiredProductIds.length > 0 && (
          <button
            type="button"
            onClick={jumpToFirstMissing}
            className="min-h-11 w-full rounded-xl bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900"
          >
            Nog {completeness.missingProductIds.length}{' '}
            {completeness.missingProductIds.length === 1 ? 'product' : 'producten'} te tellen →
          </button>
        )}

        <Button
          size="lg"
          className="w-full"
          onClick={handleComplete}
          disabled={isSaving || !completeness.isComplete}
        >
          {isSaving ? 'Opslaan…' : 'Kiosk afronden ✓'}
        </Button>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="md"
            className="flex-1"
            onClick={() => setShowSkipDialog(true)}
            disabled={isSaving}
          >
            Overslaan
          </Button>
          <Button
            variant="outline"
            size="md"
            className="flex-1"
            onClick={() => void handlePause()}
            disabled={isSaving}
          >
            Pauzeren
          </Button>
        </div>
      </div>

      <SkipKioskDialog
        open={showSkipDialog}
        kioskLabel={kioskLabel(kiosk)}
        onClose={() => setShowSkipDialog(false)}
        onConfirm={(reason) => void handleSkip(reason)}
      />
    </>
  )
}
