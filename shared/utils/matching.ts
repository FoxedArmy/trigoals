/**
 * Matching actual activities against planned workouts — pure logic.
 *
 * The athlete's reality rarely matches the plan exactly: sessions shift by a
 * day, run long, or get cut short. So matching is deliberately fuzzy and the
 * result carries a compliance score rather than a hard yes/no.
 */

export type MatchStatus = 'completed' | 'partial' | 'missed' | 'unplanned'

export interface PlanCandidate {
  id: string
  date: string // YYYY-MM-DD
  sport: string
  plannedDurationSec: number | null
  plannedDistanceM: number | null
}

export interface ActualSession {
  date: string // YYYY-MM-DD (local calendar day of the activity)
  sport: string
  durationSec: number
  distanceM: number | null
}

/** How many days apart a plan and an activity may be and still match. */
export const MAX_DAY_OFFSET = 1

/** Minimum score required before an automatic match is made. */
export const AUTO_MATCH_THRESHOLD = 50

export interface ScoredCandidate {
  candidate: PlanCandidate
  /** 0–100; higher is a better fit. */
  score: number
}

function dayOffset(a: string, b: string): number {
  const ms = new Date(`${a}T00:00:00Z`).valueOf() - new Date(`${b}T00:00:00Z`).valueOf()
  return Math.abs(Math.round(ms / 86_400_000))
}

/** Ratio-based similarity: 1 when equal, decaying toward 0 as they diverge. */
function similarity(actual: number, planned: number): number {
  if (planned <= 0) return 0
  const ratio = actual / planned
  if (ratio >= 1) return Math.max(0, Math.min(1, 1 / ratio)) // overshoot is mild
  return Math.max(0, ratio) // undershoot is proportional
}

/**
 * Scores one plan/activity pairing. Returns 0 when they cannot match at all
 * (different sport, or too far apart in time).
 */
export function scoreMatch(actual: ActualSession, candidate: PlanCandidate): number {
  if (actual.sport !== candidate.sport) return 0

  const offset = dayOffset(actual.date, candidate.date)
  if (offset > MAX_DAY_OFFSET) return 0

  // Same day is worth much more than a neighbouring day.
  const dateScore = offset === 0 ? 1 : 0.6

  // Compare on whichever metric the plan specified.
  const metrics: number[] = []
  if (candidate.plannedDurationSec) {
    metrics.push(similarity(actual.durationSec, candidate.plannedDurationSec))
  }
  if (candidate.plannedDistanceM && actual.distanceM) {
    metrics.push(similarity(actual.distanceM, candidate.plannedDistanceM))
  }

  // A plan with no targets still matches on sport+date alone.
  const volumeScore = metrics.length
    ? metrics.reduce((a, b) => a + b, 0) / metrics.length
    : 0.75

  return Math.round((0.5 * dateScore + 0.5 * volumeScore) * 100)
}

/** Picks the best-scoring unmatched plan, or null if none is good enough. */
export function findBestMatch(
  actual: ActualSession,
  candidates: PlanCandidate[],
  threshold = AUTO_MATCH_THRESHOLD
): ScoredCandidate | null {
  let best: ScoredCandidate | null = null

  for (const candidate of candidates) {
    const score = scoreMatch(actual, candidate)
    if (score >= threshold && (!best || score > best.score)) {
      best = { candidate, score }
    }
  }

  return best
}

/**
 * Compliance of an activity against the plan it was matched to: how much of the
 * planned session actually happened, 0–100.
 */
export function complianceScore(actual: ActualSession, plan: PlanCandidate): number {
  const parts: number[] = []

  if (plan.plannedDurationSec) {
    parts.push(similarity(actual.durationSec, plan.plannedDurationSec))
  }
  if (plan.plannedDistanceM && actual.distanceM) {
    parts.push(similarity(actual.distanceM, plan.plannedDistanceM))
  }

  // No targets to compare against: doing the session at all counts as done.
  if (!parts.length) return 100

  return Math.round((parts.reduce((a, b) => a + b, 0) / parts.length) * 100)
}

/** Derives the status shown in the UI from a compliance score. */
export function statusFromCompliance(score: number): MatchStatus {
  return score >= 80 ? 'completed' : 'partial'
}
