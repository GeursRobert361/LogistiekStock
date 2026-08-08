import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/server/auth/session'
import { serverRepositories, type ServerResource } from '@/server/repositories'
import { getMethodRule, CLIENT_ONLY_METHODS } from '@/server/api/methodPermissions'
import { isBusinessRuleError } from '@/server/api/errors'
import { hasPermission } from '@/lib/permissions'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Eén ingang naar de repositories.
 *
 * De client stuurt welke repository en methode hij wil; de server bepaalt of
 * dat mag. Alles wat niet in de rechtentabel staat wordt geweigerd, dus een
 * nieuwe methode is standaard dicht in plaats van standaard open.
 */
interface RpcRequest {
  resource?: unknown
  method?: unknown
  args?: unknown
}

export async function POST(request: Request) {
  let body: RpcRequest
  try {
    body = (await request.json()) as RpcRequest
  } catch {
    return NextResponse.json({ error: 'Ongeldig verzoek.' }, { status: 400 })
  }

  const { resource, method, args } = body
  if (typeof resource !== 'string' || typeof method !== 'string') {
    return NextResponse.json({ error: 'Ongeldig verzoek.' }, { status: 400 })
  }
  if (args !== undefined && !Array.isArray(args)) {
    return NextResponse.json({ error: 'Ongeldige argumenten.' }, { status: 400 })
  }

  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Niet ingelogd.' }, { status: 401 })
  }

  const key = `${resource}.${method}`
  if (CLIENT_ONLY_METHODS.has(key)) {
    return NextResponse.json({ error: 'Deze actie loopt via een eigen endpoint.' }, { status: 400 })
  }

  const rule = getMethodRule(resource, method)
  if (!rule) {
    // Geen regel betekent geweigerd. Wel loggen: dit hoort niet voor te komen
    // en wijst op een methode zonder rechtenregel.
    console.warn(`[api] Geweigerd: geen rechtenregel voor "${key}"`)
    return NextResponse.json({ error: 'Onbekende actie.' }, { status: 403 })
  }
  if (rule !== 'AUTHENTICATED' && !hasPermission(user.roles, rule)) {
    return NextResponse.json({ error: 'Geen toegang tot deze actie.' }, { status: 403 })
  }

  const repository = serverRepositories[resource as ServerResource] as
    | Record<string, unknown>
    | undefined
  const handler = repository?.[method]
  if (typeof handler !== 'function') {
    return NextResponse.json({ error: 'Onbekende actie.' }, { status: 403 })
  }

  try {
    const result: unknown = await (handler as (...a: unknown[]) => Promise<unknown>).apply(
      repository,
      args ?? []
    )
    return NextResponse.json({ data: result ?? null })
  } catch (error) {
    // Een geweigerde bedrijfsregel is geen storing: die melding hoort de
    // gebruiker juist wél te zien, en met een 4xx stopt de outbox met opnieuw
    // proberen.
    if (isBusinessRuleError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    // De melding van de database gaat niet naar de client: die kan
    // tabelnamen en constraints prijsgeven.
    console.error(`[api] "${key}" mislukt.`, error)
    return NextResponse.json({ error: 'De bewerking is mislukt.' }, { status: 500 })
  }
}
