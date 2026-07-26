import { SYSTEM_TEMPLATES } from '../../../shared/data/templates'

export default defineEventHandler(async (event) => {
  await requireUserId(event)

  // Summary only — the full week structure is applied server-side.
  return SYSTEM_TEMPLATES.map(t => ({
    id: t.id,
    name: t.name,
    description: t.description,
    focus: t.focus,
    weeklyHours: t.weeklyHours,
    weekCount: t.weeks.length,
    weekLabels: t.weeks.map(w => w.label ?? '')
  }))
})
