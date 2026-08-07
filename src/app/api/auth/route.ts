import { NextResponse } from 'next/server'
import {
  createSession,
  destroySession,
  findProfileByEmail,
  getCurrentUser,
  pruneExpiredSessions,
  verifyPassword,
} from '@/server/auth/session'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** Wie ben ik? Geeft null wanneer er geen geldige sessie is. */
export async function GET() {
  try {
    return NextResponse.json({ data: await getCurrentUser() })
  } catch (error) {
    console.error('[auth] Sessie uitlezen mislukt.', error)
    return NextResponse.json({ data: null })
  }
}

interface LoginBody {
  action?: unknown
  email?: unknown
  password?: unknown
}

export async function POST(request: Request) {
  let body: LoginBody
  try {
    body = (await request.json()) as LoginBody
  } catch {
    return NextResponse.json({ error: 'Ongeldig verzoek.' }, { status: 400 })
  }

  if (body.action === 'logout') {
    await destroySession()
    return NextResponse.json({ data: null })
  }

  const { email, password } = body
  if (typeof email !== 'string' || typeof password !== 'string') {
    return NextResponse.json({ error: 'Vul een e-mailadres en wachtwoord in.' }, { status: 400 })
  }

  try {
    const found = await findProfileByEmail(email)

    // Dezelfde melding of het account nu bestaat of niet: anders is de
    // inlogpagina een manier om te achterhalen wie er werkt.
    const invalid = NextResponse.json(
      { error: 'Ongeldig e-mailadres of wachtwoord' },
      { status: 401 }
    )
    if (!found) return invalid
    if (!(await verifyPassword(password, found.passwordHash))) return invalid

    if (!found.profile.isActive) {
      return NextResponse.json({ error: 'Dit account is gedeactiveerd.' }, { status: 403 })
    }

    await createSession(found.profile.id)
    void pruneExpiredSessions().catch((error: unknown) => {
      console.error('[auth] Opruimen van verlopen sessies mislukt.', error)
    })

    return NextResponse.json({ data: found.profile })
  } catch (error) {
    console.error('[auth] Inloggen mislukt.', error)
    return NextResponse.json({ error: 'Inloggen is mislukt.' }, { status: 500 })
  }
}
