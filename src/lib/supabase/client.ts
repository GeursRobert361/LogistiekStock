import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null = null

/**
 * Browser-Supabase-client (singleton).
 * Wordt uitsluitend door de Supabase-repositories gebruikt; pages en
 * componenten praten met de repository-interfaces.
 */
export function getSupabaseClient(): SupabaseClient {
  if (client) return client

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    throw new Error(
      'Supabase is niet geconfigureerd. Zet NEXT_PUBLIC_SUPABASE_URL en ' +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY, of gebruik NEXT_PUBLIC_APP_MODE=demo.'
    )
  }

  client = createBrowserClient(url, anonKey)
  return client
}
