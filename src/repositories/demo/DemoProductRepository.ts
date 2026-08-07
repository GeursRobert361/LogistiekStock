import type { IProductRepository } from '../interfaces/IProductRepository'
import type { Product, ProductCategory, KioskProductStandard } from '@/types'
import { demoTables } from './demoTables'
import { newId } from '@/lib/ids'

export class DemoProductRepository implements IProductRepository {
  async getCategories(): Promise<ProductCategory[]> {
    return demoTables.categories.filter((c) => c.isActive).sort((a, b) => a.sortOrder - b.sortOrder)
  }

  async getProducts(options?: { categoryId?: string; activeOnly?: boolean }): Promise<Product[]> {
    return demoTables.products
      .filter((p) => {
        if (options?.activeOnly !== false && !p.isActive) return false
        if (options?.categoryId && p.categoryId !== options.categoryId) return false
        return true
      })
      .sort((a, b) => a.sortOrder - b.sortOrder)
  }

  async getProductById(id: string): Promise<Product | null> {
    return demoTables.products.getById(id)
  }

  async createProduct(data: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Promise<Product> {
    const now = new Date().toISOString()
    const product: Product = { ...data, id: `prod-${newId()}`, createdAt: now, updatedAt: now }
    demoTables.products.insert(product)
    return product
  }

  async updateProduct(id: string, data: Partial<Product>): Promise<Product> {
    return demoTables.products.update(id, { ...data, updatedAt: new Date().toISOString() })
  }

  async deleteProduct(id: string): Promise<void> {
    await this.updateProduct(id, { isActive: false })
  }

  async getStandards(kioskId: string): Promise<KioskProductStandard[]> {
    return demoTables.standards.filter((s) => s.kioskId === kioskId && s.isActive)
  }

  async getStandardMatrix(ringId: string): Promise<{
    products: Product[]
    kiosks: Array<{ id: string; number: number }>
    standards: Record<string, Record<string, KioskProductStandard>>
  }> {
    const kiosks = demoTables.kiosks
      .filter((k) => k.ringId === ringId && k.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((k) => ({ id: k.id, number: k.number }))

    const products = await this.getProducts({ activeOnly: true })

    const standards: Record<string, Record<string, KioskProductStandard>> = {}
    for (const std of demoTables.standards.all()) {
      if (!standards[std.productId]) standards[std.productId] = {}
      standards[std.productId]![std.kioskId] = std
    }

    return { products, kiosks, standards }
  }

  async upsertStandard(
    data: Omit<KioskProductStandard, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<KioskProductStandard> {
    const now = new Date().toISOString()
    const existing = demoTables.standards.find(
      (s) => s.kioskId === data.kioskId && s.productId === data.productId
    )
    const standard: KioskProductStandard = {
      ...data,
      id: existing?.id ?? `std-${data.kioskId}-${data.productId}`,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    }
    demoTables.standards.put(standard)
    return standard
  }

  async bulkUpsertStandards(
    standards: Array<Omit<KioskProductStandard, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<void> {
    for (const std of standards) {
      await this.upsertStandard(std)
    }
  }

  async createCategory(data: Omit<ProductCategory, 'id'>): Promise<ProductCategory> {
    const category: ProductCategory = { ...data, id: `cat-${newId()}` }
    demoTables.categories.insert(category)
    return category
  }

  async updateCategory(id: string, data: Partial<ProductCategory>): Promise<ProductCategory> {
    return demoTables.categories.update(id, data)
  }
}
