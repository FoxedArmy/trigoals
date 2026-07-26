import { timingSafeEqual, createHash } from 'node:crypto'
import type { H3Event } from 'h3'
import { eq } from 'drizzle-orm'
import { users } from '../database/schema'

/**
 * Operator-only access. The session carries an `isAdmin` hint for the UI, but
 * every guarded request re-reads the database so revoking the flag takes effect
 * immediately instead of lingering until the session expires.
 */
export async function requireAdmin(event: H3Event): Promise<string> {
  const userId = await requireUserId(event)
  const db = await useDb()

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { isAdmin: true }
  })

  if (!user?.isAdmin) {
    // 404 rather than 403: an unprivileged caller learns nothing about what
    // exists behind the gate.
    throw createError({ statusCode: 404, statusMessage: 'Nicht gefunden' })
  }

  return userId
}

export async function isAdminUser(event: H3Event): Promise<boolean> {
  const session = await getUserSession(event)
  const userId = session.user?.id
  if (!userId) return false

  const db = await useDb()
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { isAdmin: true }
  })
  return Boolean(user?.isAdmin)
}

// ---------------------------------------------------------------------------
// Unlock password
// ---------------------------------------------------------------------------

/** Configured admin password, or null when the feature is switched off. */
export function adminPasswordConfigured(): boolean {
  const p = process.env.NUXT_ADMIN_UNLOCK_PASSWORD
  return Boolean(p && p.length >= 12)
}

/**
 * Constant-time comparison over SHA-256 digests, so both operands are the same
 * length and the duration reveals nothing about the expected password.
 */
export function verifyAdminPassword(candidate: string): boolean {
  const expected = process.env.NUXT_ADMIN_UNLOCK_PASSWORD
  // An unset or too-short password must never be satisfiable — otherwise a
  // forgotten env var would leave the gate wide open.
  if (!expected || expected.length < 12) return false

  const a = createHash('sha256').update(candidate).digest()
  const b = createHash('sha256').update(expected).digest()
  return timingSafeEqual(a, b)
}

// ---------------------------------------------------------------------------
// Attempt throttling
// ---------------------------------------------------------------------------

const MAX_ATTEMPTS = 5
const WINDOW_MS = 15 * 60 * 1000

interface Attempts { count: number, firstAt: number }
const g = globalThis as unknown as { __trigoalsUnlockAttempts?: Map<string, Attempts> }
const attempts = (g.__trigoalsUnlockAttempts ??= new Map())

/**
 * Throttles unlock attempts per caller. In-memory, so it resets on redeploy and
 * is per-instance — enough to stop online guessing of a long password, and the
 * reason the password itself must be long rather than memorable.
 */
export function checkUnlockThrottle(eventKey: string): void {
  const now = Date.now()
  const entry = attempts.get(eventKey)

  if (!entry || now - entry.firstAt > WINDOW_MS) {
    attempts.set(eventKey, { count: 1, firstAt: now })
    return
  }

  entry.count += 1
  if (entry.count > MAX_ATTEMPTS) {
    const retryInMin = Math.ceil((WINDOW_MS - (now - entry.firstAt)) / 60_000)
    throw createError({
      statusCode: 429,
      statusMessage: `Zu viele Versuche. Bitte in ${retryInMin} Minuten erneut probieren.`
    })
  }
}

export function clearUnlockThrottle(eventKey: string): void {
  attempts.delete(eventKey)
}
