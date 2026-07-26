import type { AthleteProfile, Sport } from '../database/schema'
import {
  loadFromPower,
  loadFromPace,
  loadFromHeartRate,
  loadFromIntensity
} from '../../shared/utils/load'

export interface LoadInputs {
  sport: Sport
  durationSec: number
  distanceM?: number | null
  avgPower?: number | null
  avgHr?: number | null
  avgPaceSecPerKm?: number | null
}

/**
 * Derives a session's training load from whatever data is available, in order
 * of reliability: power → pace → heart rate → a duration-only fallback.
 *
 * Returns null when there isn't enough profile data to judge intensity, so the
 * UI can ask the athlete to fill in their thresholds instead of showing a
 * misleading number.
 */
export function computeActivityLoad(
  input: LoadInputs,
  profile: AthleteProfile | null | undefined
): number | null {
  const { sport, durationSec } = input
  if (!durationSec || durationSec <= 0) return 0

  // 1. Power (cycling only — running power is not modelled here).
  if (sport === 'bike' && input.avgPower && profile?.ftp) {
    return loadFromPower(durationSec, input.avgPower, profile.ftp)
  }

  // 2. Pace, per sport threshold.
  const pace = derivePace(input)
  if (sport === 'run' && pace && profile?.thresholdPaceRun) {
    return loadFromPace(durationSec, pace, profile.thresholdPaceRun)
  }
  if (sport === 'swim' && pace && profile?.css) {
    // Swim pace is per 100 m.
    return loadFromPace(durationSec, pace, profile.css)
  }

  // 3. Heart rate — works for every sport.
  if (input.avgHr && profile?.maxHr && profile?.restHr) {
    return loadFromHeartRate(durationSec, input.avgHr, {
      restHr: profile.restHr,
      maxHr: profile.maxHr,
      lthr: profile.lthr
    })
  }

  // 4. Nothing to judge intensity by: assume a steady endurance effort so the
  //    session still contributes something rather than vanishing from trends.
  return loadFromIntensity(durationSec, 0.7)
}

/** Average pace in sec/km (run/bike) or sec/100 m (swim), if derivable. */
function derivePace(input: LoadInputs): number | null {
  if (input.avgPaceSecPerKm) return input.avgPaceSecPerKm
  if (!input.distanceM || input.distanceM <= 0) return null

  if (input.sport === 'swim') {
    return input.durationSec / (input.distanceM / 100)
  }
  return input.durationSec / (input.distanceM / 1000)
}
