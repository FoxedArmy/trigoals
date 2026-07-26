import type { Sport, WorkoutType } from '../../server/database/schema'

export interface SportMeta {
  value: Sport
  label: string
  icon: string
  /**
   * CSS variable holding this sport's colour. Defined per theme in main.css and
   * drawn from the validated categorical palette, so charts and badges always
   * agree on what a colour means.
   */
  cssVar: string
  /** Distances are shown in these units. */
  distanceUnit: 'km' | 'm'
  paceUnit: '/km' | '/100m'
}

export const SPORTS: Record<Sport, SportMeta> = {
  swim: {
    value: 'swim',
    label: 'Schwimmen',
    icon: 'i-lucide-waves',
    cssVar: '--sport-swim',
    distanceUnit: 'm',
    paceUnit: '/100m'
  },
  bike: {
    value: 'bike',
    label: 'Rad',
    icon: 'i-lucide-bike',
    cssVar: '--sport-bike',
    distanceUnit: 'km',
    paceUnit: '/km'
  },
  run: {
    value: 'run',
    label: 'Laufen',
    icon: 'i-lucide-footprints',
    cssVar: '--sport-run',
    distanceUnit: 'km',
    paceUnit: '/km'
  },
  strength: {
    value: 'strength',
    label: 'Kraft',
    icon: 'i-lucide-dumbbell',
    cssVar: '--sport-strength',
    distanceUnit: 'km',
    paceUnit: '/km'
  },
  other: {
    value: 'other',
    label: 'Sonstiges',
    icon: 'i-lucide-circle-dot',
    cssVar: '--sport-other',
    distanceUnit: 'km',
    paceUnit: '/km'
  }
}

/** `var(--sport-x)` for use in inline styles. */
export function sportColor(sport: Sport): string {
  return `var(${SPORTS[sport].cssVar})`
}

/** Display order used consistently in legends, stacks and summaries. */
export const SPORT_ORDER: Sport[] = ['swim', 'bike', 'run', 'strength', 'other']

export const SPORT_OPTIONS = Object.values(SPORTS).map(s => ({
  label: s.label,
  value: s.value,
  icon: s.icon
}))

export const WORKOUT_TYPES: { value: WorkoutType, label: string, defaultZone: number }[] = [
  { value: 'recovery', label: 'Regeneration', defaultZone: 1 },
  { value: 'endurance', label: 'Grundlagenausdauer', defaultZone: 2 },
  { value: 'tempo', label: 'Tempo', defaultZone: 3 },
  { value: 'threshold', label: 'Schwelle', defaultZone: 4 },
  { value: 'vo2max', label: 'VO2max', defaultZone: 5 },
  { value: 'interval', label: 'Intervalle', defaultZone: 5 },
  { value: 'long', label: 'Long Run/Ride', defaultZone: 2 },
  { value: 'brick', label: 'Koppeltraining', defaultZone: 3 },
  { value: 'race', label: 'Wettkampf', defaultZone: 4 },
  { value: 'strength', label: 'Krafttraining', defaultZone: 2 },
  { value: 'other', label: 'Sonstiges', defaultZone: 2 }
]

export const WORKOUT_TYPE_OPTIONS = WORKOUT_TYPES.map(t => ({ label: t.label, value: t.value }))

export function workoutTypeLabel(type: WorkoutType): string {
  return WORKOUT_TYPES.find(t => t.value === type)?.label ?? type
}

export function defaultZoneForType(type: WorkoutType): number {
  return WORKOUT_TYPES.find(t => t.value === type)?.defaultZone ?? 2
}

/** Formats a distance in metres for display in the sport's preferred unit. */
export function formatDistance(distanceM: number | null | undefined, sport: Sport): string {
  if (distanceM == null) return '–'
  const unit = SPORTS[sport].distanceUnit
  if (unit === 'm') return `${Math.round(distanceM)} m`
  const km = distanceM / 1000
  return `${km.toFixed(km < 10 ? 1 : 0).replace('.', ',')} km`
}
