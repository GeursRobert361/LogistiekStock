'use client'

import { useCallback, useEffect, useState } from 'react'
import { AppHeader } from '@/components/layout/AppHeader'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { EmptyState } from '@/components/shared/EmptyState'
import { ListSkeleton } from '@/components/shared/LoadingSkeleton'
import { EditSheet, ToggleField } from '@/components/admin/EditSheet'
import { repositories } from '@/repositories'
import type { Product, ProductCategory } from '@/types'

interface CategoryDraft {
  name: string
  sortOrder: string
  isActive: boolean
}

function toDraft(category?: ProductCategory): CategoryDraft {
  return {
    name: category?.name ?? '',
    sortOrder: String(category?.sortOrder ?? 0),
    isActive: category?.isActive ?? true,
  }
}

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<ProductCategory[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [editing, setEditing] = useState<ProductCategory | 'new' | null>(null)
  const [draft, setDraft] = useState<CategoryDraft>(toDraft())

  const load = useCallback(async () => {
    const [categoryList, productList] = await Promise.all([
      repositories.product().getCategories({ includeInactive: true }),
      repositories.product().getProducts({ activeOnly: false }),
    ])
    setCategories(categoryList)
    setProducts(productList)
    setIsLoading(false)
  }, [])

  useEffect(() => {
    load().catch((error: unknown) => {
      console.error('[beheer] Categorieën laden mislukt.', error)
      setIsLoading(false)
    })
  }, [load])

  function openEditor(category: ProductCategory | 'new') {
    setDraft(toDraft(category === 'new' ? undefined : category))
    setEditing(category)
  }

  async function handleSave() {
    if (!draft.name.trim()) throw new Error('Geef de categorie een naam.')

    const values = {
      name: draft.name.trim(),
      sortOrder: Number.parseInt(draft.sortOrder, 10) || 0,
      isActive: draft.isActive,
    }

    if (editing === 'new') {
      await repositories.product().createCategory(values)
    } else if (editing) {
      // Een categorie met producten uitschakelen verbergt die producten niet;
      // dat zou stilletjes voorraad uit de telling laten verdwijnen.
      const productCount = products.filter((p) => p.categoryId === editing.id && p.isActive).length
      if (!values.isActive && productCount > 0) {
        throw new Error(
          `Deze categorie heeft nog ${productCount} actieve producten. Schakel die eerst uit.`
        )
      }
      await repositories.product().updateCategory(editing.id, values)
    }

    setEditing(null)
    await load()
  }

  return (
    <>
      <AppHeader
        title="Categorieën"
        backHref="/dashboard"
        actions={
          <Button size="sm" onClick={() => openEditor('new')}>
            + Nieuw
          </Button>
        }
      />
      <div className="space-y-2 p-4">
        {isLoading ? (
          <ListSkeleton count={4} />
        ) : categories.length === 0 ? (
          <EmptyState title="Geen categorieën" icon="🗂️" />
        ) : (
          categories.map((category) => {
            const productCount = products.filter((p) => p.categoryId === category.id).length
            return (
              <Card key={category.id}>
                <CardContent className="py-0">
                  <button
                    type="button"
                    onClick={() => openEditor(category)}
                    className="flex min-h-14 w-full items-center justify-between gap-2 py-3 text-left"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-gray-900">{category.name}</p>
                      <p className="text-xs text-gray-600">
                        {productCount} {productCount === 1 ? 'product' : 'producten'}
                      </p>
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-2">
                      {!category.isActive && <Badge variant="default">Uit</Badge>}
                      <span aria-hidden="true" className="text-gray-400">
                        ›
                      </span>
                    </div>
                  </button>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>

      <EditSheet
        open={editing !== null}
        title={editing === 'new' ? 'Nieuwe categorie' : 'Categorie bewerken'}
        onClose={() => setEditing(null)}
        onSubmit={handleSave}
      >
        <Input
          label="Naam"
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
        />
        <Input
          label="Volgorde"
          inputMode="numeric"
          value={draft.sortOrder}
          onChange={(e) => setDraft({ ...draft, sortOrder: e.target.value })}
        />
        <ToggleField
          label="Actief"
          checked={draft.isActive}
          onChange={(checked) => setDraft({ ...draft, isActive: checked })}
        />
      </EditSheet>
    </>
  )
}
