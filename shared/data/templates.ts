import type { TemplateWeek } from '../../server/database/schema'

/**
 * Built-in plan templates. These are starting points the athlete adapts —
 * every applied workout becomes a normal, editable planned workout.
 *
 * Day indices: 0 = Monday .. 6 = Sunday.
 */
export interface SystemTemplate {
  id: string
  name: string
  description: string
  focus: 'triathlon' | 'bike' | 'run'
  /** Rough weekly hours, shown so the athlete can pick a fitting load. */
  weeklyHours: string
  weeks: TemplateWeek[]
}

const h = (hours: number) => Math.round(hours * 3600)
const min = (minutes: number) => minutes * 60

export const SYSTEM_TEMPLATES: SystemTemplate[] = [
  {
    id: 'tri-base-4w',
    name: 'Triathlon Grundlage (4 Wochen)',
    description:
      'Klassischer Grundlagenblock mit 3:1-Rhythmus: drei aufbauende Wochen, dann eine Entlastungswoche. Je Sportart 2–3 Einheiten.',
    focus: 'triathlon',
    weeklyHours: '7–9 h',
    weeks: [
      {
        label: 'Base 1',
        workouts: [
          { dayOfWeek: 0, sport: 'swim', title: 'Technik & Grundlage', type: 'endurance', durationSec: min(60), distanceM: 2000, targetZone: 2 },
          { dayOfWeek: 1, sport: 'bike', title: 'Grundlagenausdauer', type: 'endurance', durationSec: h(1.5), targetZone: 2 },
          { dayOfWeek: 2, sport: 'run', title: 'Lockerer Dauerlauf', type: 'endurance', durationSec: min(50), targetZone: 2 },
          { dayOfWeek: 3, sport: 'swim', title: 'Intervalle 100er', type: 'threshold', durationSec: min(60), distanceM: 2200, targetZone: 4 },
          { dayOfWeek: 4, sport: 'strength', title: 'Rumpf & Stabilität', type: 'strength', durationSec: min(40), targetZone: 2 },
          { dayOfWeek: 5, sport: 'bike', title: 'Long Ride', type: 'long', durationSec: h(2.5), targetZone: 2 },
          { dayOfWeek: 6, sport: 'run', title: 'Long Run', type: 'long', durationSec: h(1.25), targetZone: 2 }
        ]
      },
      {
        label: 'Base 2',
        workouts: [
          { dayOfWeek: 0, sport: 'swim', title: 'Technik & Grundlage', type: 'endurance', durationSec: min(60), distanceM: 2200, targetZone: 2 },
          { dayOfWeek: 1, sport: 'bike', title: 'Tempoblöcke 3×10′', type: 'tempo', durationSec: h(1.5), targetZone: 3 },
          { dayOfWeek: 2, sport: 'run', title: 'Lockerer Dauerlauf', type: 'endurance', durationSec: min(55), targetZone: 2 },
          { dayOfWeek: 3, sport: 'swim', title: 'Intervalle 200er', type: 'threshold', durationSec: min(65), distanceM: 2500, targetZone: 4 },
          { dayOfWeek: 4, sport: 'strength', title: 'Rumpf & Stabilität', type: 'strength', durationSec: min(40), targetZone: 2 },
          { dayOfWeek: 5, sport: 'bike', title: 'Long Ride', type: 'long', durationSec: h(3), targetZone: 2 },
          { dayOfWeek: 6, sport: 'run', title: 'Long Run', type: 'long', durationSec: min(85), targetZone: 2 }
        ]
      },
      {
        label: 'Base 3',
        workouts: [
          { dayOfWeek: 0, sport: 'swim', title: 'Technik & Grundlage', type: 'endurance', durationSec: min(60), distanceM: 2400, targetZone: 2 },
          { dayOfWeek: 1, sport: 'bike', title: 'Schwelle 2×20′', type: 'threshold', durationSec: h(1.75), targetZone: 4 },
          { dayOfWeek: 2, sport: 'run', title: 'Tempodauerlauf', type: 'tempo', durationSec: min(60), targetZone: 3 },
          { dayOfWeek: 3, sport: 'swim', title: 'CSS-Set', type: 'threshold', durationSec: min(65), distanceM: 2600, targetZone: 4 },
          { dayOfWeek: 4, sport: 'strength', title: 'Rumpf & Stabilität', type: 'strength', durationSec: min(40), targetZone: 2 },
          { dayOfWeek: 5, sport: 'bike', title: 'Long Ride + Koppellauf', type: 'brick', durationSec: h(3.25), targetZone: 3 },
          { dayOfWeek: 6, sport: 'run', title: 'Long Run', type: 'long', durationSec: min(95), targetZone: 2 }
        ]
      },
      {
        label: 'Entlastung',
        workouts: [
          { dayOfWeek: 0, sport: 'swim', title: 'Locker & Technik', type: 'recovery', durationSec: min(45), distanceM: 1500, targetZone: 1 },
          { dayOfWeek: 2, sport: 'bike', title: 'Regenerative Ausfahrt', type: 'recovery', durationSec: min(60), targetZone: 1 },
          { dayOfWeek: 3, sport: 'run', title: 'Lockerer Dauerlauf', type: 'recovery', durationSec: min(40), targetZone: 1 },
          { dayOfWeek: 5, sport: 'bike', title: 'Grundlage kurz', type: 'endurance', durationSec: h(1.5), targetZone: 2 },
          { dayOfWeek: 6, sport: 'run', title: 'Dauerlauf', type: 'endurance', durationSec: min(60), targetZone: 2 }
        ]
      }
    ]
  },
  {
    id: 'bike-build-3w',
    name: 'Rad Aufbau / FTP (3 Wochen)',
    description:
      'Radlastiger Aufbaublock mit Schwellen- und VO2max-Reizen zur FTP-Steigerung. Zwei harte Einheiten pro Woche plus langer Grundlagenausfahrt.',
    focus: 'bike',
    weeklyHours: '6–8 h',
    weeks: [
      {
        label: 'Build 1',
        workouts: [
          { dayOfWeek: 1, sport: 'bike', title: 'Schwelle 3×12′', type: 'threshold', durationSec: h(1.5), targetZone: 4 },
          { dayOfWeek: 2, sport: 'bike', title: 'Grundlage locker', type: 'endurance', durationSec: h(1.25), targetZone: 2 },
          { dayOfWeek: 3, sport: 'bike', title: 'VO2max 5×4′', type: 'vo2max', durationSec: h(1.25), targetZone: 5 },
          { dayOfWeek: 4, sport: 'strength', title: 'Kraft Beine & Rumpf', type: 'strength', durationSec: min(45), targetZone: 2 },
          { dayOfWeek: 5, sport: 'bike', title: 'Long Ride', type: 'long', durationSec: h(3), targetZone: 2 },
          { dayOfWeek: 6, sport: 'run', title: 'Ausgleichslauf', type: 'endurance', durationSec: min(45), targetZone: 2 }
        ]
      },
      {
        label: 'Build 2',
        workouts: [
          { dayOfWeek: 1, sport: 'bike', title: 'Schwelle 2×20′', type: 'threshold', durationSec: h(1.5), targetZone: 4 },
          { dayOfWeek: 2, sport: 'bike', title: 'Grundlage locker', type: 'endurance', durationSec: h(1.25), targetZone: 2 },
          { dayOfWeek: 3, sport: 'bike', title: 'VO2max 6×3′', type: 'vo2max', durationSec: h(1.25), targetZone: 5 },
          { dayOfWeek: 4, sport: 'strength', title: 'Kraft Beine & Rumpf', type: 'strength', durationSec: min(45), targetZone: 2 },
          { dayOfWeek: 5, sport: 'bike', title: 'Long Ride mit Tempoblöcken', type: 'tempo', durationSec: h(3.5), targetZone: 3 },
          { dayOfWeek: 6, sport: 'run', title: 'Ausgleichslauf', type: 'endurance', durationSec: min(45), targetZone: 2 }
        ]
      },
      {
        label: 'Entlastung',
        workouts: [
          { dayOfWeek: 1, sport: 'bike', title: 'Locker mit Antritten', type: 'recovery', durationSec: min(60), targetZone: 1 },
          { dayOfWeek: 3, sport: 'bike', title: 'Kurze Schwelle 2×8′', type: 'threshold', durationSec: min(60), targetZone: 4 },
          { dayOfWeek: 5, sport: 'bike', title: 'Grundlage', type: 'endurance', durationSec: h(2), targetZone: 2 },
          { dayOfWeek: 6, sport: 'run', title: 'Ausgleichslauf', type: 'recovery', durationSec: min(35), targetZone: 1 }
        ]
      }
    ]
  },
  {
    id: 'run-10k-4w',
    name: 'Laufen 10 km Schärfung (4 Wochen)',
    description:
      'Vier Wochen Richtung 10-km-Wettkampf: Intervalle, Tempodauerlauf, langer Lauf und eine Taper-Woche mit Renntag.',
    focus: 'run',
    weeklyHours: '4–6 h',
    weeks: [
      {
        label: 'Schärfung 1',
        workouts: [
          { dayOfWeek: 1, sport: 'run', title: 'Intervalle 6×1000 m', type: 'interval', durationSec: min(65), distanceM: 12000, targetZone: 5 },
          { dayOfWeek: 2, sport: 'run', title: 'Lockerer Dauerlauf', type: 'recovery', durationSec: min(40), targetZone: 1 },
          { dayOfWeek: 3, sport: 'run', title: 'Tempodauerlauf 20′', type: 'tempo', durationSec: min(55), targetZone: 3 },
          { dayOfWeek: 4, sport: 'strength', title: 'Lauf-ABC & Kraft', type: 'strength', durationSec: min(35), targetZone: 2 },
          { dayOfWeek: 6, sport: 'run', title: 'Long Run', type: 'long', durationSec: min(80), targetZone: 2 }
        ]
      },
      {
        label: 'Schärfung 2',
        workouts: [
          { dayOfWeek: 1, sport: 'run', title: 'Intervalle 5×1200 m', type: 'interval', durationSec: min(70), distanceM: 13000, targetZone: 5 },
          { dayOfWeek: 2, sport: 'run', title: 'Lockerer Dauerlauf', type: 'recovery', durationSec: min(45), targetZone: 1 },
          { dayOfWeek: 3, sport: 'run', title: 'Schwelle 2×15′', type: 'threshold', durationSec: min(60), targetZone: 4 },
          { dayOfWeek: 4, sport: 'strength', title: 'Lauf-ABC & Kraft', type: 'strength', durationSec: min(35), targetZone: 2 },
          { dayOfWeek: 6, sport: 'run', title: 'Long Run', type: 'long', durationSec: min(90), targetZone: 2 }
        ]
      },
      {
        label: 'Schärfung 3',
        workouts: [
          { dayOfWeek: 1, sport: 'run', title: 'Intervalle 8×800 m', type: 'interval', durationSec: min(65), distanceM: 12000, targetZone: 5 },
          { dayOfWeek: 2, sport: 'run', title: 'Lockerer Dauerlauf', type: 'recovery', durationSec: min(40), targetZone: 1 },
          { dayOfWeek: 3, sport: 'run', title: 'Tempodauerlauf 25′', type: 'tempo', durationSec: min(60), targetZone: 3 },
          { dayOfWeek: 6, sport: 'run', title: 'Long Run', type: 'long', durationSec: min(75), targetZone: 2 }
        ]
      },
      {
        label: 'Taper & Wettkampf',
        workouts: [
          { dayOfWeek: 1, sport: 'run', title: 'Kurze Intervalle 5×400 m', type: 'interval', durationSec: min(45), targetZone: 5 },
          { dayOfWeek: 3, sport: 'run', title: 'Locker mit 3 Steigerungen', type: 'recovery', durationSec: min(30), targetZone: 1 },
          { dayOfWeek: 5, sport: 'run', title: 'Einlaufen 20′', type: 'recovery', durationSec: min(20), targetZone: 1 },
          { dayOfWeek: 6, sport: 'run', title: 'Wettkampf 10 km', type: 'race', durationSec: min(45), distanceM: 10000, targetZone: 4 }
        ]
      }
    ]
  }
]

export function findSystemTemplate(id: string): SystemTemplate | undefined {
  return SYSTEM_TEMPLATES.find(t => t.id === id)
}
