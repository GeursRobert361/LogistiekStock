import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'
import bcrypt from 'bcryptjs'
import { query, queryOne } from '@/server/db/pool'
import { mapProfile } from '@/server/db/rowMappers'
import { UserRole, type Profile } from '@/types'

/**
 * Sessies met een willekeurig token in een httpOnly-cookie.
 *
 * Bewust geen JWT: een sessie in de database kan ingetrokken worden. Als
 * iemand zijn telefoon verliest, wil je hem er echt uit kunnen gooien in
 * plaats van te wachten tot een token verloopt.
 *
 * In de database staat alleen de hash van het token. Wie de database leest,
 * kan daarmee niet inloggen.
 */

const COOKIE_NAME = 'ls_session'
const SESSION_DAYS = 30
const BCRYPT_ROUNDS = 12

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS)
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

/** Vergelijkt twee tokens zonder de vergelijkingstijd te laten variëren. */
function safeEquals(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}

export interface AuthenticatedUser {
  profile: Profile
  token: string
}

/** Maakt een sessie aan en zet de cookie. */
export async function createSession(profileId: string): Promise<string> {
  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000)

  await query(
    'insert into sessions (token_hash, profile_id, expires_at) values ($1, $2, $3)',
    [hashToken(token), profileId, expiresAt.toISOString()]
  )

  const store = await cookies()
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: expiresAt,
  })

  return token
}

/** Trekt de huidige sessie in en wist de cookie. */
export async function destroySession(): Promise<void> {
  const store = await cookies()
  const token = store.get(COOKIE_NAME)?.value

  if (token) {
    await query('delete from sessions where token_hash = $1', [hashToken(token)])
  }
  store.delete(COOKIE_NAME)
}

/**
 * Leest de huidige gebruiker uit de cookie, of null.
 * Verlopen sessies worden meteen opgeruimd.
 */
export async function getCurrentUser(): Promise<Profile | null> {
  const store = await cookies()
  const token = store.get(COOKIE_NAME)?.value
  if (!token) return null

  const tokenHash = hashToken(token)

  const row = await queryOne<{
    token_hash: string
    expires_at: Date
    id: string
    email: string
    display_name: string
    avatar_url: string | null
    is_active: boolean
    created_at: Date
    updated_at: Date
  }>(
    `select s.token_hash, s.expires_at, p.*
     from sessions s
     join profiles p on p.id = s.profile_id
     where s.token_hash = $1`,
    [tokenHash]
  )

  if (!row) return null
  if (!safeEquals(row.token_hash, tokenHash)) return null

  if (new Date(row.expires_at).getTime() < Date.now()) {
    await query('delete from sessions where token_hash = $1', [tokenHash])
    return null
  }
  if (!row.is_active) return null

  // Zuinig bijhouden wanneer de sessie voor het laatst gebruikt is.
  await query('update sessions set last_seen_at = now() where token_hash = $1', [tokenHash])

  const roles = await loadRoles(row.id)
  return mapProfile(row as unknown as Record<string, unknown>, roles)
}

export async function loadRoles(profileId: string): Promise<UserRole[]> {
  const rows = await query<{ role: string }>(
    'select role from user_roles where profile_id = $1',
    [profileId]
  )
  return rows
    .map((r) => r.role as UserRole)
    .filter((role): role is UserRole => Object.values(UserRole).includes(role))
}

/** Zoekt een profiel op e-mail, inclusief de wachtwoordhash. */
export async function findProfileByEmail(
  email: string
): Promise<{ profile: Profile; passwordHash: string } | null> {
  const row = await queryOne<Record<string, unknown> & { password_hash: string }>(
    'select * from profiles where lower(email) = lower($1)',
    [email]
  )
  if (!row) return null

  const roles = await loadRoles(String(row.id))
  return { profile: mapProfile(row, roles), passwordHash: row.password_hash }
}

/** Ruimt verlopen sessies op. Wordt bij het inloggen meegenomen. */
export async function pruneExpiredSessions(): Promise<void> {
  await query('delete from sessions where expires_at < now()')
}
