/**
 * Pure training-zone calculations. No framework imports — usable from the Vue
 * app, the Nitro server and unit tests alike.
 *
 * Models used (widely accepted, trademark-free):
 *  - Cycling power: Coggan 7-zone model (% of FTP)
 *  - Heart rate:    5-zone model on % of LTHR (fallback: % of max HR)
 *  - Run pace:      5 zones on % of threshold speed
 *  - Swim pace:     5 zones as offsets from CSS (critical swim speed)
 */

export interface Zone {
  zone: number
  name: string
  /** Lower bound (inclusive). watts / bpm for power+HR; sec/km|/100m for pace. null = open. */
  min: number | null
  /** Upper bound. For pace this is the SLOWER (larger) value. null = open. */
  max: number | null
}

const round = (n: number) => Math.round(n)

// ---------------------------------------------------------------------------
// Cycling power (watts) from FTP
// ---------------------------------------------------------------------------
const POWER_MODEL: { name: string, lo: number, hi: number | null }[] = [
  { name: 'Aktive Erholung', lo: 0, hi: 0.55 },
  { name: 'Grundlagenausdauer', lo: 0.56, hi: 0.75 },
  { name: 'Tempo', lo: 0.76, hi: 0.90 },
  { name: 'Schwelle', lo: 0.91, hi: 1.05 },
  { name: 'VO2max', lo: 1.06, hi: 1.20 },
  { name: 'Anaerob', lo: 1.21, hi: 1.50 },
  { name: 'Neuromuskulär', lo: 1.51, hi: null }
]

export function powerZones(ftp: number): Zone[] {
  return POWER_MODEL.map((z, i) => ({
    zone: i + 1,
    name: z.name,
    min: round(ftp * z.lo),
    max: z.hi === null ? null : round(ftp * z.hi)
  }))
}

// ---------------------------------------------------------------------------
// Heart-rate zones (bpm)
// ---------------------------------------------------------------------------
const LTHR_MODEL: { name: string, lo: number, hi: number | null }[] = [
  { name: 'Erholung', lo: 0, hi: 0.80 },
  { name: 'Aerob', lo: 0.81, hi: 0.89 },
  { name: 'Tempo', lo: 0.90, hi: 0.93 },
  { name: 'Schwelle', lo: 0.94, hi: 0.99 },
  { name: 'VO2max', lo: 1.00, hi: null }
]

const MAXHR_MODEL: { name: string, lo: number, hi: number | null }[] = [
  { name: 'Erholung', lo: 0.50, hi: 0.60 },
  { name: 'Aerob', lo: 0.60, hi: 0.70 },
  { name: 'Tempo', lo: 0.70, hi: 0.80 },
  { name: 'Schwelle', lo: 0.80, hi: 0.90 },
  { name: 'VO2max', lo: 0.90, hi: null }
]

/** Prefers LTHR; falls back to % of max HR. Returns [] if neither is given. */
export function hrZones(opts: { lthr?: number | null, maxHr?: number | null }): Zone[] {
  if (opts.lthr) {
    const l = opts.lthr
    return LTHR_MODEL.map((z, i) => ({
      zone: i + 1,
      name: z.name,
      min: round(l * z.lo),
      max: z.hi === null ? null : round(l * z.hi)
    }))
  }
  if (opts.maxHr) {
    const m = opts.maxHr
    return MAXHR_MODEL.map((z, i) => ({
      zone: i + 1,
      name: z.name,
      min: round(m * z.lo),
      max: z.hi === null ? null : round(m * z.hi)
    }))
  }
  return []
}

// ---------------------------------------------------------------------------
// Run pace zones (sec / km) from threshold pace
// Boundaries are fractions of threshold *speed*; pace = thresholdPace / factor.
// ---------------------------------------------------------------------------
const RUN_SPEED_BOUNDS = [0.78, 0.87, 0.94, 1.0] // upper speed-fraction of Z1..Z4
const RUN_NAMES = ['Regeneration', 'Grundlagenausdauer', 'Tempo', 'Schwelle', 'VO2max']

export function runPaceZones(thresholdPaceSecPerKm: number): Zone[] {
  const t = thresholdPaceSecPerKm
  // Convert speed fractions to pace bounds. Faster speed => smaller sec/km.
  // Zone i spans speed [bounds[i-1], bounds[i]] => pace [t/bounds[i], t/bounds[i-1]].
  const speed = [0, ...RUN_SPEED_BOUNDS, Infinity]
  return RUN_NAMES.map((name, i) => {
    const loSpeed = speed[i]!
    const hiSpeed = speed[i + 1]!
    // min pace (fastest) corresponds to hiSpeed; max pace (slowest) to loSpeed
    const min = hiSpeed === Infinity ? null : round(t / hiSpeed)
    const max = loSpeed === 0 ? null : round(t / loSpeed)
    return { zone: i + 1, name, min, max }
  })
}

// ---------------------------------------------------------------------------
// Swim pace zones (sec / 100 m) as offsets from CSS
// ---------------------------------------------------------------------------
const SWIM_OFFSETS: { name: string, fast: number | null, slow: number | null }[] = [
  // Offsets in seconds relative to CSS. `fast` = fastest bound (smaller pace),
  // `slow` = slowest bound (larger pace). null = open-ended.
  { name: 'Regeneration', fast: 6, slow: null }, // slowest zone
  { name: 'Grundlagenausdauer', fast: 3, slow: 6 },
  { name: 'Tempo', fast: 1, slow: 3 },
  { name: 'Schwelle', fast: -1, slow: 1 },
  { name: 'VO2max', fast: null, slow: -1 } // fastest zone
]

export function swimPaceZones(cssSecPer100: number): Zone[] {
  const c = cssSecPer100
  return SWIM_OFFSETS.map((z, i) => ({
    zone: i + 1,
    name: z.name,
    min: z.fast === null ? null : round(c + z.fast), // fastest (smallest) pace
    max: z.slow === null ? null : round(c + z.slow) // slowest (largest) pace
  }))
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------
export function formatPace(secPerUnit: number | null, unit = '/km'): string {
  if (secPerUnit == null || !isFinite(secPerUnit)) return '–'
  const m = Math.floor(secPerUnit / 60)
  const s = Math.round(secPerUnit % 60)
  return `${m}:${s.toString().padStart(2, '0')}${unit}`
}

export function formatDuration(sec: number | null): string {
  if (sec == null) return '–'
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.round(sec % 60)
  return h > 0
    ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    : `${m}:${s.toString().padStart(2, '0')}`
}

/** Parse "m:ss" (pace) into seconds. Returns null on invalid input. */
export function parsePace(value: string): number | null {
  const m = value.trim().match(/^(\d+):(\d{1,2})$/)
  if (!m) return null
  return Number(m[1]) * 60 + Number(m[2])
}
