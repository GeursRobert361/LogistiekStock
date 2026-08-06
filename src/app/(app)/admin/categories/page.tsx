'use client'

import { useEffect, useState } from 'react'
import { AppHeader } from '@/components/layout/AppHeader'
import { Card, CardContent } from '@/components/ui/Card'
import { repositories } from '@/repositories'
import type { ProductCategory } from '@/types'

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<ProductCategory[]>([])

  useEffect(() => {
    repositories.product().getCategories().then(setCategories)
  }, [])

  return (
    <>
      <AppHeader title="Categorieën" backHref="/dashboard" />
      <div className="space-y-2 p-4">
        {categories.map((cat) => (
          <Card key={cat.id}>
            <CardContent className="flex items-center justify-between py-3">
              <p className="font-semibold text-gray-900">{cat.name}</p>
              <span className="text-sm text-gray-400">#{cat.sortOrder}</span>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  )
}
