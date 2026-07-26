import { z } from 'zod'
import { plannedWorkouts } from '../../database/schema'
import { estimatePlannedLoad } from '../../../shared/utils/load'

const bodySchema = z.object({
  date: isoDate,
  sport: sportSchema,
  title: z.string().trim().min(1).max(120),
  type: workoutTypeSchema.default('endurance'),
  plannedDurationSec: z.number().int().positive().nullish(),
  plannedDistanceM: z.number().positive().nullish(),
  targetZone: zoneSchema.nullish(),
  plannedLoad: z.number().int().nonnegative().nullish(),
  raceId: z.string().nullish(),
  notes: z.string().max(2000).nullish()
})

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const data = await readValidatedBody(event, bodySchema.parse)
  const db = await useDb()

  // Derive load from duration + zone when the athlete didn't set it explicitly.
  const plannedLoad
    = data.plannedLoad
      ?? (data.plannedDurationSec
        ? estimatePlannedLoad(data.plannedDurationSec, data.targetZone)
        : null)

  const [workout] = await db
    .insert(plannedWorkouts)
    .values({ ...data, plannedLoad, userId })
    .returning()

  return workout
})
