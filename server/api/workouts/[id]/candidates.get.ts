import { and, eq, gte, lte, isNull } from 'drizzle-orm'
import { plannedWorkouts, workoutMatches, activities } from '../../../database/schema'
import { addDays } from '../../../../shared/utils/date'
import { scoreMatch } from '../../../../shared/utils/matching'
import { activityDate } from '../../../utils/matching'

/** How far to look for a candidate activity when matching by hand. */
const SEARCH_WINDOW_DAYS = 3

/**
 * Activities that could be linked to this planned workout: not yet matched,
 * within a few days of the plan. Sorted by how well they fit.
 */
export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const id = getRouterParam(event, 'id')!
  const db = await useDb()

  const plan = await db.query.plannedWorkouts.findFirst({
    where: and(eq(plannedWorkouts.id, id), eq(plannedWorkouts.userId, userId))
  })
  if (!plan) {
    throw createError({ statusCode: 404, statusMessage: 'Geplantes Workout nicht gefunden' })
  }

  const rows = await db
    .select({ activity: activities })
    .from(activities)
    .leftJoin(workoutMatches, eq(workoutMatches.activityId, activities.id))
    .where(
      and(
        eq(activities.userId, userId),
        gte(activities.startTime, new Date(`${addDays(plan.date, -SEARCH_WINDOW_DAYS)}T00:00:00`)),
        lte(activities.startTime, new Date(`${addDays(plan.date, SEARCH_WINDOW_DAYS)}T23:59:59`)),
        isNull(workoutMatches.id)
      )
    )

  const candidate = {
    id: plan.id,
    date: plan.date,
    sport: plan.sport,
    plannedDurationSec: plan.plannedDurationSec,
    plannedDistanceM: plan.plannedDistanceM
  }

  return rows
    .map(({ activity }) => ({
      activity,
      score: scoreMatch(
        {
          date: activityDate(activity),
          sport: activity.sport,
          durationSec: activity.durationSec,
          distanceM: activity.distanceM ?? null
        },
        candidate
      )
    }))
    .sort((a, b) => b.score - a.score)
})
