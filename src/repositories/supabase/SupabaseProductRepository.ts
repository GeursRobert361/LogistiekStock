import type { IProductRepository } from '../interfaces/IProductRepository'
import type { Product, ProductCategory, KioskProductStandard } from '@/types'
import { getSupabaseClient } from '@/lib/supabase/client'
import {
  mapCategory,
  mapProduct,
  mapStandard,
  categoryToRow,
  productToRow,
  standardToRow,
} from '@/server/db/rowMappers'
import { unwrap, unwrapList, unwrapMaybe } from './supabaseHelpers'

type Row = Record<string, unknown>

export class SupabaseProductRepository implements IProductRepository {
  private get db() {
    return getSupabaseClient()
  }

  async getCategories(options?: { includeInactive?: boolean }): Promise<ProductCategory[]> {
    let query = this.db.from('product_categories').select('*')
    if (options?.includeInactive !== true) query = query.eq('is_active', true)
    const rows = unwrapList<Row>(await query.order('sort_order'))
    return rows.map(mapCategory)
  }

  async createCategory(data: Omit<ProductCategory, 'id'>): Promise<ProductCategory> {
    const row = unwrap<Row>(
      await this.db.from('product_categories').insert(categoryToRow(data)).select().single()
    )
    return mapCategory(row)
  }

  async updateCategory(id: string, data: Partial<ProductCategory>): Promise<ProductCategory> {
    const row = unwrap<Row>(
      await this.db
        .from('product_categories')
        .update(categoryToRow(data))
        .eq('id', id)
        .select()
        .single()
    )
    return mapCategory(row)
  }

  async getProducts(options?: { categoryId?: string; activeOnly?: boolean }): Promise<Product[]> {
    let query = this.db.from('products').select('*')
    if (options?.activeOnly !== false) query = query.eq('is_active', true)
    if (options?.categoryId) query = query.eq('category_id', options.categoryId)
    const rows = unwrapList<Row>(await query.order('sort_order'))
    return rows.map(mapProduct)
  }

  async getProductById(id: string): Promise<Product | null> {
    const row = unwrapMaybe<Row>(
      await this.db.from('products').select('*').eq('id', id).maybeSingle()
    )
    return row ? mapProduct(row) : null
  }

  async createProduct(data: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Promise<Product> {
    const row = unwrap<Row>(
      await this.db.from('products').insert(productToRow(data)).select().single()
    )
    return mapProduct(row)
  }

  async updateProduct(id: string, data: Partial<Product>): Promise<Product> {
    const row = unwrap<Row>(
      await this.db.from('products').update(productToRow(data)).eq('id', id).select().single()
    )
    return mapProduct(row)
  }

  async deleteProduct(id: string): Promise<void> {
    await this.updateProduct(id, { isActive: false })
  }

  async getStandards(kioskId: string): Promise<KioskProductStandard[]> {
    const rows = unwrapList<Row>(
      await this.db
        .from('kiosk_product_standards')
        .select('*')
        .eq('kiosk_id', kioskId)
        .eq('is_active', true)
    )
    return rows.map(mapStandard)
  }

  async getStandardMatrix(ringId: string): Promise<{
    products: Product[]
    kiosks: Array<{ id: string; number: number }>
    standards: Record<string, Record<string, KioskProductStandard>>
  }> {
    const kioskRows = unwrapList<Row>(
      await this.db
        .from('kiosks')
        .select('id, number')
        .eq('ring_id', ringId)
        .eq('is_active', true)
        .order('sort_order')
    )
    const kiosks = kioskRows.map((row) => ({ id: String(row.id), number: Number(row.number) }))

    const products = await this.getProducts({ activeOnly: true })

    const standards: Record<string, Record<string, KioskProductStandard>> = {}
    if (kiosks.length > 0) {
      const standardRows = unwrapList<Row>(
        await this.db
          .from('kiosk_product_standards')
          .select('*')
          .in(
            'kiosk_id',
            kiosks.map((k) => k.id)
          )
      )
      for (const row of standardRows) {
        const std = mapStandard(row)
        if (!standards[std.productId]) standards[std.productId] = {}
        standards[std.productId]![std.kioskId] = std
      }
    }

    return { products, kiosks, standards }
  }

  async upsertStandard(
    data: Omit<KioskProductStandard, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<KioskProductStandard> {
    const row = unwrap<Row>(
      await this.db
        .from('kiosk_product_standards')
        .upsert(standardToRow(data), { onConflict: 'kiosk_id,product_id' })
        .select()
        .single()
    )
    return mapStandard(row)
  }

  async bulkUpsertStandards(
    standards: Array<Omit<KioskProductStandard, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<void> {
    if (standards.length === 0) return
    const { error } = await this.db
      .from('kiosk_product_standards')
      .upsert(standards.map(standardToRow), { onConflict: 'kiosk_id,product_id' })
    if (error) throw new Error(`[supabase] ${error.message}`)
  }
}
