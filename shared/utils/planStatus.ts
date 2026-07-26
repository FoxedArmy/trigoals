import type { MatchStatus } from './matching'

export type PlanDisplayStatus = MatchStatus | 'open'

export interface PlanStatusInput {
  date: string // YYYY-MM-DD
  match?: { status: MatchStatus, complianceScore: number | null } | null
}

/**
 * What to show for a planned workout. A plan without a match is only "missed"
 * once its day has passed — before that it's simply still open.
 */
export function planDisplayStatus(plan: PlanStatusInput, todayIso: string): PlanDisplayStatus {
  if (plan.match) return plan.match.status
  return plan.date < todayIso ? 'missed' : 'open'
}

export const STATUS_META: Record<
  PlanDisplayStatus,
  { label: string, icon: string, color: 'success' | 'warning' | 'error' | 'neutral' }
> = {
  completed: { label: 'Erledigt', icon: 'i-lucide-check-circle-2', color: 'success' },
  partial: { label: 'Teilweise', icon: 'i-lucide-circle-slash-2', color: 'warning' },
  missed: { label: 'Verpasst', icon: 'i-lucide-x-circle', color: 'error' },
  unplanned: { label: 'Ungeplant', icon: 'i-lucide-circle-help', color: 'neutral' },
  open: { label: 'Offen', icon: 'i-lucide-circle-dashed', color: 'neutral' }
}

/**
 * Weekly plan compliance: the average compliance of every planned session,
 * counting missed sessions as zero. Returns null when nothing was planned.
 */
export function weeklyCompliance(plans: PlanStatusInput[], todayIso: string): number | null {
  // Only judge sessions whose day has arrived — future sessions aren't failures.
  const due = plans.filter(p => p.date <= todayIso)
  if (!due.length) return null

  const total = due.reduce((sum, p) => {
    const status = planDisplayStatus(p, todayIso)
    if (status === 'missed' || status === 'open') return sum
    return sum + (p.match?.complianceScore ?? 0)
  }, 0)

  return Math.round(total / due.length)
}
