import { z } from 'zod'
import { plannedWorkouts } from '../../database/schema'
import { findSystemTemplate } from '../../../shared/data/templates'
import { estimatePlannedLoad } from '../../../shared/utils/load'
import { addDays, startOfWeek } from '../../../shared/utils/date'

const bodySchema = z.object({
  templateId: z.string().min(1),
  /** Any date in the week the plan should start; snapped to that Monday. */
  startDate: isoDate
})

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const { templateId, startDate } = await readValidatedBody(event, bodySchema.parse)

  const template = findSystemTemplate(templateId)
  if (!template) {
    throw createError({ statusCode: 404, statusMessage: 'Vorlage nicht gefunden' })
  }

  const firstMonday = startOfWeek(startDate)

  const rows = template.weeks.flatMap((week, weekIndex) =>
    week.workouts.map(w => ({
      userId,
      date: addDays(firstMonday, weekIndex * 7 + w.dayOfWeek),
      sport: w.sport,
      title: w.title,
      type: w.type,
      plannedDurationSec: w.durationSec ?? null,
      plannedDistanceM: w.distanceM ?? null,
      targetZone: w.targetZone ?? null,
      plannedLoad: w.durationSec ? estimatePlannedLoad(w.durationSec, w.targetZone) : null,
      notes: w.notes ?? null
    }))
  )

  if (!rows.length) return { created: 0 }

  const db = await useDb()
  const inserted = await db.insert(plannedWorkouts).values(rows).returning()

  return {
    created: inserted.length,
    from: firstMonday,
    to: addDays(firstMonday, template.weeks.length * 7 - 1)
  }
})
