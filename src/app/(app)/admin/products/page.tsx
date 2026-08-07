'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { AppHeader } from '@/components/layout/AppHeader'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/shared/EmptyState'
import { ListSkeleton } from '@/components/shared/LoadingSkeleton'
import { repositories } from '@/repositories'
import type { Product, ProductCategory } from '@/types'

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<ProductCategory[]>([])
  const [showInactive, setShowInactive] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  const load = useCallback(async () => {
    const [productList, categoryList] = await Promise.all([
      repositories.product().getProducts({ activeOnly: false }),
      repositories.product().getCategories(),
    ])
    setProducts(productList)
    setCategories(categoryList)
    setIsLoading(false)
  }, [])

  useEffect(() => {
    load().catch((error: unknown) => {
      console.error('[beheer] Producten laden mislukt.', error)
      setIsLoading(false)
    })
  }, [load])

  const visible = showInactive ? products : products.filter((p) => p.isActive)
  const categoryName = new Map(categories.map((c) => [c.id, c.name]))

  const grouped = visible.reduce<Record<string, Product[]>>((accumulator, product) => {
    const name = categoryName.get(product.categoryId) ?? 'Onbekend'
    ;(accumulator[name] ??= []).push(product)
    return accumulator
  }, {})

  return (
    <>
      <AppHeader
        title="Producten"
        backHref="/dashboard"
        actions={
          <Link href="/admin/products/new">
            <Button size="sm">+ Nieuw</Button>
          </Link>
        }
      />
      <div className="space-y-3 p-4">
        <label className="flex min-h-11 items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="h-5 w-5 accent-arena-red"
          />
          Ook uitgeschakelde producten tonen
        </label>

        {isLoading ? (
          <ListSkeleton count={4} />
        ) : visible.length === 0 ? (
          <EmptyState title="Geen producten" icon="📦" />
        ) : (
          Object.entries(grouped).map(([name, items]) => (
            <section key={name}>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
                {name}
              </h3>
              <div className="space-y-1">
                {items.map((product) => (
                  <Link
                    key={product.id}
                    href={`/admin/products/${product.id}`}
                    className="block"
                  >
                    <Card className="active:bg-gray-100">
                      <CardContent className="flex min-h-14 items-center justify-between py-3">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-gray-900">{product.name}</p>
                          <p className="text-xs text-gray-600">
                            Stap {String(product.inputStep)} · {product.packagingUnit}
                          </p>
                        </div>
                        <div className="flex flex-shrink-0 items-center gap-1">
                          {product.refrigerated && <Badge variant="info">❄️ Gekoeld</Badge>}
                          {!product.isActive && <Badge variant="default">Uit</Badge>}
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </>
  )
}
