import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { activities, athleteProfiles } from '../../database/schema'

const bodySchema = z.object({
  sport: sportSchema,
  name: z.string().trim().max(160).nullish(),
  /** ISO datetime, e.g. 2026-07-26T07:30 */
  startTime: z.string().min(10),
  durationSec: z.number().int().positive(),
  distanceM: z.number().nonnegative().nullish(),
  avgPower: z.number().int().nonnegative().nullish(),
  avgHr: z.number().int().nonnegative().nullish(),
  maxHr: z.number().int().nonnegative().nullish(),
  elevationM: z.number().nullish(),
  /** Overrides the derived load when the athlete knows better. */
  load: z.number().int().nonnegative().nullish()
})

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const data = await readValidatedBody(event, bodySchema.parse)
  const db = await useDb()

  const startTime = new Date(data.startTime)
  if (Number.isNaN(startTime.valueOf())) {
    throw createError({ statusCode: 400, statusMessage: 'Ungültiger Startzeitpunkt' })
  }

  const profile = await db.query.athleteProfiles.findFirst({
    where: eq(athleteProfiles.userId, userId)
  })

  const avgPaceSecPerKm
    = data.distanceM && data.distanceM > 0
      ? Math.round(data.durationSec / (data.distanceM / 1000))
      : null

  const load
    = data.load
      ?? computeActivityLoad(
        {
          sport: data.sport,
          durationSec: data.durationSec,
          distanceM: data.distanceM,
          avgPower: data.avgPower,
          avgHr: data.avgHr
        },
        profile
      )

  const [activity] = await db
    .insert(activities)
    .values({
      userId,
      source: 'manual',
      sport: data.sport,
      name: data.name ?? null,
      startTime,
      durationSec: data.durationSec,
      distanceM: data.distanceM ?? null,
      avgPower: data.avgPower ?? null,
      avgHr: data.avgHr ?? null,
      maxHr: data.maxHr ?? null,
      avgPaceSecPerKm,
      elevationM: data.elevationM ?? null,
      load
    })
    .returning()

  if (!activity) {
    throw createError({ statusCode: 500, statusMessage: 'Aktivität konnte nicht gespeichert werden' })
  }

  // Try to tie it to a planned workout right away.
  const match = await autoMatchActivity(db, userId, activity)

  return { activity, match }
})
