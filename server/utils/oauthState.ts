import { randomBytes } from 'node:crypto'
import type { H3Event } from 'h3'

/**
 * Single-use CSRF token for the Strava OAuth round trip.
 *
 * Kept in its own short-lived cookie rather than in the user session: the value
 * is transient, and an explicit `deleteCookie` gives a reliable "consume once"
 * guarantee. (Session writes go through defu, which merges rather than removes.)
 *
 * `sameSite: 'lax'` is required — the cookie has to survive Strava redirecting
 * the browser back to us, which is a cross-site navigation.
 */
const COOKIE_NAME = 'strava_oauth_state'
const COOKIE_PATH = '/api/strava'
const MAX_AGE_SEC = 10 * 60

export function issueOAuthState(event: H3Event): string {
  const state = randomBytes(16).toString('base64url')
  setCookie(event, COOKIE_NAME, state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: !import.meta.dev,
    path: COOKIE_PATH,
    maxAge: MAX_AGE_SEC
  })
  return state
}

/** Reads the expected state and deletes it, so it cannot be replayed. */
export function consumeOAuthState(event: H3Event): string | undefined {
  const state = getCookie(event, COOKIE_NAME)
  deleteCookie(event, COOKIE_NAME, { path: COOKIE_PATH })
  return state
}
