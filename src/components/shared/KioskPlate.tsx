import { cn } from '@/lib/utils'

interface KioskPlateProps {
  number: number | string | undefined
  /** Kleine regel erboven, bijvoorbeeld "Stop 4 van 11". */
  eyebrow?: string
  /** Korte statusregel eronder, bijvoorbeeld "Afgerond". */
  status?: string
  size?: 'md' | 'lg'
  className?: string
}

/**
 * Het kiosknummer zoals het in de ArenA aan de wand hangt: donker vlak, smal
 * wit cijfer.
 *
 * Dit is het enige dat een teller of vuller van een afstand hoeft te kunnen
 * lezen — daarom krijgt het alle ruimte en verder niets. Donker in plaats van
 * wit scheelt bovendien licht in de bediengangen.
 */
export function KioskPlate({
  number,
  eyebrow,
  status,
  size = 'lg',
  className,
}: KioskPlateProps) {
  return (
    <div
      className={cn(
        'plate-sign flex flex-col items-center justify-center rounded-xl px-4',
        size === 'lg' ? 'py-2.5' : 'py-2',
        className
      )}
    >
      {eyebrow && (
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-plate/60">
          {eyebrow}
        </span>
      )}
      {/* Het kiosknummer is waar het scherm over gaat, dus een kop. */}
      <h2 className={cn('font-bold leading-none', size === 'lg' ? 'text-6xl' : 'text-4xl')}>
        {number ?? '—'}
      </h2>
      {status && (
        <span className="mt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-plate/70">
          {status}
        </span>
      )}
    </div>
  )
}
