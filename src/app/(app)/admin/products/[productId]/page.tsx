'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AppHeader } from '@/components/layout/AppHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { ConfirmDialog } from '@/components/ui/Dialog'
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
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
    await repositories.product().updateProduct(productId, { isActive: false })
    router.push('/admin/products')
  }

  async function handleDelete() {
    setShowDeleteDialog(false)
    try {
      await repositories.product().deleteProduct(productId)
      router.push('/admin/products')
    } catch (deleteError) {
      console.error('[beheer] Product verwijderen mislukt.', deleteError)
      setError('Het product kon niet worden verwijderd.')
    }
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
      {error && (
        <p role="alert" className="mx-4 mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
          {error}
        </p>
      )}
      <ProductForm
        categories={categories}
        initial={product}
        onSubmit={handleSubmit}
        onDeactivate={handleDeactivate}
        onDelete={() => setShowDeleteDialog(true)}
      />

      <ConfirmDialog
        open={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={() => void handleDelete()}
        isDestructive
        title={`${product.name} verwijderen`}
        message={
          'Het product verdwijnt uit alle tellijsten en vullijsten, en de normen bij de kiosken ' +
          'gaan uit. Eerdere tellingen en leveringen blijven leesbaar.'
        }
        confirmLabel="Verwijderen"
        cancelLabel="Terug"
      />
    </>
  )
}
