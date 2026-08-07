'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AppHeader } from '@/components/layout/AppHeader'
import { ProductForm, type ProductFormValues } from '@/components/admin/ProductForm'
import { repositories } from '@/repositories'
import type { ProductCategory } from '@/types'

export default function NewProductPage() {
  const router = useRouter()
  const [categories, setCategories] = useState<ProductCategory[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    repositories
      .product()
      .getCategories()
      .then((list) => {
        setCategories(list)
        setIsLoading(false)
      })
      .catch((error: unknown) => {
        console.error('[beheer] Categorieën laden mislukt.', error)
        setIsLoading(false)
      })
  }, [])

  async function handleSubmit(values: ProductFormValues) {
    await repositories.product().createProduct(values)
    router.push('/admin/products')
  }

  return (
    <>
      <AppHeader title="Nieuw product" backHref="/admin/products" />
      {isLoading ? (
        <div className="p-4 text-center text-gray-500">Laden…</div>
      ) : (
        <ProductForm categories={categories} onSubmit={handleSubmit} />
      )}
    </>
  )
}
