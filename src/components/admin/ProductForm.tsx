'use client'

import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { InputStep, ProductSize, RoundType } from '@/types'
import type { Product, ProductCategory } from '@/types'

export type ProductFormValues = Omit<Product, 'id' | 'createdAt' | 'updatedAt'>

interface ProductFormProps {
  categories: ProductCategory[]
  initial?: Product
  onSubmit: (values: ProductFormValues) => Promise<void>
  onDeactivate?: () => Promise<void>
}

const ROUND_TYPE_LABEL: Record<RoundType, string> = {
  [RoundType.PRODUCT_ROUND]: 'Altijd een eigen ronde',
  [RoundType.MIXED_PALLET]: 'Altijd gemengde pallet',
  [RoundType.AUTO]: 'Automatisch bepalen',
}

const SIZE_LABEL: Record<ProductSize, string> = {
  [ProductSize.SMALL]: 'Klein',
  [ProductSize.MEDIUM]: 'Middel',
  [ProductSize.LARGE]: 'Groot',
}

const STEP_LABEL: Record<string, string> = {
  '1': 'Hele verpakkingen',
  '0.5': 'Halve verpakkingen (0,5)',
  '0.25': 'Kwart verpakkingen (0,25)',
}

export function ProductForm({ categories, initial, onSubmit, onDeactivate }: ProductFormProps) {
  const [values, setValues] = useState<ProductFormValues>({
    categoryId: initial?.categoryId ?? categories[0]?.id ?? '',
    name: initial?.name ?? '',
    shortName: initial?.shortName ?? '',
    countUnit: initial?.countUnit ?? '',
    packagingUnit: initial?.packagingUnit ?? '',
    sortOrder: initial?.sortOrder ?? 0,
    isActive: initial?.isActive ?? true,
    inputStep: initial?.inputStep ?? InputStep.ONE,
    allowPartialPackage: initial?.allowPartialPackage ?? false,
    roundType: initial?.roundType ?? RoundType.AUTO,
    productSize: initial?.productSize ?? ProductSize.MEDIUM,
    estimatedPalletLoad: initial?.estimatedPalletLoad ?? 1,
    ownRoundThreshold: initial?.ownRoundThreshold ?? 20,
    priority: initial?.priority ?? 0,
    storageLocation: initial?.storageLocation ?? '',
    refrigerated: initial?.refrigerated ?? false,
    notes: initial?.notes ?? '',
  })
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function set<K extends keyof ProductFormValues>(key: K, value: ProductFormValues[K]) {
    setValues((previous) => ({ ...previous, [key]: value }))
  }

  function numberField(key: keyof ProductFormValues, raw: string, allowDecimals = false) {
    const normalized = raw.replace(',', '.')
    const parsed = allowDecimals ? Number.parseFloat(normalized) : Number.parseInt(normalized, 10)
    set(key, (Number.isFinite(parsed) ? parsed : 0) as never)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (!values.name.trim() || !values.shortName.trim()) {
      setError('Naam en korte naam zijn verplicht.')
      return
    }
    if (!values.countUnit.trim() || !values.packagingUnit.trim()) {
      setError('Vul de teleenheid en de verpakkingseenheid in.')
      return
    }

    setIsSaving(true)
    try {
      await onSubmit({
        ...values,
        name: values.name.trim(),
        shortName: values.shortName.trim(),
        storageLocation: values.storageLocation?.trim() || undefined,
        notes: values.notes?.trim() || undefined,
      })
    } catch (submitError) {
      console.error('[beheer] Product opslaan mislukt.', submitError)
      setError(submitError instanceof Error ? submitError.message : 'Opslaan is mislukt.')
      setIsSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4">
      <Select
        label="Categorie"
        value={values.categoryId}
        onChange={(e) => set('categoryId', e.target.value)}
        options={categories.map((category) => ({ value: category.id, label: category.name }))}
      />

      <Input label="Naam" value={values.name} onChange={(e) => set('name', e.target.value)} />
      <Input
        label="Korte naam"
        value={values.shortName}
        onChange={(e) => set('shortName', e.target.value)}
      />

      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Teleenheid"
          placeholder="pak"
          value={values.countUnit}
          onChange={(e) => set('countUnit', e.target.value)}
        />
        <Input
          label="Verpakkingseenheid"
          placeholder="pakken"
          value={values.packagingUnit}
          onChange={(e) => set('packagingUnit', e.target.value)}
        />
      </div>

      <Select
        label="Invoerstap bij tellen"
        value={String(values.inputStep)}
        onChange={(e) => set('inputStep', Number(e.target.value) as InputStep)}
        options={['1', '0.5', '0.25'].map((value) => ({ value, label: STEP_LABEL[value]! }))}
      />

      <Select
        label="Soort vulronde"
        value={values.roundType}
        onChange={(e) => set('roundType', e.target.value as RoundType)}
        options={Object.values(RoundType).map((value) => ({
          value,
          label: ROUND_TYPE_LABEL[value],
        }))}
      />

      <Select
        label="Formaat"
        value={values.productSize}
        onChange={(e) => set('productSize', e.target.value as ProductSize)}
        options={Object.values(ProductSize).map((value) => ({ value, label: SIZE_LABEL[value] }))}
      />

      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Drempel eigen ronde"
          inputMode="numeric"
          value={String(values.ownRoundThreshold)}
          onChange={(e) => numberField('ownRoundThreshold', e.target.value)}
        />
        <Input
          label="Palletbelasting"
          inputMode="decimal"
          value={String(values.estimatedPalletLoad)}
          onChange={(e) => numberField('estimatedPalletLoad', e.target.value, true)}
        />
      </div>
      <p className="-mt-2 text-xs text-gray-600">
        Bij automatisch bepalen krijgt dit product een eigen ronde zodra het aantal de drempel
        haalt of de geschatte palletbelasting te groot wordt. Drempel 0 betekent: niet ingesteld.
      </p>

      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Prioriteit"
          inputMode="numeric"
          value={String(values.priority)}
          onChange={(e) => numberField('priority', e.target.value)}
        />
        <Input
          label="Volgorde"
          inputMode="numeric"
          value={String(values.sortOrder)}
          onChange={(e) => numberField('sortOrder', e.target.value)}
        />
      </div>

      <Input
        label="Opslaglocatie"
        value={values.storageLocation ?? ''}
        onChange={(e) => set('storageLocation', e.target.value)}
      />

      <div className="space-y-2">
        <Toggle
          label="Gekoeld"
          checked={values.refrigerated}
          onChange={(checked) => set('refrigerated', checked)}
        />
        <Toggle
          label="Deelverpakking toegestaan"
          checked={values.allowPartialPackage}
          onChange={(checked) => set('allowPartialPackage', checked)}
        />
        <Toggle
          label="Actief"
          checked={values.isActive}
          onChange={(checked) => set('isActive', checked)}
        />
      </div>

      {error && (
        <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
          {error}
        </p>
      )}

      <Button type="submit" size="lg" className="w-full" disabled={isSaving}>
        {isSaving ? 'Opslaan…' : 'Opslaan'}
      </Button>

      {onDeactivate && values.isActive && (
        <Button
          type="button"
          variant="outline"
          size="md"
          className="w-full"
          onClick={() => void onDeactivate()}
        >
          Product uitschakelen
        </Button>
      )}
    </form>
  )
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="flex min-h-12 cursor-pointer items-center justify-between rounded-xl border border-gray-300 bg-white px-3">
      <span className="text-sm font-medium text-gray-800">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-5 w-5 accent-arena-red"
      />
    </label>
  )
}
