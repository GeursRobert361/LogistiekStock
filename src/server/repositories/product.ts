import type { IProductRepository } from '@/repositories/interfaces/IProductRepository'
import type { KioskProductStandard, Product, ProductCategory } from '@/types'
import { query, queryOne, queryRequired, buildUpdate, buildUpsert, transaction } from '@/server/db/pool'
import {
  mapCategory,
  mapProduct,
  mapStandard,
  categoryToRow,
  productToRow,
  standardToRow,
} from '@/server/db/rowMappers'

async function insert(table: string, row: Record<string, unknown>) {
  const columns = Object.keys(row)
  return queryRequired(
    `insert into ${table} (${columns.join(', ')}) values (${columns
      .map((_, i) => `$${i + 1}`)
      .join(', ')}) returning *`,
    Object.values(row)
  )
}

export const productRepository: IProductRepository = {
  async getCategories(options) {
    const rows = await query(
      options?.includeInactive === true
        ? 'select * from product_categories order by sort_order'
        : 'select * from product_categories where is_active = true order by sort_order'
    )
    return rows.map(mapCategory)
  },

  async createCategory(data) {
    return mapCategory(await insert('product_categories', categoryToRow(data)))
  },

  async updateCategory(id, data) {
    const statement = buildUpdate('product_categories', categoryToRow(data), id)
    if (!statement) {
      return mapCategory(await queryRequired('select * from product_categories where id = $1', [id]))
    }
    return mapCategory(await queryRequired(statement.text, statement.params))
  },

  async getProducts(options) {
    const conditions = ['deleted_at is null']
    const params: unknown[] = []

    if (options?.activeOnly !== false) conditions.push('is_active = true')
    if (options?.categoryId) {
      params.push(options.categoryId)
      conditions.push(`category_id = $${params.length}`)
    }

    const rows = await query(
      `select * from products where ${conditions.join(' and ')} order by sort_order`,
      params
    )
    return rows.map(mapProduct)
  },

  async getProductById(id) {
    const row = await queryOne('select * from products where id = $1', [id])
    return row ? mapProduct(row) : null
  },

  async createProduct(data) {
    return mapProduct(await insert('products', productToRow(data)))
  },

  async updateProduct(id, data) {
    const statement = buildUpdate('products', productToRow(data), id)
    if (!statement) return (await this.getProductById(id)) as Product
    return mapProduct(await queryRequired(statement.text, statement.params))
  },

  async deleteProduct(id) {
    await this.updateProduct(id, { isActive: false })
  },

  async getStandards(kioskId) {
    const rows = await query(
      'select * from kiosk_product_standards where kiosk_id = $1 and is_active = true',
      [kioskId]
    )
    return rows.map(mapStandard)
  },

  async getStandardMatrix(ringId) {
    const kioskRows = await query(
      `select id, number from kiosks
       where ring_id = $1 and is_active = true and deleted_at is null
       order by sort_order`,
      [ringId]
    )
    const kiosks = kioskRows.map((row) => ({ id: String(row.id), number: Number(row.number) }))
    const products = await this.getProducts({ activeOnly: true })

    const standards: Record<string, Record<string, KioskProductStandard>> = {}
    if (kiosks.length > 0) {
      const rows = await query(
        'select * from kiosk_product_standards where kiosk_id = any($1::uuid[])',
        [kiosks.map((k) => k.id)]
      )
      for (const row of rows) {
        const standard = mapStandard(row)
        if (!standards[standard.productId]) standards[standard.productId] = {}
        standards[standard.productId]![standard.kioskId] = standard
      }
    }

    return { products, kiosks, standards }
  },

  async upsertStandard(data) {
    const { text, params } = buildUpsert('kiosk_product_standards', standardToRow(data), [
      'kiosk_id',
      'product_id',
    ])
    return mapStandard(await queryRequired(text, params))
  },

  async bulkUpsertStandards(standards) {
    if (standards.length === 0) return
    // Eén transactie: een half doorgevoerde normenwijziging is erger dan geen.
    await transaction(async (client) => {
      for (const standard of standards) {
        const { text, params } = buildUpsert('kiosk_product_standards', standardToRow(standard), [
          'kiosk_id',
          'product_id',
        ])
        await client.query(text, params)
      }
    })
  },
}

export type { ProductCategory }
