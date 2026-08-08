'use client'

import { fromQuarterUnits, formatQuantity } from '@/lib/quarterUnits'
import {
  CONSUMPTION_CONFIDENCE_LABEL,
  type ProductConsumption,
} from '@/domain/analytics/consumption'

interface ConsumptionIssueProps {
  label: string
  unit?: string
  consumption: ProductConsumption
}

/**
 * Eén regel waar geen bruikbaar verbruik uit komt.
 *
 * Stil wegfilteren zou het overzicht schoner maken en tegelijk verbergen dat
 * er iets niet klopt. Bij een voorraadverschil staan de getallen erbij, want
 * dan is meteen te zien wáár het misgaat: meer geteld dan er volgens de vorige
 * telling plus de leveringen kon staan.
 */
export function ConsumptionIssue({ label, unit, consumption }: ConsumptionIssueProps) {
  const isImplausible = consumption.confidence === 'IMPLAUSIBLE'
  const available = fromQuarterUnits(consumption.availableQuarters)
  const after = fromQuarterUnits(consumption.countedAfterQuarters ?? 0)
  const difference = after - available

  return (
    <div
      className={`px-3 py-2 ${isImplausible ? 'bg-amber-50' : 'bg-white'}`}
      data-confidence={consumption.confidence}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="min-w-0 truncate text-sm text-gray-800">{label}</span>
        <span
          className={`whitespace-nowrap text-xs font-semibold ${
            isImplausible ? 'text-amber-900' : 'text-gray-500'
          }`}
        >
          {isImplausible && <span aria-hidden="true">⚠ </span>}
          {CONSUMPTION_CONFIDENCE_LABEL[consumption.confidence]}
        </span>
      </div>

      {isImplausible && (
        <>
          <p className="mt-1 text-xs text-amber-900">
            Er is meer voorraad geteld dan volgens de vorige telling plus de geregistreerde
            leveringen mogelijk was.
          </p>
          <dl className="mt-1 grid grid-cols-2 gap-x-3 text-xs text-gray-700">
            <Detail term="Vorige telling">
              {formatQuantity(fromQuarterUnits(consumption.countedBeforeQuarters))} {unit}
            </Detail>
            <Detail term="Geleverd">
              {consumption.deliveredPackages} {unit}
            </Detail>
            <Detail term="Beschikbaar">
              {formatQuantity(available)} {unit}
            </Detail>
            <Detail term="Volgende telling">
              {formatQuantity(after)} {unit}
            </Detail>
            <Detail term="Verschil">
              <span className="font-semibold text-amber-900">
                {difference > 0 ? '+' : ''}
                {formatQuantity(difference)} {unit}
              </span>
            </Detail>
          </dl>
        </>
      )}
    </div>
  )
}

function Detail({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-gray-600">{term}</dt>
      <dd className="whitespace-nowrap">{children}</dd>
    </div>
  )
}
