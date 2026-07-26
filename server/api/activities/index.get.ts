import { z } from 'zod'
import { and, eq, gte, lte } from 'drizzle-orm'
import { activities } from '../../database/schema'

const querySchema = z.object({
  from: isoDate.optional(),
  to: isoDate.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50)
})

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const { from, to, limit } = await getValidatedQuery(event, querySchema.parse)
  const db = await useDb()

  const filters = [eq(activities.userId, userId)]
  if (from) filters.push(gte(activities.startTime, new Date(`${from}T00:00:00`)))
  if (to) filters.push(lte(activities.startTime, new Date(`${to}T23:59:59`)))

  return db.query.activities.findMany({
    where: and(...filters),
    with: { match: true },
    orderBy: (a, { desc }) => [desc(a.startTime)],
    limit
  })
})
