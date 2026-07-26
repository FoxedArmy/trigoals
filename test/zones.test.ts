import { describe, it, expect } from 'vitest'
import {
  powerZones,
  hrZones,
  runPaceZones,
  swimPaceZones,
  formatPace,
  formatDuration,
  parsePace
} from '../shared/utils/zones'

describe('powerZones', () => {
  const z = powerZones(250)

  it('returns 7 Coggan zones', () => {
    expect(z).toHaveLength(7)
  })

  it('places FTP (250 W) inside the threshold zone (Z4)', () => {
    const z4 = z[3]!
    expect(z4.name).toBe('Schwelle')
    expect(250).toBeGreaterThanOrEqual(z4.min!)
    expect(250).toBeLessThanOrEqual(z4.max!)
  })

  it('has an open-ended top zone', () => {
    expect(z[6]!.max).toBeNull()
  })

  it('scales linearly with FTP', () => {
    expect(powerZones(300)[3]!.min).toBe(Math.round(300 * 0.91))
  })
})

describe('hrZones', () => {
  it('uses LTHR when provided', () => {
    const z = hrZones({ lthr: 170 })
    expect(z).toHaveLength(5)
    expect(z[4]!.name).toBe('VO2max')
    expect(z[4]!.min).toBe(170) // 100% LTHR
    expect(z[4]!.max).toBeNull()
  })

  it('falls back to max HR', () => {
    const z = hrZones({ maxHr: 190 })
    expect(z[0]!.min).toBe(Math.round(190 * 0.5))
  })

  it('prefers LTHR over max HR', () => {
    const z = hrZones({ lthr: 170, maxHr: 190 })
    expect(z[4]!.min).toBe(170)
  })

  it('returns empty array without inputs', () => {
    expect(hrZones({})).toEqual([])
  })
})

describe('runPaceZones', () => {
  // Threshold pace 4:00/km = 240 s/km
  const z = runPaceZones(240)

  it('returns 5 zones', () => {
    expect(z).toHaveLength(5)
  })

  it('threshold zone (Z4) contains the threshold pace', () => {
    const z4 = z[3]!
    expect(z4.name).toBe('Schwelle')
    // fastest bound <= 240 <= slowest bound
    expect(z4.min!).toBeLessThanOrEqual(240)
    expect(z4.max!).toBeGreaterThanOrEqual(240)
  })

  it('easy zone is slower (larger sec/km) than threshold', () => {
    expect(z[0]!.max).toBeNull() // open slow end
    expect(z[0]!.min!).toBeGreaterThan(240)
  })

  it('fastest zone is open-ended and faster than threshold', () => {
    expect(z[4]!.min).toBeNull()
    expect(z[4]!.max!).toBeLessThanOrEqual(240)
  })
})

describe('swimPaceZones', () => {
  // CSS 1:40/100m = 100 s/100m
  const z = swimPaceZones(100)

  it('threshold zone brackets CSS', () => {
    const z4 = z[3]!
    expect(z4.name).toBe('Schwelle')
    expect(z4.min!).toBeLessThanOrEqual(100)
    expect(z4.max!).toBeGreaterThanOrEqual(100)
  })

  it('recovery zone is slower than CSS', () => {
    expect(z[0]!.max).toBeNull()
    expect(z[0]!.min!).toBeGreaterThan(100)
  })
})

describe('formatting', () => {
  it('formats pace', () => {
    expect(formatPace(240)).toBe('4:00/km')
    expect(formatPace(95, '/100m')).toBe('1:35/100m')
    expect(formatPace(null)).toBe('–')
  })

  it('formats duration', () => {
    expect(formatDuration(3661)).toBe('1:01:01')
    expect(formatDuration(90)).toBe('1:30')
  })

  it('round-trips pace parsing', () => {
    expect(parsePace('4:00')).toBe(240)
    expect(parsePace('1:35')).toBe(95)
    expect(parsePace('garbage')).toBeNull()
  })
})
