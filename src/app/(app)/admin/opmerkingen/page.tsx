'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AppHeader } from '@/components/layout/AppHeader'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { EmptyState } from '@/components/shared/EmptyState'
import { ListSkeleton } from '@/components/shared/LoadingSkeleton'
import { EditSheet } from '@/components/admin/EditSheet'
import { repositories } from '@/repositories'
import { kioskTitle } from '@/lib/kiosk'
import { storageNoteProblem } from '@/lib/storageNotes'
import type {
  Kiosk,
  KioskProductStandard,
  KioskStorageNote,
  Product,
  ProductCategory,
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
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<ProductCategory[]>([])
  const [notes, setNotes] = useState<KioskStorageNote[]>([])
  const [standards, setStandards] = useState<KioskProductStandard[]>([])
  const [kioskId, setKioskId] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [editing, setEditing] = useState<KioskStorageNote | 'new' | null>(null)
  const [draftTarget, setDraftTarget] = useState('')
  const [draftNote, setDraftNote] = useState('')

  const load = useCallback(async () => {
    const [kioskList, productList, categoryList, noteList] = await Promise.all([
      repositories.kiosk().getKiosks(),
      repositories.product().getProducts({ activeOnly: false }),
      repositories.product().getCategories(),
      repositories.kiosk().getStorageNotes(),
    ])
    setKiosks(kioskList)
    setProducts(productList)
    setCategories(categoryList)
    setNotes(noteList)
    setKioskId((current) =>
      kioskList.some((kiosk) => kiosk.id === current) ? current : (kioskList[0]?.id ?? '')
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
          Wat een teller of vuller bij deze kiosk moet weten over waar de voorraad ligt. Het
          verandert niets aan de norm.
        </p>

        <Select
          label="Kiosk"
          value={kioskId}
          onChange={(e) => setKioskId(e.target.value)}
          options={kiosks.map((k) => ({ value: k.id, label: kioskTitle(k) }))}
        />

        {error && (
          <p
            role="alert"
            className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-800"
          >
            {error}
          </p>
        )}

        {isLoading ? (
          <ListSkeleton count={3} />
        ) : notesHere.length === 0 ? (
          <EmptyState
            title="Geen opmerkingen bij deze kiosk"
            description="Bijvoorbeeld: een deel van de voorraad staat achterin, op een plank of in het hok ernaast."
            icon="📝"
          />
        ) : (
          <>
            {categoryNotes.length > 0 && (
              <section className="space-y-2">
                <h2 className="text-sm font-semibold text-gray-700">Bij een categorie</h2>
                {categoryNotes.map(noteCard)}
              </section>
            )}

            {productNotes.length > 0 && (
              <section className="space-y-2">
                <h2 className="text-sm font-semibold text-gray-700">Bij een product</h2>
                {productNotes.map(noteCard)}
              </section>
            )}
          </>
        )}
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
