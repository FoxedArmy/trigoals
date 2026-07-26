import { describe, it, expect } from 'vitest'
import {
  loadFromIntensity,
  loadFromPower,
  loadFromPace,
  loadFromHeartRate,
  estimatePlannedLoad,
  buildLoadSeries,
  fillDailyLoads,
  rampRate,
  monotonyAndStrain
} from '../shared/utils/load'

describe('loadFromIntensity', () => {
  it('gives 100 for one hour at threshold', () => {
    expect(loadFromIntensity(3600, 1.0)).toBe(100)
  })

  it('scales quadratically with intensity', () => {
    expect(loadFromIntensity(3600, 0.5)).toBe(25)
    expect(loadFromIntensity(3600, 2.0)).toBe(400)
  })

  it('scales linearly with duration', () => {
    expect(loadFromIntensity(1800, 1.0)).toBe(50)
  })

  it('returns 0 for non-positive input', () => {
    expect(loadFromIntensity(0, 1)).toBe(0)
    expect(loadFromIntensity(3600, 0)).toBe(0)
  })
})

describe('loadFromPower', () => {
  it('gives 100 for one hour at FTP', () => {
    expect(loadFromPower(3600, 250, 250)).toBe(100)
  })

  it('is lower for an easy ride', () => {
    expect(loadFromPower(3600, 150, 250)).toBe(36) // (0.6)^2 * 100
  })

  it('returns 0 without FTP', () => {
    expect(loadFromPower(3600, 200, 0)).toBe(0)
  })
})

describe('loadFromPace', () => {
  it('gives 100 for one hour at threshold pace', () => {
    expect(loadFromPace(3600, 240, 240)).toBe(100)
  })

  it('treats a faster pace as higher intensity', () => {
    // 3:30/km run against a 4:00/km threshold => IF > 1
    expect(loadFromPace(3600, 210, 240)).toBeGreaterThan(100)
  })

  it('treats a slower pace as lower intensity', () => {
    expect(loadFromPace(3600, 300, 240)).toBeLessThan(100)
  })
})

describe('loadFromHeartRate', () => {
  const opts = { restHr: 50, maxHr: 190, lthr: 170 }

  it('gives roughly 100 for one hour at LTHR', () => {
    const load = loadFromHeartRate(3600, 170, opts)
    expect(load).toBeGreaterThan(95)
    expect(load).toBeLessThan(105)
  })

  it('is lower for an easy hour', () => {
    expect(loadFromHeartRate(3600, 130, opts)).toBeLessThan(60)
  })

  it('returns 0 with missing data', () => {
    expect(loadFromHeartRate(3600, 0, opts)).toBe(0)
    expect(loadFromHeartRate(3600, 150, { restHr: 50, maxHr: 40 })).toBe(0)
  })
})

describe('estimatePlannedLoad', () => {
  it('gives more load for higher zones at equal duration', () => {
    const z2 = estimatePlannedLoad(3600, 2)
    const z4 = estimatePlannedLoad(3600, 4)
    expect(z4).toBeGreaterThan(z2)
  })

  it('defaults to an endurance intensity without a zone', () => {
    expect(estimatePlannedLoad(3600)).toBe(estimatePlannedLoad(3600, 2))
  })
})

describe('fillDailyLoads', () => {
  it('sums same-day entries and fills gaps with zero', () => {
    const filled = fillDailyLoads(
      [
        { date: '2026-01-01', load: 50 },
        { date: '2026-01-01', load: 30 },
        { date: '2026-01-03', load: 20 }
      ],
      '2026-01-01',
      '2026-01-04'
    )
    expect(filled).toEqual([
      { date: '2026-01-01', load: 80 },
      { date: '2026-01-02', load: 0 },
      { date: '2026-01-03', load: 20 },
      { date: '2026-01-04', load: 0 }
    ])
  })

  it('treats null loads as zero', () => {
    const filled = fillDailyLoads([{ date: '2026-01-01', load: null }], '2026-01-01', '2026-01-01')
    expect(filled[0]!.load).toBe(0)
  })
})

describe('buildLoadSeries', () => {
  it('builds fitness up from zero with steady training', () => {
    const daily = fillDailyLoads(
      Array.from({ length: 30 }, (_, i) => ({
        date: `2026-01-${String(i + 1).padStart(2, '0')}`,
        load: 70
      })),
      '2026-01-01',
      '2026-01-30'
    )
    const series = buildLoadSeries(daily)
    expect(series).toHaveLength(30)
    // Fitness rises monotonically
    expect(series[29]!.fitness).toBeGreaterThan(series[0]!.fitness)
    // Fatigue reacts faster than fitness
    expect(series[29]!.fatigue).toBeGreaterThan(series[29]!.fitness)
    // Which means form is negative while loading
    expect(series[29]!.form).toBeLessThan(0)
  })

  it('recovers form during a rest period (taper)', () => {
    const loading = Array.from({ length: 28 }, (_, i) => ({
      date: `2026-02-${String(i + 1).padStart(2, '0')}`,
      load: 80
    }))
    const rest = Array.from({ length: 10 }, (_, i) => ({
      date: `2026-03-${String(i + 1).padStart(2, '0')}`,
      load: 0
    }))
    const series = buildLoadSeries([...loading, ...rest])
    const lastLoading = series[27]!
    const lastRest = series[series.length - 1]!
    expect(lastRest.form).toBeGreaterThan(lastLoading.form)
    expect(lastRest.fatigue).toBeLessThan(lastLoading.fatigue)
  })

  it('honours seed values', () => {
    const series = buildLoadSeries([{ date: '2026-01-01', load: 0 }], {
      fitness: 50,
      fatigue: 20
    })
    expect(series[0]!.form).toBe(30) // state entering the day
  })
})

describe('rampRate', () => {
  it('is null with insufficient history', () => {
    expect(rampRate(buildLoadSeries(fillDailyLoads([], '2026-01-01', '2026-01-05')))).toBeNull()
  })

  it('is positive while load is being added', () => {
    const daily = fillDailyLoads(
      Array.from({ length: 20 }, (_, i) => ({
        date: `2026-01-${String(i + 1).padStart(2, '0')}`,
        load: 90
      })),
      '2026-01-01',
      '2026-01-20'
    )
    expect(rampRate(buildLoadSeries(daily))!).toBeGreaterThan(0)
  })
})

describe('monotonyAndStrain', () => {
  it('is null for a short window', () => {
    const { monotony } = monotonyAndStrain([{ date: '2026-01-01', load: 50 }])
    expect(monotony).toBeNull()
  })

  it('reports zero for a fully rested week', () => {
    const daily = fillDailyLoads([], '2026-01-01', '2026-01-07')
    expect(monotonyAndStrain(daily)).toEqual({ monotony: 0, strain: 0 })
  })

  it('flags a varied week as lower monotony than a uniform one', () => {
    const varied = fillDailyLoads(
      [
        { date: '2026-01-01', load: 120 },
        { date: '2026-01-02', load: 40 },
        { date: '2026-01-03', load: 0 },
        { date: '2026-01-04', load: 150 },
        { date: '2026-01-05', load: 30 },
        { date: '2026-01-06', load: 0 },
        { date: '2026-01-07', load: 200 }
      ],
      '2026-01-01',
      '2026-01-07'
    )
    const nearUniform = fillDailyLoads(
      [
        { date: '2026-01-01', load: 78 },
        { date: '2026-01-02', load: 80 },
        { date: '2026-01-03', load: 79 },
        { date: '2026-01-04', load: 81 },
        { date: '2026-01-05', load: 80 },
        { date: '2026-01-06', load: 79 },
        { date: '2026-01-07', load: 80 }
      ],
      '2026-01-01',
      '2026-01-07'
    )
    expect(monotonyAndStrain(varied).monotony!).toBeLessThan(
      monotonyAndStrain(nearUniform).monotony!
    )
  })
})
