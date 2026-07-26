import { describe, it, expect } from 'vitest'
import {
  scoreMatch,
  findBestMatch,
  complianceScore,
  statusFromCompliance,
  AUTO_MATCH_THRESHOLD,
  type PlanCandidate,
  type ActualSession
} from '../shared/utils/matching'

const plan = (over: Partial<PlanCandidate> = {}): PlanCandidate => ({
  id: 'p1',
  date: '2026-07-26',
  sport: 'run',
  plannedDurationSec: 3600,
  plannedDistanceM: 12000,
  ...over
})

const actual = (over: Partial<ActualSession> = {}): ActualSession => ({
  date: '2026-07-26',
  sport: 'run',
  durationSec: 3600,
  distanceM: 12000,
  ...over
})

describe('scoreMatch', () => {
  it('scores a perfect match at 100', () => {
    expect(scoreMatch(actual(), plan())).toBe(100)
  })

  it('rejects a different sport outright', () => {
    expect(scoreMatch(actual({ sport: 'bike' }), plan())).toBe(0)
  })

  it('rejects sessions more than a day apart', () => {
    expect(scoreMatch(actual({ date: '2026-07-29' }), plan())).toBe(0)
  })

  it('accepts a neighbouring day but scores it lower', () => {
    const sameDay = scoreMatch(actual(), plan())
    const nextDay = scoreMatch(actual({ date: '2026-07-27' }), plan())
    expect(nextDay).toBeGreaterThan(0)
    expect(nextDay).toBeLessThan(sameDay)
  })

  it('penalises a much shorter session', () => {
    const short = scoreMatch(actual({ durationSec: 900, distanceM: 3000 }), plan())
    expect(short).toBeLessThan(scoreMatch(actual(), plan()))
  })

  it('treats overshooting more kindly than undershooting', () => {
    const over = scoreMatch(actual({ durationSec: 5400, distanceM: 18000 }), plan())
    const under = scoreMatch(actual({ durationSec: 1800, distanceM: 6000 }), plan())
    expect(over).toBeGreaterThan(under)
  })

  it('matches on sport and date when the plan has no targets', () => {
    const bare = plan({ plannedDurationSec: null, plannedDistanceM: null })
    expect(scoreMatch(actual(), bare)).toBeGreaterThanOrEqual(AUTO_MATCH_THRESHOLD)
  })
})

describe('findBestMatch', () => {
  it('returns null when nothing is close enough', () => {
    expect(findBestMatch(actual({ sport: 'swim' }), [plan()])).toBeNull()
  })

  it('picks the closest of several candidates', () => {
    const exact = plan({ id: 'exact', plannedDurationSec: 3600, plannedDistanceM: 12000 })
    const loose = plan({ id: 'loose', plannedDurationSec: 7200, plannedDistanceM: 24000 })
    const best = findBestMatch(actual(), [loose, exact])
    expect(best?.candidate.id).toBe('exact')
  })

  it('prefers the same day over a neighbouring day', () => {
    const sameDay = plan({ id: 'same', date: '2026-07-26' })
    const dayBefore = plan({ id: 'before', date: '2026-07-25' })
    const best = findBestMatch(actual(), [dayBefore, sameDay])
    expect(best?.candidate.id).toBe('same')
  })

  it('honours a custom threshold', () => {
    const weak = actual({ durationSec: 600, distanceM: 2000 })
    expect(findBestMatch(weak, [plan()], 90)).toBeNull()
    expect(findBestMatch(weak, [plan()], 10)).not.toBeNull()
  })
})

describe('complianceScore', () => {
  it('is 100 when the plan was executed exactly', () => {
    expect(complianceScore(actual(), plan())).toBe(100)
  })

  it('is 100 for a plan without measurable targets', () => {
    expect(complianceScore(actual(), plan({ plannedDurationSec: null, plannedDistanceM: null }))).toBe(100)
  })

  it('drops proportionally when the session was cut short', () => {
    const half = complianceScore(actual({ durationSec: 1800, distanceM: 6000 }), plan())
    expect(half).toBe(50)
  })

  it('does not exceed 100 when overshooting', () => {
    const over = complianceScore(actual({ durationSec: 7200, distanceM: 24000 }), plan())
    expect(over).toBeLessThanOrEqual(100)
  })

  it('ignores distance when the activity has none', () => {
    const score = complianceScore(actual({ distanceM: null }), plan())
    expect(score).toBe(100) // duration matched exactly
  })
})

describe('statusFromCompliance', () => {
  it('marks a well-executed session as completed', () => {
    expect(statusFromCompliance(100)).toBe('completed')
    expect(statusFromCompliance(80)).toBe('completed')
  })

  it('marks a shortfall as partial', () => {
    expect(statusFromCompliance(79)).toBe('partial')
    expect(statusFromCompliance(30)).toBe('partial')
  })
})
