/**
 * Training-load metrics — pure functions, no framework imports.
 *
 * Naming is deliberately generic (Load / Fitness / Fatigue / Form) because
 * TSS/CTL/ATL/TSB are TrainingPeaks trademarks.
 *
 *  Load    — single-session training stress, normalised so that one hour at
 *            threshold intensity = 100 points.
 *  Fitness — exponentially weighted average of daily load over 42 days
 *            (long-term adaptation).
 *  Fatigue — same over 7 days (short-term tiredness).
 *  Form    — Fitness − Fatigue (readiness to perform).
 */

export const FITNESS_TIME_CONSTANT = 42
export const FATIGUE_TIME_CONSTANT = 7

// ---------------------------------------------------------------------------
// Single-session load
// ---------------------------------------------------------------------------

/**
 * Load from an intensity factor: `hours * IF² * 100`.
 * IF = session intensity relative to threshold (1.0 = at threshold).
 */
export function loadFromIntensity(durationSec: number, intensityFactor: number): number {
  if (durationSec <= 0 || intensityFactor <= 0) return 0
  const hours = durationSec / 3600
  return Math.round(hours * intensityFactor * intensityFactor * 100)
}

/** Power-based load (cycling). Uses average power as a proxy for normalised power. */
export function loadFromPower(durationSec: number, avgPower: number, ftp: number): number {
  if (!ftp || ftp <= 0) return 0
  return loadFromIntensity(durationSec, avgPower / ftp)
}

/**
 * Pace-based load (run / swim). Intensity is the *speed* ratio, so a pace
 * faster than threshold (smaller sec/unit) yields IF > 1.
 */
export function loadFromPace(
  durationSec: number,
  avgPaceSecPerUnit: number,
  thresholdPaceSecPerUnit: number
): number {
  if (!avgPaceSecPerUnit || avgPaceSecPerUnit <= 0 || !thresholdPaceSecPerUnit) return 0
  return loadFromIntensity(durationSec, thresholdPaceSecPerUnit / avgPaceSecPerUnit)
}

/**
 * Heart-rate based load (TRIMP, Banister with Morton's exponential weighting).
 * Scaled so that one hour at LTHR ≈ 100 points, making it comparable to the
 * power/pace variants above.
 */
export function loadFromHeartRate(
  durationSec: number,
  avgHr: number,
  opts: { restHr: number, maxHr: number, lthr?: number | null, sex?: 'male' | 'female' }
): number {
  const { restHr, maxHr } = opts
  if (!durationSec || !avgHr || !maxHr || maxHr <= restHr) return 0

  const k = opts.sex === 'female' ? 1.67 : 1.92
  const hrr = (hr: number) => Math.max(0, Math.min(1, (hr - restHr) / (maxHr - restHr)))

  const minutes = durationSec / 60
  const raw = minutes * hrr(avgHr) * 0.64 * Math.exp(k * hrr(avgHr))

  // Normalise against one hour at threshold HR.
  const refHr = opts.lthr ?? restHr + 0.85 * (maxHr - restHr)
  const refRaw = 60 * hrr(refHr) * 0.64 * Math.exp(k * hrr(refHr))
  if (refRaw <= 0) return 0

  return Math.round((raw / refRaw) * 100)
}

/** Typical intensity factor per zone, used to estimate load for planned workouts. */
const ZONE_INTENSITY: Record<number, number> = {
  1: 0.55,
  2: 0.70,
  3: 0.83,
  4: 0.98,
  5: 1.10,
  6: 1.25,
  7: 1.50
}

/** Estimated load for a planned workout from its duration and target zone. */
export function estimatePlannedLoad(durationSec: number, targetZone?: number | null): number {
  const intensity = ZONE_INTENSITY[targetZone ?? 2] ?? ZONE_INTENSITY[2]!
  return loadFromIntensity(durationSec, intensity)
}

// ---------------------------------------------------------------------------
// Time series: Fitness / Fatigue / Form
// ---------------------------------------------------------------------------

export interface DailyLoad {
  /** ISO date, YYYY-MM-DD */
  date: string
  load: number
}

export interface LoadPoint extends DailyLoad {
  fitness: number
  fatigue: number
  form: number
}

/** Exponentially weighted moving average step. */
function ewma(previous: number, today: number, timeConstant: number): number {
  const alpha = 1 - Math.exp(-1 / timeConstant)
  return previous + alpha * (today - previous)
}

/**
 * Builds the Fitness/Fatigue/Form series. Input must be one entry per calendar
 * day (use `fillDailyLoads` first) and sorted ascending.
 *
 * `form` is the *previous* day's Fitness − Fatigue, which is how readiness is
 * conventionally read: it reflects your state going into the day.
 */
export function buildLoadSeries(
  daily: DailyLoad[],
  seed: { fitness?: number, fatigue?: number } = {}
): LoadPoint[] {
  let fitness = seed.fitness ?? 0
  let fatigue = seed.fatigue ?? 0

  return daily.map((d) => {
    const form = fitness - fatigue // state entering the day
    fitness = ewma(fitness, d.load, FITNESS_TIME_CONSTANT)
    fatigue = ewma(fatigue, d.load, FATIGUE_TIME_CONSTANT)
    return {
      date: d.date,
      load: d.load,
      fitness: Math.round(fitness * 10) / 10,
      fatigue: Math.round(fatigue * 10) / 10,
      form: Math.round(form * 10) / 10
    }
  })
}

/** Sums loads per day and inserts zero-load days across the whole range. */
export function fillDailyLoads(
  entries: { date: string, load: number | null }[],
  from: string,
  to: string
): DailyLoad[] {
  const totals = new Map<string, number>()
  for (const e of entries) {
    totals.set(e.date, (totals.get(e.date) ?? 0) + (e.load ?? 0))
  }

  const out: DailyLoad[] = []
  const cursor = new Date(`${from}T00:00:00Z`)
  const end = new Date(`${to}T00:00:00Z`)
  while (cursor <= end) {
    const key = cursor.toISOString().slice(0, 10)
    out.push({ date: key, load: totals.get(key) ?? 0 })
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return out
}

// ---------------------------------------------------------------------------
// Warning signals
// ---------------------------------------------------------------------------

/**
 * Weekly ramp rate: change in Fitness over the last 7 days. Sustained values
 * above ~7 points/week are a common overuse-injury warning threshold.
 */
export function rampRate(series: LoadPoint[]): number | null {
  if (series.length < 8) return null
  const last = series[series.length - 1]!
  const weekAgo = series[series.length - 8]!
  return Math.round((last.fitness - weekAgo.fitness) * 10) / 10
}

/**
 * Foster monotony (mean / SD of daily load over a window) and strain
 * (total load × monotony). High monotony with high strain flags
 * overtraining risk.
 */
export function monotonyAndStrain(
  daily: DailyLoad[],
  windowDays = 7
): { monotony: number | null, strain: number | null } {
  const window = daily.slice(-windowDays)
  if (window.length < windowDays) return { monotony: null, strain: null }

  const loads = window.map(d => d.load)
  const total = loads.reduce((a, b) => a + b, 0)
  const mean = total / loads.length
  const variance = loads.reduce((acc, l) => acc + (l - mean) ** 2, 0) / loads.length
  const sd = Math.sqrt(variance)

  if (sd === 0) {
    // Identical loads every day: monotony is undefined/infinite. Only
    // meaningful if the athlete actually trained.
    return mean > 0 ? { monotony: null, strain: null } : { monotony: 0, strain: 0 }
  }

  const monotony = mean / sd
  return {
    monotony: Math.round(monotony * 100) / 100,
    strain: Math.round(total * monotony)
  }
}
