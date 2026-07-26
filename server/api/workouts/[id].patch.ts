import { z } from 'zod'
import { and, eq } from 'drizzle-orm'
import { plannedWorkouts } from '../../database/schema'
import { estimatePlannedLoad } from '../../../shared/utils/load'

const bodySchema = z.object({
  date: isoDate.optional(),
  sport: sportSchema.optional(),
  title: z.string().trim().min(1).max(120).optional(),
  type: workoutTypeSchema.optional(),
  plannedDurationSec: z.number().int().positive().nullish(),
  plannedDistanceM: z.number().positive().nullish(),
  targetZone: zoneSchema.nullish(),
  plannedLoad: z.number().int().nonnegative().nullish(),
  raceId: z.string().nullish(),
  notes: z.string().max(2000).nullish()
})

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const id = getRouterParam(event, 'id')!
  const data = await readValidatedBody(event, bodySchema.parse)
  const db = await useDb()

  const existing = await db.query.plannedWorkouts.findFirst({
    where: and(eq(plannedWorkouts.id, id), eq(plannedWorkouts.userId, userId))
  })
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Workout nicht gefunden' })
  }

  const merged = { ...existing, ...data }
  // Re-estimate load unless the athlete set it explicitly in this request.
  const plannedLoad
    = data.plannedLoad !== undefined
      ? data.plannedLoad
      : merged.plannedDurationSec
        ? estimatePlannedLoad(merged.plannedDurationSec, merged.targetZone)
        : null

  const [workout] = await db
    .update(plannedWorkouts)
    .set({ ...data, plannedLoad })
    .where(and(eq(plannedWorkouts.id, id), eq(plannedWorkouts.userId, userId)))
    .returning()

  return workout
})
