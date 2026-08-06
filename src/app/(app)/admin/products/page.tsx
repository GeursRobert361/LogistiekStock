'use client'

import { useEffect, useState } from 'react'
import { AppHeader } from '@/components/layout/AppHeader'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/shared/EmptyState'
import { ListSkeleton } from '@/components/shared/LoadingSkeleton'
import { repositories } from '@/repositories'
import type { Product, ProductCategory } from '@/types'

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<ProductCategory[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      repositories.product().getProducts(),
      repositories.product().getCategories(),
    ]).then(([prods, cats]) => {
      setProducts(prods)
      setCategories(cats)
      setIsLoading(false)
    })
  }, [])

  const catMap = Object.fromEntries(categories.map((c) => [c.id, c.name]))
  const grouped = products.reduce<Record<string, Product[]>>((acc, p) => {
    const catName = catMap[p.categoryId] ?? 'Onbekend'
    if (!acc[catName]) acc[catName] = []
    acc[catName]!.push(p)
    return acc
  }, {})

  return (
    <>
      <AppHeader title="Producten beheer" backHref="/dashboard" />
      <div className="p-4">
        {isLoading ? (
          <ListSkeleton count={4} />
        ) : products.length === 0 ? (
          <EmptyState title="Geen producten" icon="📦" />
        ) : (
          <div className="space-y-4">
            {Object.entries(grouped).map(([catName, prods]) => (
              <section key={catName}>
                <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
                  {catName}
                </h3>
                <div className="space-y-1">
                  {prods.map((product) => (
                    <Card key={product.id}>
                      <CardContent className="flex items-center justify-between py-3">
                        <div>
                          <p className="font-medium text-gray-900">{product.name}</p>
                          <p className="text-xs text-gray-500">
                            Stap: {product.inputStep} | {product.packagingUnit}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          {product.refrigerated && (
                            <Badge variant="info">❄️</Badge>
                          )}
                          {!product.isActive && (
                            <Badge variant="default">Inactief</Badge>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
