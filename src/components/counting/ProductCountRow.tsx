'use client'

import { QuarterQuantityInput } from './QuarterQuantityInput'
import { QuickQuantityInput } from './QuickQuantityInput'
import { calculateRestockQuantity } from '@/domain/counting/calculateRestock'
import { getQuickCountConfig } from '@/lib/counting/quickCountConfig'
import { fromQuarterUnits, formatQuantity } from '@/lib/quarterUnits'
import { cn } from '@/lib/utils'
import type { Product } from '@/types'

interface ProductCountRowProps {
  product: Product
  /** Norm in kwarteenheden. */
  targetQuantityQuarters: number
  /** Getelde waarde in kwarteenheden, of `undefined` als er nog niet geteld is. */
  countedQuantityQuarters: number | undefined
  onCountChange: (productId: string, valueQuarters: number) => void
  onCountClear: (productId: string) => void
  halfPackageThresholdPercentage?: number
  /** Waar de voorraad van dit product bij deze kiosk ligt, als dat afwijkt. */
  storageNote?: string
}

export function ProductCountRow({
  product,
  targetQuantityQuarters,
  countedQuantityQuarters,
  onCountChange,
  onCountClear,
  halfPackageThresholdPercentage = 80,
  storageNote,
}: ProductCountRowProps) {
  const targetQty = fromQuarterUnits(targetQuantityQuarters)
  const isCounted = countedQuantityQuarters !== undefined
  const countedQty = isCounted ? fromQuarterUnits(countedQuantityQuarters) : undefined
  const quickConfig = getQuickCountConfig(product.id)

  // Zolang er niet geteld is, bestaat er geen bijvuladvies. Een ontbrekende
  // waarde is nadrukkelijk niet hetzelfde als 0.
  const result =
    countedQty === undefined
      ? null
      : calculateRestockQuantity({
          targetQuantity: targetQty,
          countedQuantity: countedQty,
          halfPackageThresholdPercentage,
        })

  const isFull = result !== null && result.restockQuantity === 0
  const isAboveNorm = countedQty !== undefined && targetQty > 0 && countedQty > targetQty * 1.2

  /*
   * De staat blijkt uit een streep aan de zijkant plus de tekst rechts, niet
   * uit een gekleurd vlak. Grote gekleurde vlakken maken een lijst van
   * vijftien producten onrustig, en kleur alleen is geen betrouwbaar signaal.
   */
  const statusBar = !isCounted
    ? 'bg-concrete-deep'
    : isFull
      ? 'bg-emerald-600'
      : 'bg-amber-500'

  return (
    <div className={cn('relative py-3 pl-4 pr-3', !isCounted && 'bg-concrete-light/60')}>
      <span className={cn('absolute left-0 top-0 h-full w-1', statusBar)} aria-hidden="true" />

      <div className="mb-2 flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-ink">{product.name}</p>
          <p className="text-xs text-ink-muted">
            Norm {formatQuantity(targetQty)} {product.packagingUnit} · aanwezig{' '}
            <span className="tabular font-medium text-ink">
              {countedQty === undefined ? '—' : formatQuantity(countedQty)}
            </span>
          </p>
        </div>

        <p
          className={cn(
            'tabular flex-shrink-0 whitespace-nowrap text-sm font-bold',
            !isCounted ? 'text-ink-faint' : isFull ? 'text-emerald-700' : 'text-amber-700'
          )}
        >
          {!isCounted ? 'Nog tellen' : isFull ? 'Vol' : `+${result?.restockQuantity ?? 0}`}
        </p>
      </div>

      {/* Waar de rest van de voorraad ligt. Blijft staan ook nadat er geteld
          is: anders verdwijnt bij het nakijken van een telling juist de reden
          waarom het aantal hoger is dan wat er vooraan staat. */}
      {storageNote && (
        <p className="mb-2 flex items-start gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-900">
          <span aria-hidden="true">📦</span>
          <span>{storageNote}</span>
        </p>
      )}

      {/*
        Snelknoppen waar dat helpt, het gewone veld waar dat niet zo is. Beide
        krijgen exact dezelfde `onChange`: de invoermethode mag nooit invloed
        hebben op wat er opgeslagen wordt of op het bijvuladvies.
      */}
      {quickConfig ? (
        <QuickQuantityInput
          value={countedQty}
          onChange={(val) => onCountChange(product.id, Math.round(val * 4))}
          onClear={() => onCountClear(product.id)}
          mode={quickConfig.mode}
          max={quickConfig.max}
          targetQuantity={targetQty}
          step={product.inputStep as 1 | 0.5 | 0.25}
          packagingUnit={product.packagingUnit}
        />
      ) : (
        <QuarterQuantityInput
          value={countedQty}
          onChange={(val) => onCountChange(product.id, Math.round(val * 4))}
          onClear={() => onCountClear(product.id)}
          step={product.inputStep as 1 | 0.5 | 0.25}
          targetQuantity={targetQty}
        />
      )}

      {isCounted && result !== null && !isFull && (
        <p className="mt-1.5 text-xs text-ink-muted">
          Effectief {formatQuantity(result.effectiveQuantity)} — bijvullen{' '}
          <span className="font-semibold text-ink">
            {result.restockQuantity} {product.packagingUnit}
          </span>
        </p>
      )}

      {isAboveNorm && (
        <p
          className="mt-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-900"
          role="alert"
        >
          Geteld aantal ligt meer dan 20% boven de norm
        </p>
      )}
    </div>
  )
}
