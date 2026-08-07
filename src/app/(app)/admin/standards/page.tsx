'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { kioskLabel, kioskTitle } from '@/lib/kiosk'
import Link from 'next/link'
import { AppHeader } from '@/components/layout/AppHeader'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { Dialog } from '@/components/ui/Dialog'
import { ListSkeleton } from '@/components/shared/LoadingSkeleton'
import { repositories } from '@/repositories'
import {
  applyStandardToKiosks,
  copyStandards,
  saveStandard,
  validateStandardValue,
} from '@/services/standardsService'
import { formatQuantity, fromQuarterUnits } from '@/lib/quarterUnits'
import type { KioskProductStandard, Product, Ring } from '@/types'

interface MatrixData {
  products: Product[]
  kiosks: Array<{ id: string; number: number }>
  standards: Record<string, Record<string, KioskProductStandard>>
}

type BulkAction = 'copy' | 'apply' | null

export default function AdminStandardsPage() {
  const [rings, setRings] = useState<Ring[]>([])
  const [ringId, setRingId] = useState('')
  const [matrix, setMatrix] = useState<MatrixData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  /** Op mobiel werk je per kiosk; op een breed scherm in de matrix. */
  const [selectedKioskId, setSelectedKioskId] = useState('')
  const [bulkAction, setBulkAction] = useState<BulkAction>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    repositories
      .kiosk()
      .getRings()
      .then((ringList) => {
        setRings(ringList)
        setRingId((current) => current || (ringList[0]?.id ?? ''))
      })
      .catch((loadError: unknown) => {
        console.error('[normen] Ringen laden mislukt.', loadError)
        setError('De ringen konden niet worden geladen.')
      })
  }, [])

  const loadMatrix = useCallback(async () => {
    if (!ringId) return
    setIsLoading(true)
    const data = await repositories.product().getStandardMatrix(ringId)
    setMatrix(data)
    setSelectedKioskId((current) =>
      data.kiosks.some((k) => k.id === current) ? current : (data.kiosks[0]?.id ?? '')
    )
    setIsLoading(false)
  }, [ringId])

  useEffect(() => {
    loadMatrix().catch((loadError: unknown) => {
      console.error('[normen] Matrix laden mislukt.', loadError)
      setError('De voorraadnormen konden niet worden geladen.')
      setIsLoading(false)
    })
  }, [loadMatrix])

  const handleSave = useCallback(
    async (kioskId: string, product: Product, rawValue: string) => {
      const result = validateStandardValue(rawValue, product)
      if (result.error) {
        setError(`${product.shortName}: ${result.error}`)
        return false
      }

      setError(null)
      try {
        await saveStandard({
          kioskId,
          productId: product.id,
          targetQuantityQuarters: result.quarterUnits,
        })
        await loadMatrix()
        return true
      } catch (saveError) {
        console.error('[normen] Opslaan mislukt.', saveError)
        setError('De norm kon niet worden opgeslagen.')
        return false
      }
    },
    [loadMatrix]
  )

  const selectedKiosk = useMemo(
    () => matrix?.kiosks.find((k) => k.id === selectedKioskId) ?? null,
    [matrix, selectedKioskId]
  )

  return (
    <>
      <AppHeader title="Voorraadnormen" backHref="/dashboard" />
      <div className="space-y-4 p-4">
        <Select
          label="Ring"
          value={ringId}
          onChange={(e) => setRingId(e.target.value)}
          options={rings.map((ring) => ({ value: ring.id, label: ring.name }))}
        />

        {message && (
          <p role="status" className="rounded-xl bg-green-50 px-3 py-2 text-sm font-medium text-green-900">
            {message}
          </p>
        )}
        {error && (
          <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
            {error}
          </p>
        )}

        {isLoading || !matrix ? (
          <ListSkeleton count={3} />
        ) : (
          <>
            {/* ── Mobiel: eerst kiosk kiezen ───────────────────────────── */}
            <div className="lg:hidden">
              <Select
                label="Kiosk"
                value={selectedKioskId}
                onChange={(e) => setSelectedKioskId(e.target.value)}
                options={matrix.kiosks.map((kiosk) => ({
                  value: kiosk.id,
                  label: kioskTitle(kiosk),
                }))}
              />

              {selectedKiosk && (
                <div className="mt-3 space-y-2">
                  {matrix.products.map((product) => (
                    <StandardRow
                      key={product.id}
                      product={product}
                      quarterUnits={
                        matrix.standards[product.id]?.[selectedKiosk.id]?.targetQuantityQuarters ?? 0
                      }
                      onSave={(value) => handleSave(selectedKiosk.id, product, value)}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* ── Breed scherm: matrix ─────────────────────────────────── */}
            <div className="hidden lg:block">
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs">
                  <thead>
                    <tr>
                      <th className="sticky left-0 z-10 bg-white py-2 pr-3 text-left font-semibold text-gray-800">
                        Product
                      </th>
                      {matrix.kiosks.map((kiosk) => (
                        <th
                          key={kiosk.id}
                          title={kioskTitle(kiosk)}
                          className="min-w-[3.5rem] px-1 py-2 text-center font-medium leading-tight text-gray-600"
                        >
                          {kioskLabel(kiosk)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {matrix.products.map((product) => (
                      <tr key={product.id} className="border-t border-gray-100">
                        <td className="sticky left-0 z-10 bg-white py-1 pr-3 font-medium text-gray-900">
                          {product.shortName}
                        </td>
                        {matrix.kiosks.map((kiosk) => (
                          <td key={kiosk.id} className="px-0.5 py-1">
                            <MatrixCell
                              quarterUnits={
                                matrix.standards[product.id]?.[kiosk.id]?.targetQuantityQuarters ?? 0
                              }
                              onSave={(value) => handleSave(kiosk.id, product, value)}
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── Bulkacties ───────────────────────────────────────────── */}
            <div className="space-y-2 border-t border-gray-200 pt-3">
              <Button variant="outline" size="md" className="w-full" onClick={() => setBulkAction('copy')}>
                Normen kopiëren naar andere kiosken
              </Button>
              <Button variant="outline" size="md" className="w-full" onClick={() => setBulkAction('apply')}>
                Eén product bij meerdere kiosken aanpassen
              </Button>
              <Link href="/admin/import" className="block">
                <Button variant="outline" size="md" className="w-full">
                  Normen importeren uit CSV
                </Button>
              </Link>
            </div>
          </>
        )}
      </div>

      {matrix && bulkAction === 'copy' && (
        <CopyStandardsDialog
          kiosks={matrix.kiosks}
          defaultSourceId={selectedKioskId}
          onClose={() => setBulkAction(null)}
          onDone={async (count) => {
            setBulkAction(null)
            setMessage(`${count} normen gekopieerd.`)
            await loadMatrix()
          }}
          onError={setError}
        />
      )}

      {matrix && bulkAction === 'apply' && (
        <ApplyToKiosksDialog
          kiosks={matrix.kiosks}
          products={matrix.products}
          onClose={() => setBulkAction(null)}
          onDone={async (count) => {
            setBulkAction(null)
            setMessage(`Norm aangepast bij ${count} kiosken.`)
            await loadMatrix()
          }}
          onError={setError}
        />
      )}
    </>
  )
}

function StandardRow({
  product,
  quarterUnits,
  onSave,
}: {
  product: Product
  quarterUnits: number
  onSave: (value: string) => Promise<boolean>
}) {
  const [value, setValue] = useState(formatQuantity(fromQuarterUnits(quarterUnits)))

  useEffect(() => {
    setValue(formatQuantity(fromQuarterUnits(quarterUnits)))
  }, [quarterUnits])

  return (
    <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-gray-900">{product.name}</p>
        <p className="text-xs text-gray-600">
          {product.packagingUnit}
          {product.allowPartialPackage ? ' · deelverpakking toegestaan' : ' · hele verpakkingen'}
        </p>
      </div>
      <input
        type="text"
        inputMode="decimal"
        aria-label={`Norm voor ${product.name}`}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => void onSave(value)}
        className="h-14 w-24 flex-shrink-0 rounded-xl border border-gray-300 text-center text-xl font-bold text-gray-900 focus:border-arena-red focus:outline-none focus:ring-2 focus:ring-arena-red/30"
      />
    </div>
  )
}

function MatrixCell({
  quarterUnits,
  onSave,
}: {
  quarterUnits: number
  onSave: (value: string) => Promise<boolean>
}) {
  const [value, setValue] = useState(formatQuantity(fromQuarterUnits(quarterUnits)))

  useEffect(() => {
    setValue(formatQuantity(fromQuarterUnits(quarterUnits)))
  }, [quarterUnits])

  return (
    <input
      type="text"
      inputMode="decimal"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => void onSave(value)}
      className={`h-9 w-14 rounded border text-center text-sm ${
        quarterUnits === 0
          ? 'border-gray-200 bg-gray-50 text-gray-400'
          : 'border-gray-300 bg-white text-gray-900'
      } focus:border-arena-red focus:outline-none focus:ring-1 focus:ring-arena-red/40`}
    />
  )
}

function KioskPicker({
  kiosks,
  selected,
  onToggle,
  onToggleAll,
}: {
  kiosks: Array<{ id: string; number: number }>
  selected: Set<string>
  onToggle: (id: string) => void
  onToggleAll: () => void
}) {
  return (
    <>
      <button
        type="button"
        onClick={onToggleAll}
        className="mb-2 text-sm font-medium text-arena-red underline underline-offset-2"
      >
        {selected.size === kiosks.length ? 'Selectie wissen' : 'Alle kiosken selecteren'}
      </button>
      <div className="grid max-h-56 grid-cols-4 gap-1 overflow-y-auto">
        {kiosks.map((kiosk) => (
          <button
            key={kiosk.id}
            type="button"
            onClick={() => onToggle(kiosk.id)}
            aria-pressed={selected.has(kiosk.id)}
            className={`min-h-11 rounded-lg border px-1 font-medium leading-tight ${
              kioskLabel(kiosk).length > 4 ? 'text-xs' : 'text-sm'
            } ${
              selected.has(kiosk.id)
                ? 'border-arena-red bg-red-50 text-arena-red'
                : 'border-gray-300 bg-white text-gray-700'
            }`}
          >
            {kioskLabel(kiosk)}
          </button>
        ))}
      </div>
    </>
  )
}

function CopyStandardsDialog({
  kiosks,
  defaultSourceId,
  onClose,
  onDone,
  onError,
}: {
  kiosks: Array<{ id: string; number: number }>
  defaultSourceId: string
  onClose: () => void
  onDone: (count: number) => Promise<void>
  onError: (message: string) => void
}) {
  const [sourceId, setSourceId] = useState(defaultSourceId || (kiosks[0]?.id ?? ''))
  const [targets, setTargets] = useState<Set<string>>(new Set())
  const [isSaving, setIsSaving] = useState(false)

  async function handleCopy() {
    setIsSaving(true)
    try {
      const count = await copyStandards(sourceId, [...targets])
      await onDone(count)
    } catch (copyError) {
      console.error('[normen] Kopiëren mislukt.', copyError)
      onError(copyError instanceof Error ? copyError.message : 'Kopiëren is mislukt.')
      setIsSaving(false)
    }
  }

  return (
    <Dialog open onClose={onClose} title="Normen kopiëren">
      <div className="space-y-3">
        <Select
          label="Van kiosk"
          value={sourceId}
          onChange={(e) => setSourceId(e.target.value)}
          options={kiosks.map((kiosk) => ({ value: kiosk.id, label: kioskTitle(kiosk) }))}
        />

        <div>
          <p className="mb-1 text-sm font-medium text-gray-700">Naar kiosken</p>
          <KioskPicker
            kiosks={kiosks.filter((k) => k.id !== sourceId)}
            selected={targets}
            onToggle={(id) =>
              setTargets((previous) => {
                const next = new Set(previous)
                if (next.has(id)) next.delete(id)
                else next.add(id)
                return next
              })
            }
            onToggleAll={() =>
              setTargets((previous) =>
                previous.size === kiosks.length - 1
                  ? new Set()
                  : new Set(kiosks.filter((k) => k.id !== sourceId).map((k) => k.id))
              )
            }
          />
        </div>

        <p className="text-xs text-gray-600">
          De bestaande normen van de gekozen kiosken worden overschreven.
        </p>

        <div className="flex gap-2">
          <Button variant="outline" size="md" className="flex-1" onClick={onClose}>
            Annuleren
          </Button>
          <Button
            size="md"
            className="flex-1"
            disabled={isSaving || targets.size === 0}
            onClick={() => void handleCopy()}
          >
            {isSaving ? 'Bezig…' : `Kopiëren (${targets.size})`}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}

function ApplyToKiosksDialog({
  kiosks,
  products,
  onClose,
  onDone,
  onError,
}: {
  kiosks: Array<{ id: string; number: number }>
  products: Product[]
  onClose: () => void
  onDone: (count: number) => Promise<void>
  onError: (message: string) => void
}) {
  const [productId, setProductId] = useState(products[0]?.id ?? '')
  const [value, setValue] = useState('0')
  const [targets, setTargets] = useState<Set<string>>(new Set())
  const [isSaving, setIsSaving] = useState(false)

  const product = products.find((p) => p.id === productId)

  async function handleApply() {
    if (!product) return
    const result = validateStandardValue(value, product)
    if (result.error) {
      onError(result.error)
      return
    }

    setIsSaving(true)
    try {
      const count = await applyStandardToKiosks({
        kioskIds: [...targets],
        productId,
        targetQuantityQuarters: result.quarterUnits,
      })
      await onDone(count)
    } catch (applyError) {
      console.error('[normen] Aanpassen mislukt.', applyError)
      onError('Aanpassen is mislukt.')
      setIsSaving(false)
    }
  }

  return (
    <Dialog open onClose={onClose} title="Norm bij meerdere kiosken">
      <div className="space-y-3">
        <Select
          label="Product"
          value={productId}
          onChange={(e) => setProductId(e.target.value)}
          options={products.map((p) => ({ value: p.id, label: p.name }))}
        />

        <div>
          <label htmlFor="bulk-value" className="mb-1 block text-sm font-medium text-gray-700">
            Nieuwe norm
          </label>
          <input
            id="bulk-value"
            type="text"
            inputMode="decimal"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="h-14 w-full rounded-xl border border-gray-300 text-center text-2xl font-bold text-gray-900 focus:border-arena-red focus:outline-none focus:ring-2 focus:ring-arena-red/30"
          />
        </div>

        <div>
          <p className="mb-1 text-sm font-medium text-gray-700">Kiosken</p>
          <KioskPicker
            kiosks={kiosks}
            selected={targets}
            onToggle={(id) =>
              setTargets((previous) => {
                const next = new Set(previous)
                if (next.has(id)) next.delete(id)
                else next.add(id)
                return next
              })
            }
            onToggleAll={() =>
              setTargets((previous) =>
                previous.size === kiosks.length ? new Set() : new Set(kiosks.map((k) => k.id))
              )
            }
          />
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="md" className="flex-1" onClick={onClose}>
            Annuleren
          </Button>
          <Button
            size="md"
            className="flex-1"
            disabled={isSaving || targets.size === 0}
            onClick={() => void handleApply()}
          >
            {isSaving ? 'Bezig…' : `Toepassen (${targets.size})`}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
