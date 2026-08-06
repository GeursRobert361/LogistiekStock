import { Badge } from '@/components/ui/Badge'
import { EventStatus } from '@/types'

const STATUS_CONFIG: Record<EventStatus, { label: string; variant: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'arena' }> = {
  [EventStatus.DRAFT]: { label: 'Concept', variant: 'default' },
  [EventStatus.READY_FOR_COUNTING]: { label: 'Klaar voor tellen', variant: 'info' },
  [EventStatus.COUNTING]: { label: 'Bezig met tellen', variant: 'warning' },
  [EventStatus.COUNT_REVIEW]: { label: 'Controle telling', variant: 'warning' },
  [EventStatus.READY_FOR_RESTOCK]: { label: 'Klaar voor vullen', variant: 'info' },
  [EventStatus.RESTOCKING]: { label: 'Bezig met vullen', variant: 'warning' },
  [EventStatus.COMPLETED]: { label: 'Afgerond', variant: 'success' },
  [EventStatus.ARCHIVED]: { label: 'Gearchiveerd', variant: 'default' },
}

export function EventStatusBadge({ status }: { status: EventStatus }) {
  const config = STATUS_CONFIG[status]
  return <Badge variant={config.variant}>{config.label}</Badge>
}
