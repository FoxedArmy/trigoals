import { z } from 'zod'
import { and, eq, gte, lte } from 'drizzle-orm'
import { activities, athleteProfiles, plannedWorkouts, races } from '../database/schema'
import type { Sport } from '../database/schema'
import {
  fillDailyLoads,
  buildLoadSeries,
  rampRate,
  monotonyAndStrain
} from '../../shared/utils/load'
import { addDays, today, startOfWeek } from '../../shared/utils/date'
import { weeklyCompliance } from '../../shared/utils/planStatus'
import { activityDate } from '../utils/matching'

const querySchema = z.object({
  /** How many days of history to chart. */
  days: z.coerce.number().int().min(28).max(365).default(90)
})

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const { days } = await getValidatedQuery(event, querySchema.parse)
  const db = await useDb()

  const to = today()
  const from = addDays(to, -(days - 1))

  // Warm-up window before `from` so Fitness/Fatigue don't start at zero.
  const WARMUP_DAYS = 42
  const seriesFrom = addDays(from, -WARMUP_DAYS)

  const [acts, plans, upcomingRaces, profile, anyPlan, anyActivity] = await Promise.all([
    db.query.activities.findMany({
      where: and(
        eq(activities.userId, userId),
        gte(activities.startTime, new Date(`${seriesFrom}T00:00:00`)),
        lte(activities.startTime, new Date(`${to}T23:59:59`))
      ),
      with: { match: true }
    }),
    db.query.plannedWorkouts.findMany({
      where: and(
        eq(plannedWorkouts.userId, userId),
        gte(plannedWorkouts.date, from),
        lte(plannedWorkouts.date, addDays(to, 28))
      ),
      with: { match: true }
    }),
    db.query.races.findMany({
      where: and(eq(races.userId, userId), gte(races.date, to)),
      orderBy: (r, { asc }) => [asc(r.date)],
      limit: 5
    }),
    db.query.athleteProfiles.findFirst({ where: eq(athleteProfiles.userId, userId) }),
    // Onboarding looks at whether anything exists at all — deliberately not
    // scoped to the chart range, so switching the range can't un-tick a step.
    db.query.plannedWorkouts.findFirst({
      where: eq(plannedWorkouts.userId, userId),
      columns: { id: true }
    }),
    db.query.activities.findFirst({
      where: eq(activities.userId, userId),
      columns: { id: true }
    })
  ])

  /**
   * A profile counts as done once it holds at least one threshold, because that
   * is the point where zones and a meaningful training load become possible.
   */
  const profileReady = Boolean(
    profile
    && (profile.ftp || profile.thresholdPaceRun || profile.css || profile.lthr || profile.maxHr)
  )

  const onboarding = {
    profile: profileReady,
    plan: Boolean(anyPlan),
    activity: Boolean(anyActivity)
  }

  // --- Load series ---------------------------------------------------------
  const daily = fillDailyLoads(
    acts.map(a => ({ date: activityDate(a), load: a.load })),
    seriesFrom,
    to
  )
  const fullSeries = buildLoadSeries(daily)
  // Drop the warm-up so the chart starts where the athlete asked.
  const series = fullSeries.filter(p => p.date >= from)

  const latest = fullSeries[fullSeries.length - 1] ?? null
  const { monotony, strain } = monotonyAndStrain(daily)

  // --- Weekly volume per sport --------------------------------------------
  const weekMap = new Map<string, { week: string, bySport: Record<string, number>, load: number }>()
  for (const a of acts) {
    const date = activityDate(a)
    if (date < from) continue
    const week = startOfWeek(date)
    const entry = weekMap.get(week) ?? { week, bySport: {}, load: 0 }
    entry.bySport[a.sport] = (entry.bySport[a.sport] ?? 0) + a.durationSec
    entry.load += a.load ?? 0
    weekMap.set(week, entry)
  }
  const weeklyVolume = [...weekMap.values()].sort((a, b) => a.week.localeCompare(b.week))

  // --- Time in zone (approximated from each session's average intensity) ---
  // Without per-second streams we attribute a whole session to one zone; good
  // enough to reveal a polarisation problem, and labelled as an estimate.
  const zoneSeconds: Record<number, number> = {}
  for (const a of acts) {
    if (activityDate(a) < from) continue
    const zone = estimateSessionZone(a.load, a.durationSec)
    zoneSeconds[zone] = (zoneSeconds[zone] ?? 0) + a.durationSec
  }

  // --- Compliance ----------------------------------------------------------
  const thisWeekStart = startOfWeek(to)
  const thisWeekPlans = plans.filter(p => p.date >= thisWeekStart && p.date <= addDays(thisWeekStart, 6))

  const complianceByWeek: { week: string, compliance: number | null, planned: number }[] = []
  const planWeeks = new Map<string, typeof plans>()
  for (const p of plans) {
    if (p.date > to) continue
    const week = startOfWeek(p.date)
    planWeeks.set(week, [...(planWeeks.get(week) ?? []), p])
  }
  for (const [week, list] of [...planWeeks.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    complianceByWeek.push({
      week,
      compliance: weeklyCompliance(list, to),
      planned: list.length
    })
  }

  // --- Totals over the window ---------------------------------------------
  const windowActs = acts.filter(a => activityDate(a) >= from)
  const totals = {
    sessions: windowActs.length,
    durationSec: windowActs.reduce((s, a) => s + a.durationSec, 0),
    load: windowActs.reduce((s, a) => s + (a.load ?? 0), 0),
    bySport: {} as Record<string, { durationSec: number, distanceM: number, sessions: number }>
  }
  for (const a of windowActs) {
    const e = totals.bySport[a.sport] ?? { durationSec: 0, distanceM: 0, sessions: 0 }
    e.durationSec += a.durationSec
    e.distanceM += a.distanceM ?? 0
    e.sessions += 1
    totals.bySport[a.sport] = e
  }

  return {
    range: { from, to, days },
    onboarding: {
      ...onboarding,
      complete: onboarding.profile && onboarding.plan && onboarding.activity
    },
    series,
    current: latest
      ? { fitness: latest.fitness, fatigue: latest.fatigue, form: latest.form }
      : { fitness: 0, fatigue: 0, form: 0 },
    rampRate: rampRate(fullSeries),
    monotony,
    strain,
    weeklyVolume,
    zoneSeconds,
    thisWeek: {
      start: thisWeekStart,
      planned: thisWeekPlans.length,
      compliance: weeklyCompliance(thisWeekPlans, to),
      plannedLoad: thisWeekPlans.reduce((s, p) => s + (p.plannedLoad ?? 0), 0)
    },
    complianceByWeek,
    totals,
    races: upcomingRaces.map(r => ({
      id: r.id,
      name: r.name,
      date: r.date,
      sport: r.sport,
      priority: r.priority,
      distanceLabel: r.distanceLabel
    })),
    upcoming: plans
      .filter(p => p.date >= to && !p.match)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 6)
      .map(p => ({
        id: p.id,
        date: p.date,
        sport: p.sport as Sport,
        title: p.title,
        type: p.type,
        plannedDurationSec: p.plannedDurationSec,
        targetZone: p.targetZone
      }))
  }
})

/**
 * Back-computes which zone a session sat in from its load and duration, by
 * inverting `load = hours * IF² * 100`.
 */
function estimateSessionZone(load: number | null, durationSec: number): number {
  if (!load || !durationSec) return 1
  const hours = durationSec / 3600
  const intensity = Math.sqrt(load / (hours * 100))
  if (intensity < 0.63) return 1
  if (intensity < 0.77) return 2
  if (intensity < 0.91) return 3
  if (intensity < 1.05) return 4
  if (intensity < 1.18) return 5
  if (intensity < 1.38) return 6
  return 7
}
