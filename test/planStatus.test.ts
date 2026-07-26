import { describe, it, expect } from 'vitest'
import { planDisplayStatus, weeklyCompliance, STATUS_META } from '../shared/utils/planStatus'

const TODAY = '2026-07-26'

describe('planDisplayStatus', () => {
  it('reports the match status when a match exists', () => {
    expect(
      planDisplayStatus({ date: '2026-07-20', match: { status: 'completed', complianceScore: 95 } }, TODAY)
    ).toBe('completed')
    expect(
      planDisplayStatus({ date: '2026-07-20', match: { status: 'partial', complianceScore: 60 } }, TODAY)
    ).toBe('partial')
  })

  it('treats an unmatched past session as missed', () => {
    expect(planDisplayStatus({ date: '2026-07-25' }, TODAY)).toBe('missed')
  })

  it('treats today and future sessions as open', () => {
    expect(planDisplayStatus({ date: TODAY }, TODAY)).toBe('open')
    expect(planDisplayStatus({ date: '2026-07-30' }, TODAY)).toBe('open')
  })

  it('has display metadata for every status', () => {
    for (const status of ['completed', 'partial', 'missed', 'unplanned', 'open'] as const) {
      expect(STATUS_META[status]).toBeDefined()
      expect(STATUS_META[status].label).toBeTruthy()
    }
  })
})

describe('weeklyCompliance', () => {
  it('is null when nothing is due yet', () => {
    expect(weeklyCompliance([{ date: '2026-07-30' }], TODAY)).toBeNull()
    expect(weeklyCompliance([], TODAY)).toBeNull()
  })

  it('is 100 when every due session was completed fully', () => {
    const plans = [
      { date: '2026-07-20', match: { status: 'completed' as const, complianceScore: 100 } },
      { date: '2026-07-21', match: { status: 'completed' as const, complianceScore: 100 } }
    ]
    expect(weeklyCompliance(plans, TODAY)).toBe(100)
  })

  it('counts missed sessions as zero', () => {
    const plans = [
      { date: '2026-07-20', match: { status: 'completed' as const, complianceScore: 100 } },
      { date: '2026-07-21' } // missed
    ]
    expect(weeklyCompliance(plans, TODAY)).toBe(50)
  })

  it('ignores future sessions in the average', () => {
    const plans = [
      { date: '2026-07-20', match: { status: 'completed' as const, complianceScore: 100 } },
      { date: '2026-07-30' } // future, not yet due
    ]
    expect(weeklyCompliance(plans, TODAY)).toBe(100)
  })

  it('averages partial sessions', () => {
    const plans = [
      { date: '2026-07-20', match: { status: 'completed' as const, complianceScore: 100 } },
      { date: '2026-07-21', match: { status: 'partial' as const, complianceScore: 50 } }
    ]
    expect(weeklyCompliance(plans, TODAY)).toBe(75)
  })
})
