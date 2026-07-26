import type { H3Event } from 'h3'
import { eq } from 'drizzle-orm'
import type { Database } from './db'
import { stravaConnections } from '../database/schema'
import type { Sport } from '../database/schema'

/**
 * Strava OAuth and API access.
 *
 * Scope note: `activity:read_all` also covers activities the athlete marked
 * private, which is what makes a training log complete. Tokens live for six
 * hours, so every API call goes through `accessTokenFor`, which refreshes and
 * re-persists when needed.
 */

export const STRAVA_AUTHORIZE_URL = 'https://www.strava.com/oauth/authorize'
const STRAVA_TOKEN_URL = 'https://www.strava.com/oauth/token'
const STRAVA_API = 'https://www.strava.com/api/v3'
export const STRAVA_SCOPE = 'read,activity:read_all'

/** Refresh this many seconds before actual expiry, to avoid racing the clock. */
const REFRESH_MARGIN_SEC = 300

export interface StravaCredentials {
  clientId: string
  clientSecret: string
}

export function stravaCredentials(event: H3Event): StravaCredentials {
  const { strava } = useRuntimeConfig(event)
  if (!strava.clientId || !strava.clientSecret) {
    throw createError({
      statusCode: 503,
      statusMessage: 'Strava not configured',
      message:
        'Strava ist nicht konfiguriert. NUXT_STRAVA_CLIENT_ID und '
        + 'NUXT_STRAVA_CLIENT_SECRET setzen (aus deiner Strava-API-Anwendung).'
    })
  }
  return { clientId: strava.clientId, clientSecret: strava.clientSecret }
}

export function stravaConfigured(event: H3Event): boolean {
  const { strava } = useRuntimeConfig(event)
  return Boolean(strava.clientId && strava.clientSecret)
}

interface TokenResponse {
  access_token: string
  refresh_token: string
  expires_at: number // unix seconds
  scope?: string
  athlete?: { id: number, firstname?: string, lastname?: string }
}

/** Exchanges the one-time authorization code for tokens. */
export async function exchangeCode(
  creds: StravaCredentials,
  code: string
): Promise<TokenResponse> {
  return $fetch<TokenResponse>(STRAVA_TOKEN_URL, {
    method: 'POST',
    body: {
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      code,
      grant_type: 'authorization_code'
    }
  })
}

async function refresh(
  creds: StravaCredentials,
  refreshToken: string
): Promise<TokenResponse> {
  return $fetch<TokenResponse>(STRAVA_TOKEN_URL, {
    method: 'POST',
    body: {
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    }
  })
}

/**
 * Returns a usable access token, refreshing and re-persisting it when it is
 * close to expiry. Throws a 409 when the athlete has no connection, so callers
 * can prompt for one.
 */
export async function accessTokenFor(
  db: Database,
  event: H3Event,
  userId: string
): Promise<string> {
  const connection = await db.query.stravaConnections.findFirst({
    where: eq(stravaConnections.userId, userId)
  })
  if (!connection) {
    throw createError({ statusCode: 409, statusMessage: 'Keine Strava-Verbindung' })
  }

  const expiresInSec = (connection.expiresAt.valueOf() - Date.now()) / 1000
  if (expiresInSec > REFRESH_MARGIN_SEC) {
    return decryptToken(connection.accessToken)
  }

  const creds = stravaCredentials(event)
  let fresh: TokenResponse
  try {
    fresh = await refresh(creds, decryptToken(connection.refreshToken))
  } catch {
    // A rejected refresh token usually means the athlete revoked access.
    throw createError({
      statusCode: 401,
      statusMessage: 'Strava token rejected',
      message: 'Strava-Zugriff abgelaufen oder entzogen. Bitte neu verbinden.'
    })
  }

  await db
    .update(stravaConnections)
    .set({
      accessToken: encryptToken(fresh.access_token),
      refreshToken: encryptToken(fresh.refresh_token),
      expiresAt: new Date(fresh.expires_at * 1000)
    })
    .where(eq(stravaConnections.userId, userId))

  return fresh.access_token
}

// ---------------------------------------------------------------------------
// Activities
// ---------------------------------------------------------------------------

export interface StravaActivity {
  id: number
  name: string
  sport_type?: string
  type?: string
  start_date: string
  elapsed_time: number
  moving_time: number
  distance?: number
  average_watts?: number
  weighted_average_watts?: number
  average_heartrate?: number
  max_heartrate?: number
  total_elevation_gain?: number
  trainer?: boolean
}

/** Lists activities after a given time, newest first, one page at a time. */
export async function fetchActivities(
  accessToken: string,
  opts: { after?: Date, perPage?: number, page?: number } = {}
): Promise<StravaActivity[]> {
  const query: Record<string, string | number> = {
    per_page: opts.perPage ?? 50,
    page: opts.page ?? 1
  }
  if (opts.after) query.after = Math.floor(opts.after.valueOf() / 1000)

  return $fetch<StravaActivity[]>(`${STRAVA_API}/athlete/activities`, {
    query,
    headers: { Authorization: `Bearer ${accessToken}` }
  })
}

/** Tells Strava to drop our access, so disconnecting is honoured on both ends. */
export async function deauthorize(accessToken: string): Promise<void> {
  await $fetch('https://www.strava.com/oauth/deauthorize', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` }
  })
}

/** Maps Strava's `sport_type` onto our own disciplines. */
export function mapSport(activity: StravaActivity): Sport {
  const raw = (activity.sport_type ?? activity.type ?? '').toLowerCase()
  if (raw.includes('swim')) return 'swim'
  if (raw.includes('ride') || raw.includes('bike') || raw.includes('cycl')) return 'bike'
  if (raw.includes('run') || raw.includes('walk') || raw.includes('hike')) return 'run'
  if (raw.includes('weight') || raw.includes('workout') || raw.includes('crossfit')) {
    return 'strength'
  }
  return 'other'
}
