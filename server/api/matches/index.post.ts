import { z } from 'zod'
import { and, eq } from 'drizzle-orm'
import { plannedWorkouts, workoutMatches } from '../../database/schema'

const bodySchema = z.object({
  plannedWorkoutId: z.string().min(1),
  /**
   * Activity to tie to the plan. Omit to simply tick the session off — useful
   * for sessions that were done but never recorded (pool swims, gym work).
   */
  activityId: z.string().min(1).nullish(),
  /** Explicit status when checking off manually. */
  status: z.enum(['completed', 'partial', 'missed']).optional()
})

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const { plannedWorkoutId, activityId, status } = await readValidatedBody(event, bodySchema.parse)
  const db = await useDb()

  if (activityId) {
    return linkActivityToPlan(db, userId, activityId, plannedWorkoutId)
  }

  // Manual check-off without an activity.
  const plan = await db.query.plannedWorkouts.findFirst({
    where: and(eq(plannedWorkouts.id, plannedWorkoutId), eq(plannedWorkouts.userId, userId))
  })
  if (!plan) {
    throw createError({ statusCode: 404, statusMessage: 'Geplantes Workout nicht gefunden' })
  }

  await db.delete(workoutMatches).where(eq(workoutMatches.plannedWorkoutId, plannedWorkoutId))

  const resolved = status ?? 'completed'
  const [match] = await db
    .insert(workoutMatches)
    .values({
      userId,
      plannedWorkoutId,
      activityId: null,
      status: resolved,
      complianceScore: resolved === 'completed' ? 100 : resolved === 'partial' ? 50 : 0,
      autoMatched: false
    })
    .returning()

  return match
})
