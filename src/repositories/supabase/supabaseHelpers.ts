import type { PostgrestError } from '@supabase/supabase-js'

/**
 * Gooit een leesbare fout bij een mislukte Supabase-query.
 * Nooit stil doorgaan: de aanroeper moet kunnen kiezen tussen tonen en
 * doorschuiven naar de outbox.
 */
export function unwrap<T>(result: { data: T | null; error: PostgrestError | null }): T {
  if (result.error) {
    throw new Error(`[supabase] ${result.error.message}`, { cause: result.error })
  }
  if (result.data === null) {
    throw new Error('[supabase] Geen data ontvangen terwijl dat wel werd verwacht.')
  }
  return result.data
}

export function unwrapList<T>(result: {
  data: T[] | null
  error: PostgrestError | null
}): T[] {
  if (result.error) {
    throw new Error(`[supabase] ${result.error.message}`, { cause: result.error })
  }
  return result.data ?? []
}

/** Voor `.maybeSingle()`: geen rij is een geldig antwoord. */
export function unwrapMaybe<T>(result: {
  data: T | null
  error: PostgrestError | null
}): T | null {
  if (result.error) {
    throw new Error(`[supabase] ${result.error.message}`, { cause: result.error })
  }
  return result.data
}
