import type { IProductRepository } from '../interfaces/IProductRepository'
import type { Product, ProductCategory, KioskProductStandard } from '@/types'
import { demoCategories, demoProducts, demoStandards, demoKiosks } from '@/lib/seed/demoData'

export class DemoProductRepository implements IProductRepository {
  private categories = [...demoCategories]
  private products = [...demoProducts]
  private standards = [...demoStandards]

  async getCategories(): Promise<ProductCategory[]> {
    return this.categories.filter((c) => c.isActive).sort((a, b) => a.sortOrder - b.sortOrder)
  }

  async getProducts(options?: { categoryId?: string; activeOnly?: boolean }): Promise<Product[]> {
    return this.products
      .filter((p) => {
        if (options?.activeOnly !== false && !p.isActive) return false
        if (options?.categoryId && p.categoryId !== options.categoryId) return false
        return true
      })
      .sort((a, b) => a.sortOrder - b.sortOrder)
  }

  async getProductById(id: string): Promise<Product | null> {
    return this.products.find((p) => p.id === id) ?? null
  }

  async createProduct(data: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Promise<Product> {
    const product: Product = {
      ...data,
      id: `prod-${crypto.randomUUID()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    this.products.push(product)
    return product
  }

  async updateProduct(id: string, data: Partial<Product>): Promise<Product> {
    const idx = this.products.findIndex((p) => p.id === id)
    if (idx === -1) throw new Error(`Product niet gevonden: ${id}`)
    const updated = { ...this.products[idx]!, ...data, updatedAt: new Date().toISOString() }
    this.products[idx] = updated
    return updated
  }

  async deleteProduct(id: string): Promise<void> {
    await this.updateProduct(id, { isActive: false })
  }

  async getStandards(kioskId: string): Promise<KioskProductStandard[]> {
    return this.standards.filter((s) => s.kioskId === kioskId)
  }

  async getStandardMatrix(ringId: string): Promise<{
    products: Product[]
    kiosks: Array<{ id: string; number: number }>
    standards: Record<string, Record<string, KioskProductStandard>>
  }> {
    const kiosks = demoKiosks
      .filter((k) => k.ringId === ringId && k.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((k) => ({ id: k.id, number: k.number }))

    const products = await this.getProducts({ activeOnly: true })

    const standards: Record<string, Record<string, KioskProductStandard>> = {}
    for (const std of this.standards) {
      if (!standards[std.productId]) standards[std.productId] = {}
      standards[std.productId]![std.kioskId] = std
    }

    return { products, kiosks, standards }
  }

  async upsertStandard(
    data: Omit<KioskProductStandard, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<KioskProductStandard> {
    const existing = this.standards.find(
      (s) => s.kioskId === data.kioskId && s.productId === data.productId
    )
    if (existing) {
      const updated = { ...existing, ...data, updatedAt: new Date().toISOString() }
      const idx = this.standards.indexOf(existing)
      this.standards[idx] = updated
      return updated
    }
    const standard: KioskProductStandard = {
      ...data,
      id: `std-${crypto.randomUUID()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    this.standards.push(standard)
    return standard
  }

  async bulkUpsertStandards(
    standards: Array<Omit<KioskProductStandard, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<void> {
    await Promise.all(standards.map((s) => this.upsertStandard(s)))
  }
}
