import { z } from 'zod'
import { and, eq, gte, lte } from 'drizzle-orm'
import { plannedWorkouts } from '../../database/schema'

const querySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
})

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const { from, to } = await getValidatedQuery(event, querySchema.parse)
  const db = await useDb()

  return db.query.plannedWorkouts.findMany({
    where: and(
      eq(plannedWorkouts.userId, userId),
      gte(plannedWorkouts.date, from),
      lte(plannedWorkouts.date, to)
    ),
    with: { match: { with: { activity: true } } },
    orderBy: (w, { asc }) => [asc(w.date)]
  })
})
