'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AppHeader } from '@/components/layout/AppHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { ProductForm, type ProductFormValues } from '@/components/admin/ProductForm'
import { repositories } from '@/repositories'
import type { Product, ProductCategory } from '@/types'

export default function EditProductPage({
  params,
}: {
  params: Promise<{ productId: string }>
}) {
  const { productId } = use(params)
  const router = useRouter()
  const [product, setProduct] = useState<Product | null>(null)
  const [categories, setCategories] = useState<ProductCategory[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      repositories.product().getProductById(productId),
      repositories.product().getCategories(),
    ])
      .then(([found, categoryList]) => {
        setProduct(found)
        setCategories(categoryList)
        setIsLoading(false)
      })
      .catch((error: unknown) => {
        console.error('[beheer] Product laden mislukt.', error)
        setIsLoading(false)
      })
  }, [productId])

  async function handleSubmit(values: ProductFormValues) {
    await repositories.product().updateProduct(productId, values)
    router.push('/admin/products')
  }

  async function handleDeactivate() {
    await repositories.product().deleteProduct(productId)
    router.push('/admin/products')
  }

  if (isLoading) {
    return (
      <>
        <AppHeader title="Product" backHref="/admin/products" />
        <div className="p-4 text-center text-gray-500">Laden…</div>
      </>
    )
  }

  if (!product) {
    return (
      <>
        <AppHeader title="Product" backHref="/admin/products" />
        <div className="p-4">
          <EmptyState title="Product niet gevonden" icon="❌" />
        </div>
      </>
    )
  }

  return (
    <>
      <AppHeader title={product.name} backHref="/admin/products" />
      <ProductForm
        categories={categories}
        initial={product}
        onSubmit={handleSubmit}
        onDeactivate={handleDeactivate}
      />
    </>
  )
}
