import { eq } from 'drizzle-orm'
import { stravaConnections } from '../../database/schema'
import { accessTokenFor, deauthorize } from '../../utils/strava'

/**
 * Drops the connection. Already imported activities stay — they are training
 * history, not Strava's property to reclaim. Revoking at Strava is attempted
 * first but never blocks the local cleanup.
 */
export default defineEventHandler(async (event) => {
  const userId = await requireAdmin(event)
  const db = await useDb()

  const connection = await db.query.stravaConnections.findFirst({
    where: eq(stravaConnections.userId, userId),
    columns: { userId: true }
  })
  if (!connection) {
    throw createError({ statusCode: 409, statusMessage: 'Keine Strava-Verbindung' })
  }

  let revokedAtStrava = false
  try {
    const token = await accessTokenFor(db, event, userId)
    await deauthorize(token)
    revokedAtStrava = true
  } catch {
    // Token already dead or Strava unreachable — the local record still goes.
  }

  await db.delete(stravaConnections).where(eq(stravaConnections.userId, userId))

  return { ok: true, revokedAtStrava }
})
