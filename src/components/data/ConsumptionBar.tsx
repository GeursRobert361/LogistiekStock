import { cn } from '@/lib/utils'

interface ConsumptionBarProps {
  label: string
  /** Kleine regel onder het label, bijvoorbeeld het aantal kiosken. */
  sublabel?: string
  /** Het getal zoals het gelezen moet worden, inclusief eenheid. */
  value: string
  /** Verbruik van deze regel, om de balklengte te bepalen. */
  amount: number
  /** Het hoogste getal in deze lijst; de balk is daar een deel van. */
  max: number
  /** Ingedrukt/uitgeklapt, voor een rij die ook een knop is. */
  isOpen?: boolean
  onClick?: () => void
}

/**
 * Eén staaf in het verbruiksoverzicht.
 *
 * De balk is een hulpmiddel, geen bron: het getal staat er altijd voluit naast,
 * want een lengte lees je niet af op een telefoon in een bediengang. De balk
 * is daarom aria-hidden — een schermlezer krijgt label en getal, en dat is
 * alles wat er staat.
 *
 * Producten hebben verschillende eenheden. Balken zijn dus binnen één lijst te
 * vergelijken, niet tussen twee lijsten; de eenheid staat bij elk getal.
 */
export function ConsumptionBar({
  label,
  sublabel,
  value,
  amount,
  max,
  isOpen,
  onClick,
}: ConsumptionBarProps) {
  const percentage = max > 0 ? Math.max(2, Math.round((amount / max) * 100)) : 0

  const content = (
    <>
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 truncate font-medium text-gray-900">{label}</span>
        <span className="whitespace-nowrap text-base font-bold text-gray-900">{value}</span>
      </div>
      <div aria-hidden="true" className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-gray-200">
        <div className="h-full rounded-full bg-arena-red" style={{ width: `${percentage}%` }} />
      </div>
      {sublabel && <p className="mt-1 text-xs text-gray-600">{sublabel}</p>}
    </>
  )

  if (!onClick) {
    return <div className="px-3 py-2.5">{content}</div>
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={isOpen}
      className={cn('w-full px-3 py-2.5 text-left', isOpen && 'bg-gray-50')}
    >
      {content}
    </button>
  )
}
