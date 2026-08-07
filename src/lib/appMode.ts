/**
 * App-modus.
 *
 * `demo`       — alles in de browser: localStorage als gesimuleerde server en
 *                IndexedDB als offline-opslag. Per apparaat, dus niet gedeeld.
 * `production` — eigen Postgres op de server, benaderd via /api/rpc.
 *
 * Gestuurd door NEXT_PUBLIC_APP_MODE. Let op: die waarde wordt tijdens het
 * bouwen in de browserbundle ingebakken, niet op runtime gelezen. Na wijzigen
 * is een herbouw nodig, geen herstart.
 */

export type AppMode = 'demo' | 'production'

export function getAppMode(): AppMode {
  const configured = (process.env.NEXT_PUBLIC_APP_MODE ?? 'demo').trim().toLowerCase()
  return configured === 'production' ? 'production' : 'demo'
}

export function isDemoMode(): boolean {
  return getAppMode() === 'demo'
}
