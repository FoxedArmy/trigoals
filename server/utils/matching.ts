import { and, eq, gte, lte, isNull } from 'drizzle-orm'
import type { Database } from './db'
import { plannedWorkouts, workoutMatches, activities } from '../database/schema'
import type { Activity, WorkoutMatch } from '../database/schema'
import {
  findBestMatch,
  complianceScore,
  statusFromCompliance,
  MAX_DAY_OFFSET,
  type PlanCandidate,
  type ActualSession
} from '../../shared/utils/matching'
import { addDays, toISODate } from '../../shared/utils/date'

/** Calendar day of an activity, as a local YYYY-MM-DD string. */
export function activityDate(activity: Pick<Activity, 'startTime'>): string {
  return toISODate(new Date(activity.startTime))
}

function toActual(activity: Activity): ActualSession {
  return {
    date: activityDate(activity),
    sport: activity.sport,
    durationSec: activity.durationSec,
    distanceM: activity.distanceM ?? null
  }
}

/**
 * Finds the best planned workout for an activity and records the match.
 * Plans that already have a match are skipped so two activities can't claim the
 * same session. Returns the created match, or null when nothing fits (the
 * activity stays "unplanned").
 */
export async function autoMatchActivity(
  db: Database,
  userId: string,
  activity: Activity
): Promise<WorkoutMatch | null> {
  const date = activityDate(activity)

  // Candidate plans: same user, within the allowed day window, not yet matched.
  const rows = await db
    .select({
      id: plannedWorkouts.id,
      date: plannedWorkouts.date,
      sport: plannedWorkouts.sport,
      plannedDurationSec: plannedWorkouts.plannedDurationSec,
      plannedDistanceM: plannedWorkouts.plannedDistanceM,
      matchId: workoutMatches.id
    })
    .from(plannedWorkouts)
    .leftJoin(workoutMatches, eq(workoutMatches.plannedWorkoutId, plannedWorkouts.id))
    .where(
      and(
        eq(plannedWorkouts.userId, userId),
        gte(plannedWorkouts.date, addDays(date, -MAX_DAY_OFFSET)),
        lte(plannedWorkouts.date, addDays(date, MAX_DAY_OFFSET)),
        isNull(workoutMatches.id)
      )
    )

  const candidates: PlanCandidate[] = rows.map(r => ({
    id: r.id,
    date: r.date,
    sport: r.sport,
    plannedDurationSec: r.plannedDurationSec,
    plannedDistanceM: r.plannedDistanceM
  }))

  const actual = toActual(activity)
  const best = findBestMatch(actual, candidates)
  if (!best) return null

  const compliance = complianceScore(actual, best.candidate)

  const [match] = await db
    .insert(workoutMatches)
    .values({
      userId,
      plannedWorkoutId: best.candidate.id,
      activityId: activity.id,
      status: statusFromCompliance(compliance),
      complianceScore: compliance,
      autoMatched: true
    })
    .returning()

  return match ?? null
}

/**
 * Links an activity to a plan explicitly, replacing any existing match on
 * either side. Used when the athlete corrects the automatic guess.
 */
export async function linkActivityToPlan(
  db: Database,
  userId: string,
  activityId: string,
  plannedWorkoutId: string
): Promise<WorkoutMatch> {
  const activity = await db.query.activities.findFirst({
    where: and(eq(activities.id, activityId), eq(activities.userId, userId))
  })
  if (!activity) {
    throw createError({ statusCode: 404, statusMessage: 'Aktivität nicht gefunden' })
  }

  const plan = await db.query.plannedWorkouts.findFirst({
    where: and(eq(plannedWorkouts.id, plannedWorkoutId), eq(plannedWorkouts.userId, userId))
  })
  if (!plan) {
    throw createError({ statusCode: 404, statusMessage: 'Geplantes Workout nicht gefunden' })
  }

  // Clear whatever those two were previously attached to.
  await db.delete(workoutMatches).where(eq(workoutMatches.activityId, activityId))
  await db.delete(workoutMatches).where(eq(workoutMatches.plannedWorkoutId, plannedWorkoutId))

  const compliance = complianceScore(toActual(activity), {
    id: plan.id,
    date: plan.date,
    sport: plan.sport,
    plannedDurationSec: plan.plannedDurationSec,
    plannedDistanceM: plan.plannedDistanceM
  })

  const [match] = await db
    .insert(workoutMatches)
    .values({
      userId,
      plannedWorkoutId,
      activityId,
      status: statusFromCompliance(compliance),
      complianceScore: compliance,
      autoMatched: false
    })
    .returning()

  return match!
}
