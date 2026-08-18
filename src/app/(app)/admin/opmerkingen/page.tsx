'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AppHeader } from '@/components/layout/AppHeader'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { EmptyState } from '@/components/shared/EmptyState'
import { ListSkeleton } from '@/components/shared/LoadingSkeleton'
import { EditSheet } from '@/components/admin/EditSheet'
import { repositories } from '@/repositories'
import { kioskLabel, kioskTitle } from '@/lib/kiosk'
import { storageNoteProblem } from '@/lib/storageNotes'
import type {
  Kiosk,
  KioskProductStandard,
  KioskStorageNote,
  Product,
  ProductCategory,
  Ring,
} from '@/types'

/**
 * De opmerkingen over waar de voorraad bij een kiosk ligt.
 *
 * "2 dozen achter in de kiosk", "onder elk luik 1 doos". Ze verschijnen op het
 * telscherm en op de vullijst onder de regel waar ze bij horen, en stonden tot
 * nu toe als vaste lijst in de code — een doos die verhuisde wachtte op een
 * deploy.
 *
 * Per kiosk, want zo staat het ook in iemands hoofd: je staat ergens en weet
 * wat daar bijzonder aan is. Een lijst over alle kiosken heen zou langer en
 * onherkenbaarder zijn dan het handjevol regels dat er per plek bij hoort.
 *
 * Alleen producten en categorieën die deze kiosk werkelijk voert staan in de
 * keuzelijst: een opmerking bij iets zonder norm komt nergens op het scherm en
 * is dus alleen maar een regel die niemand meer terugvindt.
 */

/** Wat de keuzelijst teruggeeft: `product:<id>` of `categorie:<id>`. */
type Target = { productId: string } | { categoryId: string }

function parseTarget(value: string): Target | null {
  const [kind, id] = value.split(':')
  if (!id) return null
  if (kind === 'product') return { productId: id }
  if (kind === 'categorie') return { categoryId: id }
  return null
}

function targetValue(note: Pick<KioskStorageNote, 'productId' | 'categoryId'>): string {
  return note.productId ? `product:${note.productId}` : `categorie:${note.categoryId ?? ''}`
}

export default function AdminStorageNotesPage() {
  const [kiosks, setKiosks] = useState<Kiosk[]>([])
  const [rings, setRings] = useState<Ring[]>([])
  const [activeRingId, setActiveRingId] = useState('')
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<ProductCategory[]>([])
  const [notes, setNotes] = useState<KioskStorageNote[]>([])
  const [standards, setStandards] = useState<KioskProductStandard[]>([])
  const [kioskId, setKioskId] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  /** Waar de opmerkingen staan; na het kiezen van een kiosk springen we hierheen. */
  const notesRef = useRef<HTMLDivElement | null>(null)

  const [editing, setEditing] = useState<KioskStorageNote | 'new' | null>(null)
  const [draftTarget, setDraftTarget] = useState('')
  const [draftNote, setDraftNote] = useState('')

  const load = useCallback(async () => {
    const [ringList, kioskList, productList, categoryList, noteList] = await Promise.all([
      repositories.kiosk().getRings(),
      repositories.kiosk().getKiosks(),
      repositories.product().getProducts({ activeOnly: false }),
      repositories.product().getCategories(),
      repositories.kiosk().getStorageNotes(),
    ])
    setRings(ringList)
    setKiosks(kioskList)
    setProducts(productList)
    setCategories(categoryList)
    setNotes(noteList)
    // Geen kiosk voorgeselecteerd: het raster is het overzicht, en daar hoort
    // er niet meteen één uit te springen alsof daar iets bijzonders aan is.
    setKioskId((current) => (kioskList.some((kiosk) => kiosk.id === current) ? current : ''))
    setActiveRingId((current) =>
      ringList.some((ring) => ring.id === current) ? current : (ringList[0]?.id ?? '')
    )
    setIsLoading(false)
  }, [])

  useEffect(() => {
    load().catch((loadError: unknown) => {
      console.error('[beheer] Opmerkingen laden mislukt.', loadError)
      setError('De opmerkingen konden niet worden geladen.')
      setIsLoading(false)
    })
  }, [load])

  // De normen van deze kiosk bepalen wat er te kiezen valt. Aparte ronde per
  // kiosk: de hele matrix ophalen voor een keuzelijst is zonde van de tijd op
  // een telefoon.
  useEffect(() => {
    if (!kioskId) return
    let cancelled = false

    repositories
      .product()
      .getStandards(kioskId)
      .then((list) => {
        if (!cancelled) setStandards(list)
      })
      .catch((loadError: unknown) => {
        console.error('[beheer] Normen van deze kiosk laden mislukt.', loadError)
        if (!cancelled) setStandards([])
      })

    return () => {
      cancelled = true
    }
  }, [kioskId])

  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products])
  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])

  /** Wat deze kiosk voert, in de volgorde van de catalogus. */
  const options = useMemo(() => {
    const stocked = standards
      .filter((standard) => standard.isActive)
      .flatMap((standard) => {
        const product = productById.get(standard.productId)
        return product ? [product] : []
      })
      .sort((a, b) => a.sortOrder - b.sortOrder)

    const categoryIds = new Set(stocked.map((product) => product.categoryId))
    const stockedCategories = categories.filter((category) => categoryIds.has(category.id))

    return [
      ...stockedCategories.map((category) => ({
        value: `categorie:${category.id}`,
        label: `Categorie · ${category.name}`,
      })),
      ...stocked.map((product) => ({
        value: `product:${product.id}`,
        label: `Product · ${product.name}`,
      })),
    ]
  }, [standards, productById, categories])

  /** De kiosken van de gekozen ring, in looproutevolgorde. */
  const visible = useMemo(
    () =>
      kiosks
        .filter((kiosk) => kiosk.ringId === activeRingId)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [kiosks, activeRingId]
  )

  /** Hoeveel opmerkingen er per kiosk staan; het raster laat dat zien. */
  const countByKiosk = useMemo(() => {
    const counts = new Map<string, number>()
    for (const note of notes) {
      counts.set(note.kioskId, (counts.get(note.kioskId) ?? 0) + 1)
    }
    return counts
  }, [notes])

  function chooseKiosk(id: string) {
    setKioskId(id)
    // Bij een volle ring staat het raster over het halve scherm; zonder deze
    // sprong lijkt er niets te gebeuren als je een kiosk aantikt.
    requestAnimationFrame(() => notesRef.current?.scrollIntoView({ behavior: 'smooth' }))
  }

  const notesHere = notes.filter((note) => note.kioskId === kioskId)
  const categoryNotes = notesHere.filter((note) => note.categoryId)
  const productNotes = notesHere.filter((note) => note.productId)

  function nameOf(note: KioskStorageNote): string {
    if (note.productId) return productById.get(note.productId)?.name ?? 'Onbekend product'
    return categoryById.get(note.categoryId ?? '')?.name ?? 'Onbekende categorie'
  }

  function openEditor(note: KioskStorageNote | 'new') {
    setDraftTarget(note === 'new' ? (options[0]?.value ?? '') : targetValue(note))
    setDraftNote(note === 'new' ? '' : note.note)
    setEditing(note)
  }

  async function handleSave() {
    const target = parseTarget(draftTarget)
    if (!target) throw new Error('Kies een product of een categorie.')

    const input = { kioskId, ...target, note: draftNote }
    const problem = storageNoteProblem(input)
    if (problem) throw new Error(problem)

    await repositories.kiosk().saveStorageNote(input)
    setEditing(null)
    await load()
  }

  async function handleDelete() {
    if (editing === null || editing === 'new') return
    await repositories.kiosk().deleteStorageNote(editing.id)
    setEditing(null)
    await load()
  }

  const kiosk = kiosks.find((k) => k.id === kioskId)

  function noteCard(note: KioskStorageNote) {
    return (
      <Card key={note.id}>
        <CardContent className="py-0">
          <button
            type="button"
            onClick={() => openEditor(note)}
            className="flex min-h-14 w-full items-center justify-between gap-2 py-3 text-left"
          >
            <div className="min-w-0">
              <p className="truncate font-semibold text-gray-900">{nameOf(note)}</p>
              <p className="text-sm text-gray-700">{note.note}</p>
            </div>
            <span aria-hidden="true" className="flex-shrink-0 text-gray-400">
              ›
            </span>
          </button>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <AppHeader
        title="Opmerkingen"
        backHref="/admin"
        actions={
          <Button
            size="sm"
            disabled={!kioskId || options.length === 0}
            onClick={() => openEditor('new')}
          >
            + Nieuw
          </Button>
        }
      />

      <div className="space-y-4 p-4">
        <p className="text-sm text-gray-600">
          Wat een teller of vuller bij een kiosk moet weten over waar de voorraad ligt. Het
          verandert niets aan de norm.
        </p>

        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {rings.map((ring) => (
            <button
              key={ring.id}
              type="button"
              onClick={() => setActiveRingId(ring.id)}
              className={`min-h-11 whitespace-nowrap rounded-full px-4 text-sm font-medium ${
                activeRingId === ring.id ? 'bg-arena-red text-white' : 'bg-gray-100 text-gray-700'
              }`}
            >
              {ring.name}
            </button>
          ))}
        </div>

        {/* Hetzelfde raster als bij Kiosken, met erbij hoeveel er al staat. Dat
            is meteen het overzicht: zonder die telling moet je elke kiosk los
            openen om te zien of er iets bij hoort. */}
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {visible.map((kiosk) => {
            const count = countByKiosk.get(kiosk.id) ?? 0
            const isChosen = kiosk.id === kioskId
            const telling =
              count === 0
                ? 'geen opmerkingen'
                : `${count} ${count === 1 ? 'opmerking' : 'opmerkingen'}`

            return (
              <button
                key={kiosk.id}
                type="button"
                onClick={() => chooseKiosk(kiosk.id)}
                aria-pressed={isChosen}
                aria-label={`${kioskTitle(kiosk)}, ${telling}`}
              >
                <Card
                  className={`active:bg-gray-100 ${isChosen ? 'border-arena-red ring-2 ring-arena-red' : ''}`}
                >
                  <CardContent className="flex min-h-20 flex-col items-center justify-center py-3 text-center">
                    <p
                      className={`font-bold text-gray-900 ${kioskLabel(kiosk).length > 4 ? 'text-lg' : 'text-2xl'}`}
                    >
                      {kioskLabel(kiosk)}
                    </p>
                    {count > 0 ? (
                      <Badge variant="default" className="mt-1">
                        {count}
                      </Badge>
                    ) : (
                      <span className="mt-1 block h-5" aria-hidden="true" />
                    )}
                  </CardContent>
                </Card>
              </button>
            )
          })}
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-800"
          >
            {error}
          </p>
        )}

        {/* De kiosknaam staat er nog eens boven: bij een volle ring is het
            raster weggescrold tegen de tijd dat je hier iets aanpast. */}
        <div ref={notesRef} className="scroll-mt-4 space-y-4">
          {isLoading ? (
            <ListSkeleton count={3} />
          ) : !kiosk ? (
            <EmptyState
              title="Kies een kiosk"
              description="Tik een kiosk aan om te zien wat daar over de voorraad bekend is. Het getal op een tegel is het aantal opmerkingen dat er al staat."
              icon="👆"
            />
          ) : notesHere.length === 0 ? (
            <EmptyState
              title={`Geen opmerkingen bij ${kioskTitle(kiosk)}`}
              description="Bijvoorbeeld: een deel van de voorraad staat achterin, op een plank of in het hok ernaast."
              icon="📝"
            />
          ) : (
            <>
              <h2 className="text-base font-semibold text-gray-900">{kioskTitle(kiosk)}</h2>

              {categoryNotes.length > 0 && (
                <section className="space-y-2">
                  <h3 className="text-sm font-semibold text-gray-700">Bij een categorie</h3>
                  {categoryNotes.map(noteCard)}
                </section>
              )}

              {productNotes.length > 0 && (
                <section className="space-y-2">
                  <h3 className="text-sm font-semibold text-gray-700">Bij een product</h3>
                  {productNotes.map(noteCard)}
                </section>
              )}
            </>
          )}
        </div>
      </div>

      <EditSheet
        open={editing !== null}
        title={
          editing === 'new'
            ? `Nieuwe opmerking bij ${kioskTitle(kiosk)}`
            : `Opmerking bij ${kioskTitle(kiosk)}`
        }
        onClose={() => setEditing(null)}
        onSubmit={handleSave}
        secondaryAction={
          editing !== null && editing !== 'new'
            ? { label: 'Weghalen', onClick: handleDelete }
            : undefined
        }
      >
        <Select
          label="Hoort bij"
          value={draftTarget}
          // Verplaatsen naar een ander product zou de oude regel laten staan en
          // er stil een tweede bij zetten. Wie zich vergist haalt hem weg.
          disabled={editing !== 'new'}
          onChange={(e) => setDraftTarget(e.target.value)}
          options={options}
        />
        <Input
          label="Opmerking"
          value={draftNote}
          placeholder="2 dozen achter in de kiosk"
          onChange={(e) => setDraftNote(e.target.value)}
        />
      </EditSheet>
    </>
  )
}
