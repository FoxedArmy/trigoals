import { z } from 'zod'
import type { H3Event } from 'h3'
import { stravaConnections } from '../../database/schema'
import { exchangeCode, stravaCredentials, STRAVA_SCOPE } from '../../utils/strava'

const querySchema = z.object({
  code: z.string().min(1).optional(),
  state: z.string().min(1).optional(),
  scope: z.string().optional(),
  error: z.string().optional()
})

/** Where to land the athlete, with a short status the page can show. */
function back(event: H3Event, status: string) {
  return sendRedirect(event, `/settings/strava?status=${status}`)
}

export default defineEventHandler(async (event) => {
  const userId = await requireAdmin(event)
  const { code, state, scope, error } = await getValidatedQuery(event, querySchema.parse)

  // Reading also deletes it, so a replayed callback finds nothing to match.
  const expectedState = consumeOAuthState(event)

  if (error) return back(event, 'denied')
  if (!code || !state) return back(event, 'incomplete')
  if (!expectedState || state !== expectedState) return back(event, 'state_mismatch')

  // Strava lets the athlete untick scopes on the consent screen.
  const granted = (scope ?? '').split(',').filter(Boolean)
  if (!granted.includes('activity:read_all')) {
    return back(event, 'scope_missing')
  }

  const creds = stravaCredentials(event)

  let tokens
  try {
    tokens = await exchangeCode(creds, code)
  } catch {
    return back(event, 'exchange_failed')
  }

  const athleteName = [tokens.athlete?.firstname, tokens.athlete?.lastname]
    .filter(Boolean)
    .join(' ')

  const db = await useDb()
  const values = {
    userId,
    athleteId: String(tokens.athlete?.id ?? ''),
    accessToken: encryptToken(tokens.access_token),
    refreshToken: encryptToken(tokens.refresh_token),
    expiresAt: new Date(tokens.expires_at * 1000),
    scope: tokens.scope ?? STRAVA_SCOPE,
    athleteName: athleteName || null
  }

  await db
    .insert(stravaConnections)
    .values(values)
    .onConflictDoUpdate({
      target: stravaConnections.userId,
      set: {
        athleteId: values.athleteId,
        accessToken: values.accessToken,
        refreshToken: values.refreshToken,
        expiresAt: values.expiresAt,
        scope: values.scope,
        athleteName: values.athleteName
      }
    })

  return back(event, 'connected')
})
