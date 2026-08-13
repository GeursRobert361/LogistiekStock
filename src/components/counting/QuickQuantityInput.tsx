'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { toQuarterUnits, fromQuarterUnits, formatQuantity } from '@/lib/quarterUnits'
import { QuarterQuantityInput } from './QuarterQuantityInput'
import type { QuickCountMode } from '@/lib/counting/quickCountConfig'

/**
 * Tellen met snelknoppen in plaats van een invoerveld.
 *
 * Voor het kleine spul — vuilniszakken, bakjes, post-mixpakken — waar er nul
 * tot een handvol ligt. Eén tik is daar sneller dan een veld openen en typen,
 * en een teller doet dit een paar honderd keer per avond.
 *
 * Dit is nadrukkelijk alleen een andere manier om dezelfde `onChange` aan te
 * roepen. Er zit geen eigen opslag, geen eigen validatie en geen eigen
 * afrondlogica in: wat hier uitkomt gaat door exact dezelfde route als wat de
 * teller met de hand invoert, en het bijvuladvies wordt zoals altijd door
 * `calculateRestockQuantity` bepaald.
 *
 * "Meer…" toont het bestaande `QuarterQuantityInput`. Dat is de uitweg voor
 * alles wat de knoppen niet kunnen: hoge aantallen, kwartverpakkingen,
 * correcties. Zonder die uitweg zou een snelteller een beperking worden in
 * plaats van een versnelling.
 */

interface QuickQuantityInputProps {
  /**
   * Huidige waarde in verpakkingen, of `undefined` wanneer er nog niet geteld
   * is. `undefined` en 0 zijn nadrukkelijk niet hetzelfde: 0 betekent "geteld,
   * er ligt niets".
   */
  value: number | undefined
  /** Nieuwe waarde in verpakkingen. */
  onChange: (value: number) => void
  /** Zet het product terug op "nog niet geteld". */
  onClear?: () => void
  mode: QuickCountMode
  /** Hoogste snelknop. */
  max: number
  /** Norm, voor de Vol-knop en voor het handmatige veld. */
  targetQuantity: number
  /** Stapgrootte van het handmatige veld; komt van het product. */
  step?: 1 | 0.5 | 0.25
  /** "dozen", "pakken", … — voor de voorleesbare labels. */
  packagingUnit?: string
  disabled?: boolean
}

/** Kan de huidige waarde met de knoppen worden uitgedrukt? */
function isExpressible(value: number | undefined, mode: QuickCountMode, max: number): boolean {
  if (value === undefined) return true

  const quarters = toQuarterUnits(value)
  if (quarters < 0) return false

  const maxQuarters = mode === 'HALF' ? max * 4 + 2 : max * 4
  if (quarters > maxQuarters) return false

  // Hele verpakkingen kan altijd; een halve alleen in HALF-modus.
  const fraction = quarters % 4
  if (fraction === 0) return true
  return mode === 'HALF' && fraction === 2
}

export function QuickQuantityInput({
  value,
  onChange,
  onClear,
  mode,
  max,
  targetQuantity,
  step = 1,
  packagingUnit = 'verpakkingen',
  disabled = false,
}: QuickQuantityInputProps) {
  const [manualRequested, setManualRequested] = useState(false)

  const isCounted = value !== undefined
  const quarters = isCounted ? toQuarterUnits(value) : undefined
  const hasHalf = quarters !== undefined && quarters % 4 === 2

  /*
   * Het handmatige veld verschijnt zodra de teller erom vraagt, maar ook
   * vanzelf zodra de knoppen de huidige waarde niet kúnnen tonen — 8,5 dozen
   * of een kwartverpakking uit een eerdere telling. Anders staat er een rij
   * knoppen waarvan er geen enkele aan lijkt te staan, zonder dat te zien is
   * waarom.
   */
  const showManual = manualRequested || !isExpressible(value, mode, max)

  /**
   * De halve verpakking aan- of uitzetten.
   *
   * In kwarteenheden gerekend, zodat 4 + 0,5 nooit 4,499999 wordt. Staat er al
   * een halve, dan haalt de knop hem eraf; dat maakt hem een schakelaar en niet
   * iets wat blijft optellen. Nog niet geteld wordt 0,5 — de teller heeft dan
   * kennelijk een halve doos in handen.
   */
  function toggleHalf() {
    const current = quarters ?? 0
    onChange(fromQuarterUnits(hasHalf ? current - 2 : current + 2))
  }

  const numbers = Array.from({ length: max + 1 }, (_, i) => i)

  /*
   * De Vol-knop is er alleen wanneer de norm buiten de knoppen valt. Ligt hij
   * erbinnen, dan doet die knop hetzelfde als een knop die er al staat, en dat
   * is een extra ding om te lezen zonder dat het iets oplevert.
   */
  const showFullButton = targetQuantity > max

  return (
    <div className="flex flex-col gap-2">
      <div
        className="grid grid-cols-4 gap-2"
        role="group"
        aria-label={`Snel tellen in ${packagingUnit}`}
      >
        {numbers.map((n) => {
          const isSelected = quarters === n * 4
          // Bij 4,5 doet geen enkele hele knop alsof hij precies gekozen is;
          // de 4 krijgt alleen een zachte markering zodat te zien blijft waar
          // de halve bij hoort.
          const isBase = !isSelected && hasHalf && Math.floor(value ?? -1) === n

          return (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              disabled={disabled}
              aria-pressed={isSelected}
              aria-label={`Tel ${n} ${packagingUnit}`}
              className={cn(
                'tabular flex min-h-14 items-center justify-center rounded-xl border text-xl font-bold',
                'active:bg-concrete disabled:opacity-30',
                isSelected
                  ? 'border-2 border-arena-red bg-arena-red/10 text-arena-red'
                  : isBase
                    ? 'border-arena-red/40 bg-arena-red/5 font-semibold text-ink'
                    : 'border-concrete-deep bg-plate text-ink'
              )}
            >
              {n}
            </button>
          )
        })}

        <button
          type="button"
          onClick={() => setManualRequested((open) => !open)}
          disabled={disabled}
          aria-expanded={showManual}
          aria-label={showManual ? 'Handmatige invoer sluiten' : 'Meer invoeren'}
          className={cn(
            'flex min-h-14 items-center justify-center rounded-xl border border-dashed px-1 text-sm font-semibold',
            'border-concrete-deep bg-concrete-light text-ink-muted active:bg-concrete disabled:opacity-30'
          )}
        >
          {showManual ? 'Sluiten' : 'Meer…'}
        </button>
      </div>

      {mode === 'HALF' && (
        <button
          type="button"
          onClick={toggleHalf}
          disabled={disabled}
          aria-pressed={hasHalf}
          aria-label={hasHalf ? 'Halve verpakking weghalen' : 'Halve verpakking toevoegen'}
          className={cn(
            'min-h-11 w-full rounded-lg border text-sm font-semibold active:bg-concrete disabled:opacity-30',
            hasHalf
              ? 'border-2 border-arena-red bg-arena-red/10 text-arena-red'
              : 'border-concrete-deep bg-plate text-ink'
          )}
        >
          + ½
        </button>
      )}

      {/*
        Wat er staat, in woorden. Alleen wanneer de knoppen het niet zelf al
        vertellen — bij 4,5 of 8,5 licht er geen knop op en zou de rij anders
        suggereren dat er nog niets geteld is.
      */}
      {isCounted && quarters !== undefined && quarters % 4 !== 0 && (
        <p className="tabular text-xs font-semibold text-ink" aria-live="polite">
          Geteld: {formatQuantity(value)} {packagingUnit}
        </p>
      )}

      {/*
        Het handmatige veld brengt zijn eigen 0-, Vol- en Wissen-knoppen mee.
        Die hier dan niet nóg een keer tonen: twee identieke knoppen onder
        elkaar is precies het soort ruis waar een teller op moet gaan letten.
      */}
      {!showManual && (showFullButton || (onClear && isCounted)) && (
        <div className="flex gap-2">
          {showFullButton && (
            <button
              type="button"
              onClick={() => onChange(targetQuantity)}
              disabled={disabled}
              className="min-h-11 flex-1 rounded-lg border border-emerald-600/40 bg-plate text-sm font-semibold text-emerald-800 active:bg-emerald-50 disabled:opacity-30"
            >
              Vol ({formatQuantity(targetQuantity)})
            </button>
          )}
          {onClear && isCounted && (
            <button
              type="button"
              onClick={onClear}
              disabled={disabled}
              className="min-h-11 rounded-lg border border-concrete-deep bg-plate px-3 text-sm font-medium text-ink-muted active:bg-concrete disabled:opacity-30"
            >
              Wissen
            </button>
          )}
        </div>
      )}

      {showManual && (
        <QuarterQuantityInput
          value={value}
          onChange={onChange}
          onClear={onClear}
          step={step}
          targetQuantity={targetQuantity}
          disabled={disabled}
        />
      )}
    </div>
  )
}
