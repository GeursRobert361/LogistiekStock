import type { Product, ProductCategory, KioskProductStandard } from '@/types'

export interface IProductRepository {
  getCategories(): Promise<ProductCategory[]>
  getProducts(options?: { categoryId?: string; activeOnly?: boolean }): Promise<Product[]>
  getProductById(id: string): Promise<Product | null>
  createProduct(data: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Promise<Product>
  updateProduct(id: string, data: Partial<Product>): Promise<Product>
  deleteProduct(id: string): Promise<void>

  getStandards(kioskId: string): Promise<KioskProductStandard[]>
  getStandardMatrix(ringId: string): Promise<{
    products: Product[]
    kiosks: Array<{ id: string; number: number }>
    standards: Record<string, Record<string, KioskProductStandard>>
  }>
  upsertStandard(data: Omit<KioskProductStandard, 'id' | 'createdAt' | 'updatedAt'>): Promise<KioskProductStandard>
  bulkUpsertStandards(standards: Array<Omit<KioskProductStandard, 'id' | 'createdAt' | 'updatedAt'>>): Promise<void>
}
