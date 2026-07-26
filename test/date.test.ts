import { describe, it, expect } from 'vitest'
import {
  toISODate,
  fromISODate,
  addDays,
  startOfWeek,
  endOfWeek,
  weekDates,
  isoWeekNumber,
  weekdayShort,
  formatDayMonth,
  daysUntil,
  today
} from '../shared/utils/date'

describe('ISO date round-trip', () => {
  it('parses and formats without timezone drift', () => {
    expect(toISODate(fromISODate('2026-07-26'))).toBe('2026-07-26')
    expect(toISODate(fromISODate('2026-01-01'))).toBe('2026-01-01')
    expect(toISODate(fromISODate('2026-12-31'))).toBe('2026-12-31')
  })
})

describe('addDays', () => {
  it('crosses month boundaries', () => {
    expect(addDays('2026-07-31', 1)).toBe('2026-08-01')
  })

  it('crosses year boundaries', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
  })

  it('handles a leap day', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
  })
})

describe('startOfWeek / endOfWeek', () => {
  it('snaps a Sunday back to the preceding Monday', () => {
    // 2026-07-26 is a Sunday
    expect(startOfWeek('2026-07-26')).toBe('2026-07-20')
    expect(endOfWeek('2026-07-26')).toBe('2026-07-26')
  })

  it('keeps a Monday unchanged', () => {
    expect(startOfWeek('2026-07-27')).toBe('2026-07-27')
    expect(endOfWeek('2026-07-27')).toBe('2026-08-02')
  })

  it('is idempotent', () => {
    const a = startOfWeek('2026-03-18')
    expect(startOfWeek(a)).toBe(a)
  })
})

describe('weekDates', () => {
  it('returns seven consecutive days starting Monday', () => {
    const days = weekDates('2026-07-29')
    expect(days).toEqual([
      '2026-07-27',
      '2026-07-28',
      '2026-07-29',
      '2026-07-30',
      '2026-07-31',
      '2026-08-01',
      '2026-08-02'
    ])
  })
})

describe('weekdayShort', () => {
  it('labels Monday through Sunday', () => {
    expect(weekdayShort('2026-07-27')).toBe('Mo')
    expect(weekdayShort('2026-07-26')).toBe('So')
    expect(weekdayShort('2026-07-25')).toBe('Sa')
  })
})

describe('isoWeekNumber', () => {
  it('matches known ISO week numbers', () => {
    expect(isoWeekNumber('2026-07-20')).toBe(30)
    expect(isoWeekNumber('2026-07-27')).toBe(31)
  })

  it('handles the first days of January', () => {
    // 2026-01-01 is a Thursday => ISO week 1
    expect(isoWeekNumber('2026-01-01')).toBe(1)
  })
})

describe('formatDayMonth', () => {
  it('zero-pads day and month', () => {
    expect(formatDayMonth('2026-08-01')).toBe('01.08.')
  })
})

describe('daysUntil', () => {
  it('is zero for today', () => {
    expect(daysUntil(today())).toBe(0)
  })

  it('is positive for the future and negative for the past', () => {
    expect(daysUntil(addDays(today(), 10))).toBe(10)
    expect(daysUntil(addDays(today(), -3))).toBe(-3)
  })
})
