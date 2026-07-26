import { z } from 'zod'
import { and, eq } from 'drizzle-orm'
import { activities, athleteProfiles, stravaConnections } from '../../database/schema'
import { accessTokenFor, fetchActivities, mapSport } from '../../utils/strava'

const bodySchema = z.object({
  /** How far back to look on a first sync. Later syncs resume from lastSyncAt. */
  days: z.number().int().min(1).max(365).default(30)
})

/**
 * Pulls activities from Strava into the local log and matches them against the
 * plan. Existing Strava activities are skipped by their id, so running this
 * repeatedly is safe.
 */
export default defineEventHandler(async (event) => {
  const userId = await requireAdmin(event)
  const { days } = await readValidatedBody(event, bodySchema.parse)
  const db = await useDb()

  const connection = await db.query.stravaConnections.findFirst({
    where: eq(stravaConnections.userId, userId)
  })
  if (!connection) {
    throw createError({ statusCode: 409, statusMessage: 'Keine Strava-Verbindung' })
  }

  const token = await accessTokenFor(db, event, userId)

  // Resume from the last sync, with a small overlap so an activity uploaded
  // late still gets picked up.
  const OVERLAP_MS = 24 * 60 * 60 * 1000
  const after = connection.lastSyncAt
    ? new Date(connection.lastSyncAt.valueOf() - OVERLAP_MS)
    : new Date(Date.now() - days * 24 * 60 * 60 * 1000)

  const profile = await db.query.athleteProfiles.findFirst({
    where: eq(athleteProfiles.userId, userId)
  })

  let imported = 0
  let skipped = 0
  const MAX_PAGES = 10 // keeps a first sync inside Strava's rate limits
  const seen: string[] = []

  for (let page = 1; page <= MAX_PAGES; page++) {
    const batch = await fetchActivities(token, { after, perPage: 50, page })
    if (!batch.length) break

    for (const a of batch) {
      const stravaActivityId = String(a.id)
      seen.push(stravaActivityId)

      const existing = await db.query.activities.findFirst({
        where: and(
          eq(activities.userId, userId),
          eq(activities.stravaActivityId, stravaActivityId)
        ),
        columns: { id: true }
      })
      if (existing) {
        skipped++
        continue
      }

      const sport = mapSport(a)
      // Moving time reflects the training stimulus better than elapsed time,
      // which includes cafe stops.
      const durationSec = a.moving_time || a.elapsed_time
      const distanceM = a.distance ?? null
      const avgPower = a.weighted_average_watts ?? a.average_watts ?? null

      const avgPaceSecPerKm
        = distanceM && distanceM > 0 ? Math.round(durationSec / (distanceM / 1000)) : null

      const load = computeActivityLoad(
        {
          sport,
          durationSec,
          distanceM,
          avgPower: avgPower ? Math.round(avgPower) : null,
          avgHr: a.average_heartrate ? Math.round(a.average_heartrate) : null
        },
        profile
      )

      const [inserted] = await db
        .insert(activities)
        .values({
          userId,
          source: 'strava',
          stravaActivityId,
          sport,
          name: a.name,
          startTime: new Date(a.start_date),
          durationSec,
          distanceM,
          avgPower: avgPower ? Math.round(avgPower) : null,
          avgHr: a.average_heartrate ? Math.round(a.average_heartrate) : null,
          maxHr: a.max_heartrate ? Math.round(a.max_heartrate) : null,
          avgPaceSecPerKm,
          elevationM: a.total_elevation_gain ?? null,
          load
        })
        .returning()

      if (inserted) {
        await autoMatchActivity(db, userId, inserted)
        imported++
      }
    }

    if (batch.length < 50) break
  }

  await db
    .update(stravaConnections)
    .set({ lastSyncAt: new Date() })
    .where(eq(stravaConnections.userId, userId))

  return { imported, skipped, examined: seen.length, since: after.toISOString() }
})
