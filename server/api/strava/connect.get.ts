import {
  STRAVA_AUTHORIZE_URL,
  STRAVA_SCOPE,
  stravaCredentials
} from '../../utils/strava'

/**
 * Starts the OAuth dance. A random `state` is issued and checked on the way
 * back, so a forged callback cannot attach someone else's Strava account to
 * this session.
 */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  if (!hasEncryptionKey()) {
    throw createError({
      statusCode: 503,
      statusMessage: 'Encryption key missing',
      message:
        'NUXT_TOKEN_ENCRYPTION_KEY fehlt (mind. 32 Zeichen). '
        + 'Ohne Schlüssel werden keine Tokens gespeichert.'
    })
  }

  const creds = stravaCredentials(event)
  const state = issueOAuthState(event)

  const redirectUri = new URL('/api/strava/callback', getRequestURL(event)).toString()

  const url = new URL(STRAVA_AUTHORIZE_URL)
  url.searchParams.set('client_id', creds.clientId)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('approval_prompt', 'auto')
  url.searchParams.set('scope', STRAVA_SCOPE)
  url.searchParams.set('state', state)

  return sendRedirect(event, url.toString())
})
