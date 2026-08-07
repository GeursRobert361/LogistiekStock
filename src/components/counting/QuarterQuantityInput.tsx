'use client'

import { useCallback, useId, useState } from 'react'
import { cn } from '@/lib/utils'
import {
  toQuarterUnits,
  fromQuarterUnits,
  formatQuantity,
  parseQuantity,
  isValidQuantity,
} from '@/lib/quarterUnits'

interface QuarterQuantityInputProps {
  /**
   * Huidige waarde in verpakkingen, of `undefined` wanneer er nog niet geteld is.
   * `undefined` en 0 zijn nadrukkelijk niet hetzelfde.
   */
  value: number | undefined
  /** Nieuwe waarde in verpakkingen. */
  onChange: (value: number) => void
  /** Zet het product terug op "nog niet geteld". */
  onClear?: () => void
  step?: 1 | 0.5 | 0.25
  /** Norm, gebruikt voor de "Vol"-knop. */
  targetQuantity: number
  min?: number
  label?: string
  disabled?: boolean
  className?: string
}

export function QuarterQuantityInput({
  value,
  onChange,
  onClear,
  step = 1,
  targetQuantity,
  min = 0,
  label,
  disabled = false,
  className,
}: QuarterQuantityInputProps) {
  const inputId = useId()
  const [inputText, setInputText] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const isCounted = value !== undefined
  const displayValue = inputText !== null ? inputText : isCounted ? formatQuantity(value) : ''

  const adjust = useCallback(
    (delta: number) => {
      const deltaQU = Math.round(delta * 4)
      // Nog niet geteld: "+" begint bij de stapgrootte zelf.
      const currentQU = value === undefined ? 0 : toQuarterUnits(value)
      const newQU = Math.max(Math.round(min * 4), currentQU + deltaQU)
      onChange(fromQuarterUnits(newQU))
      setInputText(null)
      setError(null)
    },
    [value, min, onChange]
  )

  function commitText() {
    if (inputText === null) return
    const trimmed = inputText.trim()

    if (trimmed === '') {
      // Leeggemaakt veld betekent "nog niet geteld", niet "nul".
      onClear?.()
      setInputText(null)
      setError(null)
      return
    }

    try {
      const parsed = parseQuantity(trimmed)
      if (!isValidQuantity(parsed)) {
        setError('Gebruik stappen van 0,25 (bijv. 4 of 4,5)')
        return
      }
      onChange(Math.max(min, parsed))
      setInputText(null)
      setError(null)
    } catch {
      setError('Ongeldige waarde — gebruik bijvoorbeeld 4 of 4,5')
    }
  }

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-gray-700">
          {label}
        </label>
      )}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => adjust(-step)}
          disabled={disabled || !isCounted || value <= min}
          aria-label={`Verminder met ${formatQuantity(step)}`}
          className={cn(
            'flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl text-2xl font-bold',
            'border border-gray-300 bg-white text-gray-700',
            'active:bg-gray-200 disabled:opacity-40'
          )}
        >
          −
        </button>

        <div className="flex-1">
          <input
            id={inputId}
            type="text"
            inputMode="decimal"
            value={displayValue}
            placeholder="—"
            onChange={(e) => {
              setInputText(e.target.value)
              setError(null)
            }}
            onBlur={commitText}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                commitText()
              }
            }}
            disabled={disabled}
            aria-invalid={error != null}
            aria-describedby={error ? `${inputId}-error` : undefined}
            className={cn(
              'h-14 w-full rounded-xl border text-center text-2xl font-bold text-gray-900',
              'placeholder:font-normal placeholder:text-gray-400',
              'focus:border-arena-red focus:outline-none focus:ring-2 focus:ring-arena-red/30',
              error
                ? 'border-red-400 bg-red-50'
                : isCounted
                  ? 'border-gray-300 bg-white'
                  : 'border-dashed border-gray-300 bg-gray-50',
              'disabled:opacity-50'
            )}
          />
        </div>

        <button
          type="button"
          onClick={() => adjust(step)}
          disabled={disabled}
          aria-label={`Verhoog met ${formatQuantity(step)}`}
          className={cn(
            'flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl text-2xl font-bold',
            'border border-gray-300 bg-white text-gray-700',
            'active:bg-gray-200 disabled:opacity-40'
          )}
        >
          +
        </button>
      </div>

      {error && (
        <p id={`${inputId}-error`} role="alert" className="text-xs font-medium text-red-600">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            onChange(0)
            setInputText(null)
            setError(null)
          }}
          disabled={disabled}
          className="min-h-11 flex-1 rounded-lg border border-gray-300 bg-white text-sm font-semibold text-gray-700 active:bg-gray-100 disabled:opacity-40"
        >
          0
        </button>
        <button
          type="button"
          onClick={() => {
            onChange(targetQuantity)
            setInputText(null)
            setError(null)
          }}
          disabled={disabled}
          className="min-h-11 flex-1 rounded-lg border border-green-300 bg-green-50 text-sm font-semibold text-green-800 active:bg-green-100 disabled:opacity-40"
        >
          Vol ({formatQuantity(targetQuantity)})
        </button>
        {onClear && isCounted && (
          <button
            type="button"
            onClick={() => {
              onClear()
              setInputText(null)
              setError(null)
            }}
            disabled={disabled}
            className="min-h-11 rounded-lg border border-gray-300 bg-white px-3 text-sm font-medium text-gray-600 active:bg-gray-100 disabled:opacity-40"
          >
            Wissen
          </button>
        )}
      </div>
    </div>
  )
}
