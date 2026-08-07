/**
 * App-modus: 'demo' (lokale opslag, geen database) of 'production' (Supabase).
 *
 * Gestuurd door NEXT_PUBLIC_APP_MODE. Wanneer productie is gevraagd maar de
 * Supabase-configuratie ontbreekt, valt de app terug op demo-modus met een
 * duidelijke fout in de console — beter dan een witte pagina.
 */

export type AppMode = 'demo' | 'production'

let warnedAboutMissingConfig = false

export function hasSupabaseConfig(): boolean {
  return (
    typeof process.env.NEXT_PUBLIC_SUPABASE_URL === 'string' &&
    process.env.NEXT_PUBLIC_SUPABASE_URL.length > 0 &&
    typeof process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY === 'string' &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.length > 0
  )
}

export function getAppMode(): AppMode {
  const configured = (process.env.NEXT_PUBLIC_APP_MODE ?? 'demo').trim().toLowerCase()
  if (configured !== 'production') return 'demo'

  if (!hasSupabaseConfig()) {
    if (!warnedAboutMissingConfig) {
      warnedAboutMissingConfig = true
      console.error(
        '[appMode] NEXT_PUBLIC_APP_MODE=production, maar NEXT_PUBLIC_SUPABASE_URL / ' +
          'NEXT_PUBLIC_SUPABASE_ANON_KEY ontbreken. De app draait in demo-modus.'
      )
    }
    return 'demo'
  }

  return 'production'
}

export function isDemoMode(): boolean {
  return getAppMode() === 'demo'
}
