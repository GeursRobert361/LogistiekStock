'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { collectLeftoverSignals, type LeftoverSource } from '@/domain/analytics/leftover'
import { formatQuantity, fromQuarterUnits } from '@/lib/quarterUnits'
import { kioskTitle } from '@/lib/kiosk'
import type { Kiosk, Product } from '@/types'

interface LeftoverSignalsProps {
  sources: LeftoverSource[]
  /**
   * Zonder vorig evenement zegt een restant niets: er stond nog nooit iets.
   * De component toont zichzelf dan helemaal niet.
   */
  hasPreviousEvent: boolean
  productById: Map<string, Product>
  kioskById: Map<string, Kiosk>
}

/**
 * Normen die te laag lijken, op de plek waar de telling wordt nagekeken.
 *
 * Bewust niet in het telscherm: de teller kan geen normen aanpassen, en de
 * waarde wordt daar tijdens het typen gelezen — wie 15 intikt gaat langs 1, en
 * dan zou de waarschuwing bij elk product opflitsen.
 */
export function LeftoverSignals({
  sources,
  hasPreviousEvent,
  productById,
  kioskById,
}: LeftoverSignalsProps) {
  const signals = collectLeftoverSignals(sources, { hasPreviousEvent })
  if (signals.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Normen die te laag lijken</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-ink-muted">
          Hier stond bijna niets meer toen er geteld werd. Dat kan betekenen dat de kiosk tijdens
          het vorige evenement is leeggelopen — en dan is er verkoop misgelopen die je nergens
          terugziet.
        </p>

        <ul className="divide-y divide-concrete-deep">
          {signals.map((signal) => {
            const product = productById.get(signal.productId)
            const kiosk = kioskById.get(signal.kioskId)

            return (
              <li
                key={`${signal.kioskId}:${signal.productId}`}
                className="flex items-baseline justify-between gap-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-ink">
                    {product?.name ?? signal.productId}
                  </p>
                  <p className="truncate text-xs text-ink-muted">
                    {kiosk ? kioskTitle(kiosk) : signal.kioskId}
                  </p>
                </div>
                <p className="tabular flex-shrink-0 whitespace-nowrap text-sm">
                  <span className="font-bold text-amber-700">
                    {formatQuantity(fromQuarterUnits(signal.leftoverQuarters))} over
                  </span>
                  <span className="text-ink-muted">
                    {' '}
                    · norm {formatQuantity(fromQuarterUnits(signal.targetQuantityQuarters))}
                  </span>
                </p>
              </li>
            )
          })}
        </ul>

        <p className="text-xs text-ink-faint">
          Alleen normen van 6 verpakkingen of meer. Daaronder is een restant van 3 niet te halen, en
          zou vrijwel elk product hier staan.
        </p>
      </CardContent>
    </Card>
  )
}
