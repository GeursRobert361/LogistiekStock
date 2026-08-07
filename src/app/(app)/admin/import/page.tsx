'use client'

import { useCallback, useEffect, useState, type ChangeEvent } from 'react'
import Papa from 'papaparse'
import { AppHeader } from '@/components/layout/AppHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { repositories } from '@/repositories'
import { validateStandardValue, DEFAULT_HALF_PACKAGE_THRESHOLD } from '@/services/standardsService'
import { formatQuantity, fromQuarterUnits } from '@/lib/quarterUnits'
import type { Kiosk, KioskProductStandard, Product } from '@/types'

type RowStatus = 'NEW' | 'CHANGED' | 'UNCHANGED' | 'INVALID'

interface PreviewRow {
  kioskNumber: string
  productName: string
  rawQuantity: string
  kioskId?: string
  productId?: string
  newQuarters: number
  currentQuarters?: number
  status: RowStatus
  error?: string
}

const STATUS_LABEL: Record<RowStatus, string> = {
  NEW: 'Nieuw',
  CHANGED: 'Wijzigt',
  UNCHANGED: 'Gelijk',
  INVALID: 'Fout',
}

const REQUIRED_COLUMNS = ['kiosk_number', 'product_name', 'target_quantity']

export default function AdminImportPage() {
  const [kiosks, setKiosks] = useState<Kiosk[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [standards, setStandards] = useState<Map<string, KioskProductStandard>>(new Map())
  const [rows, setRows] = useState<PreviewRow[]>([])
  const [fileName, setFileName] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isImporting, setIsImporting] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [kioskList, productList, rings] = await Promise.all([
      repositories.kiosk().getKiosks(),
      repositories.product().getProducts({ activeOnly: false }),
      repositories.kiosk().getRings(),
    ])
    setKiosks(kioskList)
    setProducts(productList)

    const standardMap = new Map<string, KioskProductStandard>()
    for (const ring of rings) {
      const matrix = await repositories.product().getStandardMatrix(ring.id)
      for (const perKiosk of Object.values(matrix.standards)) {
        for (const standard of Object.values(perKiosk)) {
          standardMap.set(`${standard.kioskId}:${standard.productId}`, standard)
        }
      }
    }
    setStandards(standardMap)
    setIsLoading(false)
  }, [])

  useEffect(() => {
    load().catch((loadError: unknown) => {
      console.error('[import] Laden mislukt.', loadError)
      setError('De huidige normen konden niet worden geladen.')
      setIsLoading(false)
    })
  }, [load])

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    setFileName(file.name)
    setResult(null)
    setError(null)

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (parsed) => {
        const columns = parsed.meta.fields ?? []
        const missing = REQUIRED_COLUMNS.filter((column) => !columns.includes(column))
        if (missing.length > 0) {
          setRows([])
          setError(`Deze kolommen ontbreken: ${missing.join(', ')}`)
          return
        }
        setRows(parsed.data.map(toPreviewRow))
      },
      error: (parseError) => {
        console.error('[import] CSV lezen mislukt.', parseError)
        setError('Het bestand kon niet worden gelezen.')
      },
    })
  }

  function toPreviewRow(raw: Record<string, string>): PreviewRow {
    const kioskNumber = (raw['kiosk_number'] ?? '').trim()
    const productName = (raw['product_name'] ?? '').trim()
    const rawQuantity = (raw['target_quantity'] ?? '').trim()

    const base: PreviewRow = {
      kioskNumber,
      productName,
      rawQuantity,
      newQuarters: 0,
      status: 'INVALID',
    }

    const kiosk = kiosks.find((k) => String(k.number) === kioskNumber)
    if (!kiosk) return { ...base, error: `Onbekende kiosk "${kioskNumber}"` }

    const product = products.find(
      (p) =>
        p.name.toLowerCase() === productName.toLowerCase() ||
        p.shortName.toLowerCase() === productName.toLowerCase()
    )
    if (!product) return { ...base, error: `Onbekend product "${productName}"` }

    const validation = validateStandardValue(rawQuantity, product)
    if (validation.error) {
      return { ...base, kioskId: kiosk.id, productId: product.id, error: validation.error }
    }

    const current = standards.get(`${kiosk.id}:${product.id}`)?.targetQuantityQuarters
    const status: RowStatus =
      current === undefined ? 'NEW' : current === validation.quarterUnits ? 'UNCHANGED' : 'CHANGED'

    return {
      ...base,
      kioskId: kiosk.id,
      productId: product.id,
      newQuarters: validation.quarterUnits,
      currentQuarters: current,
      status,
    }
  }

  const applicable = rows.filter((row) => row.status === 'NEW' || row.status === 'CHANGED')
  const invalid = rows.filter((row) => row.status === 'INVALID')
  const unchanged = rows.filter((row) => row.status === 'UNCHANGED')

  async function handleImport() {
    setIsImporting(true)
    setError(null)
    try {
      await repositories.product().bulkUpsertStandards(
        applicable.map((row) => ({
          kioskId: row.kioskId!,
          productId: row.productId!,
          targetQuantityQuarters: row.newQuarters,
          halfPackageThresholdPercentage: DEFAULT_HALF_PACKAGE_THRESHOLD,
          isActive: row.newQuarters > 0,
        }))
      )
      setResult(`${applicable.length} normen bijgewerkt.`)
      setRows([])
      setFileName(null)
      await load()
    } catch (importError) {
      console.error('[import] Importeren mislukt.', importError)
      setError('De import is mislukt. Er is niets gewijzigd.')
    } finally {
      setIsImporting(false)
    }
  }

  function downloadTemplate() {
    const csv = Papa.unparse({
      fields: ['kiosk_number', 'product_name', 'target_quantity'],
      data: products.slice(0, 3).map((product) => [
        String(kiosks[0]?.number ?? 101),
        product.name,
        '10',
      ]),
    })
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'voorraadnormen-voorbeeld.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <AppHeader title="Normen importeren" backHref="/admin/standards" />
      <div className="space-y-4 p-4">
        <Card>
          <CardHeader>
            <CardTitle>CSV inlezen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-gray-700">
              Kolommen:{' '}
              <code className="rounded bg-gray-100 px-1 text-xs">
                kiosk_number, product_name, target_quantity
              </code>
            </p>

            <Button variant="outline" size="md" onClick={downloadTemplate} disabled={isLoading}>
              Voorbeeldbestand downloaden
            </Button>

            <input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              disabled={isLoading}
              className="block w-full text-sm text-gray-700 file:mr-3 file:rounded-lg file:border file:border-gray-300 file:bg-white file:px-3 file:py-2 file:text-sm"
            />

            {fileName && <p className="text-xs text-gray-600">Gekozen bestand: {fileName}</p>}

            {error && (
              <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
                {error}
              </p>
            )}
            {result && (
              <p role="status" className="rounded-lg bg-green-50 px-3 py-2 text-sm font-medium text-green-900">
                {result}
              </p>
            )}
          </CardContent>
        </Card>

        {rows.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Voorbeeld van de wijzigingen</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Badge variant="info">{applicable.length} wijzigen</Badge>
                <Badge variant="default">{unchanged.length} ongewijzigd</Badge>
                {invalid.length > 0 && <Badge variant="danger">{invalid.length} fout</Badge>}
              </div>

              <div className="max-h-72 overflow-auto rounded-lg border border-gray-200">
                <table className="min-w-full text-xs">
                  <thead className="sticky top-0 bg-gray-50">
                    <tr>
                      <th className="px-2 py-2 text-left font-semibold">Kiosk</th>
                      <th className="px-2 py-2 text-left font-semibold">Product</th>
                      <th className="px-2 py-2 text-right font-semibold">Nu</th>
                      <th className="px-2 py-2 text-right font-semibold">Nieuw</th>
                      <th className="px-2 py-2 text-left font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, index) => (
                      <tr key={`${row.kioskNumber}-${row.productName}-${index}`} className="border-t">
                        <td className="px-2 py-1">{row.kioskNumber}</td>
                        <td className="px-2 py-1">{row.productName}</td>
                        <td className="px-2 py-1 text-right text-gray-600">
                          {row.currentQuarters === undefined
                            ? '—'
                            : formatQuantity(fromQuarterUnits(row.currentQuarters))}
                        </td>
                        <td className="px-2 py-1 text-right font-semibold">
                          {row.status === 'INVALID'
                            ? '—'
                            : formatQuantity(fromQuarterUnits(row.newQuarters))}
                        </td>
                        <td className="px-2 py-1">
                          <span
                            className={
                              row.status === 'INVALID'
                                ? 'text-red-700'
                                : row.status === 'UNCHANGED'
                                  ? 'text-gray-500'
                                  : 'text-blue-800'
                            }
                          >
                            {STATUS_LABEL[row.status]}
                          </span>
                          {row.error && (
                            <span className="block text-[11px] text-red-700">{row.error}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="text-xs text-gray-600">
                Alleen de regels met status &quot;Nieuw&quot; of &quot;Wijzigt&quot; worden
                doorgevoerd. Foutieve regels worden overgeslagen.
              </p>

              <Button
                size="lg"
                className="w-full"
                disabled={isImporting || applicable.length === 0}
                onClick={() => void handleImport()}
              >
                {isImporting ? 'Importeren…' : `${applicable.length} normen doorvoeren`}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  )
}
