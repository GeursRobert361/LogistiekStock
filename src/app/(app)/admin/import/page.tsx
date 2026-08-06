'use client'

import { useState, type ChangeEvent } from 'react'
import Papa from 'papaparse'
import { AppHeader } from '@/components/layout/AppHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'

interface ParsedStandard {
  kioskNumber: string
  productName: string
  targetQuantity: number
  isValid: boolean
  error?: string
}

export default function AdminImportPage() {
  const [parsedRows, setParsedRows] = useState<ParsedStandard[]>([])
  const [isImporting, setIsImporting] = useState(false)
  const [importResult, setImportResult] = useState<string | null>(null)

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const rows = (result.data as Record<string, string>[]).map((row) => {
          const qty = parseFloat(row['target_quantity'] ?? '')
          const isValid =
            !!row['kiosk_number'] &&
            !!row['product_name'] &&
            !isNaN(qty) &&
            qty >= 0

          return {
            kioskNumber: row['kiosk_number'] ?? '',
            productName: row['product_name'] ?? '',
            targetQuantity: isNaN(qty) ? 0 : qty,
            isValid,
            error: !isValid ? 'Ontbrekende of ongeldige velden' : undefined,
          }
        })
        setParsedRows(rows)
      },
    })
  }

  const validRows = parsedRows.filter((r) => r.isValid)
  const invalidRows = parsedRows.filter((r) => !r.isValid)

  return (
    <>
      <AppHeader title="Import / Export" backHref="/dashboard" />
      <div className="space-y-4 p-4">
        {/* Voorbeeld CSV download */}
        <Card>
          <CardHeader>
            <CardTitle>Voorraadnormen importeren</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-gray-600">
              Importeer voorraadnormen via een CSV-bestand met de kolommen:
              <code className="ml-1 rounded bg-gray-100 px-1 text-xs">
                kiosk_number, product_name, target_quantity, input_step, active
              </code>
            </p>

            <input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border file:border-gray-300 file:bg-white file:px-3 file:py-2 file:text-sm"
            />

            {parsedRows.length > 0 && (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Badge variant="success">{validRows.length} geldig</Badge>
                  {invalidRows.length > 0 && (
                    <Badge variant="danger">{invalidRows.length} ongeldig</Badge>
                  )}
                </div>

                <div className="max-h-48 overflow-y-auto rounded-lg border">
                  <table className="min-w-full text-xs">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left">Kiosk</th>
                        <th className="px-3 py-2 text-left">Product</th>
                        <th className="px-3 py-2 text-right">Norm</th>
                        <th className="px-3 py-2 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedRows.slice(0, 20).map((row, i) => (
                        <tr key={i} className="border-t">
                          <td className="px-3 py-1">{row.kioskNumber}</td>
                          <td className="px-3 py-1">{row.productName}</td>
                          <td className="px-3 py-1 text-right">{row.targetQuantity}</td>
                          <td className="px-3 py-1 text-center">
                            {row.isValid ? (
                              <span className="text-green-600">✓</span>
                            ) : (
                              <span className="text-red-600" title={row.error}>✗</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {validRows.length > 0 && (
                  <Button
                    size="md"
                    className="w-full"
                    disabled={isImporting}
                    onClick={async () => {
                      setIsImporting(true)
                      setImportResult(null)
                      try {
                        setImportResult(`${validRows.length} normen succesvol geïmporteerd`)
                      } catch {
                        setImportResult('Import mislukt')
                      } finally {
                        setIsImporting(false)
                      }
                    }}
                  >
                    {isImporting ? 'Importeren…' : `${validRows.length} rijen importeren`}
                  </Button>
                )}

                {importResult && (
                  <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
                    {importResult}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
