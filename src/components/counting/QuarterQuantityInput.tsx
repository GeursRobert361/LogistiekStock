'use client'

import { useState, useCallback, useId } from 'react'
import { cn } from '@/lib/utils'
import {
  toQuarterUnits,
  fromQuarterUnits,
  formatQuantity,
  parseQuantity,
  isValidQuantity,
} from '@/lib/quarterUnits'

interface QuarterQuantityInputProps {
  /** Current value in packages (e.g. 4.5) */
  value: number
  /** Called with new value in packages */
  onChange: (value: number) => void
  /** Step size: 1 | 0.5 | 0.25 */
  step?: 1 | 0.5 | 0.25
  /** Target quantity for the "Vol" button */
  targetQuantity: number
  /** Minimum allowed value (default 0) */
  min?: number
  label?: string
  disabled?: boolean
  className?: string
}

export function QuarterQuantityInput({
  value,
  onChange,
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

  const displayValue = inputText !== null ? inputText : formatQuantity(value)

  function clamp(v: number): number {
    return Math.max(min, v)
  }

  const adjust = useCallback(
    (delta: number) => {
      const deltaQU = Math.round(delta * 4)
      const currentQU = toQuarterUnits(value)
      const newQU = Math.max(Math.round(min * 4), currentQU + deltaQU)
      onChange(fromQuarterUnits(newQU))
      setInputText(null)
      setError(null)
    },
    [value, min, onChange]
  )

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    setInputText(e.target.value)
    setError(null)
  }

  function handleInputBlur() {
    if (inputText === null) return
    try {
      const parsed = parseQuantity(inputText)
      if (!isValidQuantity(parsed)) {
        setError('Gebruik stappen van 0,25 (bijv. 4 of 4,5)')
        return
      }
      onChange(clamp(parsed))
      setInputText(null)
      setError(null)
    } catch {
      setError('Ongeldige waarde')
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      handleInputBlur()
    }
  }

  function setZero() {
    onChange(0)
    setInputText(null)
    setError(null)
  }

  function setFull() {
    onChange(targetQuantity)
    setInputText(null)
    setError(null)
  }

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-gray-700">
          {label}
        </label>
      )}

      <div className="flex items-center gap-2">
        {/* Minus */}
        <button
          type="button"
          onClick={() => adjust(-step)}
          disabled={disabled || value <= min}
          aria-label={`Verminder met ${formatQuantity(step)}`}
          className={cn(
            'flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl text-xl font-bold transition-colors',
            'border border-gray-300 bg-white text-gray-700',
            'hover:bg-gray-100 active:bg-gray-200',
            'disabled:opacity-40'
          )}
        >
          −
        </button>

        {/* Numeric input */}
        <div className="flex-1">
          <input
            id={inputId}
            type="text"
            inputMode="decimal"
            value={displayValue}
            onChange={handleInputChange}
            onBlur={handleInputBlur}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            aria-invalid={error != null}
            aria-describedby={error ? `${inputId}-error` : undefined}
            className={cn(
              'h-12 w-full rounded-xl border text-center text-xl font-bold transition-colors',
              'focus:outline-none focus:ring-2 focus:ring-arena-red/30 focus:border-arena-red',
              error ? 'border-red-400 bg-red-50' : 'border-gray-300 bg-white',
              'disabled:opacity-50'
            )}
          />
        </div>

        {/* Plus */}
        <button
          type="button"
          onClick={() => adjust(step)}
          disabled={disabled}
          aria-label={`Verhoog met ${formatQuantity(step)}`}
          className={cn(
            'flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl text-xl font-bold transition-colors',
            'border border-gray-300 bg-white text-gray-700',
            'hover:bg-gray-100 active:bg-gray-200',
            'disabled:opacity-40'
          )}
        >
          +
        </button>
      </div>

      {error && (
        <p id={`${inputId}-error`} role="alert" className="text-xs text-red-600">
          {error}
        </p>
      )}

      {/* Snelknoppen */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={setZero}
          disabled={disabled}
          className="flex-1 rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 active:bg-gray-100 disabled:opacity-40"
        >
          0
        </button>
        <button
          type="button"
          onClick={setFull}
          disabled={disabled}
          className="flex-1 rounded-lg border border-green-300 bg-green-50 py-2 text-sm font-medium text-green-700 hover:bg-green-100 active:bg-green-200 disabled:opacity-40"
        >
          Vol ({formatQuantity(targetQuantity)})
        </button>
      </div>
    </div>
  )
}
