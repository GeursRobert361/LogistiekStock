import { syncService } from './syncService'
import {
  getUnresolvedConflicts,
  markConflictResolved,
  saveCountEntryLocally,
} from '@/lib/db/offlineDb'
import type { CountEntry, SyncConflict } from '@/types'

/**
 * Afhandeling van synchronisatieconflicten.
 *
 * Een conflict ontstaat alleen wanneer een lokale telling nog niet was
 * weggeschreven én de server intussen een andere waarde kreeg. Beide versies
 * blijven bewaard; een planner of admin kiest welke telt.
 */

export type ConflictChoice = 'LOCAL' | 'SERVER'

export interface CountEntryConflict {
  conflict: SyncConflict
  local: CountEntry
  server: CountEntry
}

function isCountEntry(value: unknown): value is CountEntry {
  return (
    typeof value === 'object' &&
    value !== null &&
    'kioskCountId' in value &&
    'productId' in value &&
    'countedQuantityQuarters' in value
  )
}

/** Openstaande conflicten die we kunnen tonen (nu alleen telregels). */
export async function getCountEntryConflicts(): Promise<CountEntryConflict[]> {
  const conflicts = await getUnresolvedConflicts()

  return conflicts
    .filter((conflict) => conflict.entityType === 'countEntry')
    .filter(
      (conflict): conflict is SyncConflict =>
        isCountEntry(conflict.localVersion) && isCountEntry(conflict.serverVersion)
    )
    .map((conflict) => ({
      conflict,
      local: conflict.localVersion as CountEntry,
      server: conflict.serverVersion as CountEntry,
    }))
    .sort((a, b) => b.conflict.detectedAt.localeCompare(a.conflict.detectedAt))
}

/**
 * Legt de keuze vast.
 *
 * Bij LOCAL gaat de lokale telling opnieuw de outbox in, zodat hij de server
 * overschrijft. Bij SERVER wordt de serverwaarde lokaal weggeschreven en
 * vervalt de openstaande mutatie.
 */
export async function resolveConflict(
  item: CountEntryConflict,
  choice: ConflictChoice,
  resolvedBy: string
): Promise<void> {
  const winner = choice === 'LOCAL' ? item.local : item.server

  const entry: CountEntry = {
    ...winner,
    // De winnaar krijgt een verse tijdstempel, anders zou de verliezende
    // versie bij een volgende merge alsnog nieuwer lijken.
    lastModifiedAt: new Date().toISOString(),
    lastModifiedById: resolvedBy,
  }

  await saveCountEntryLocally(entry)
  await syncService.enqueue('countEntry', entry.id, 'update', entry)
  await markConflictResolved(item.conflict.id, resolvedBy)
}
