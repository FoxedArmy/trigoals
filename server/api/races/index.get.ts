import { eq } from 'drizzle-orm'
import { races } from '../../database/schema'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const db = await useDb()

  return db.query.races.findMany({
    where: eq(races.userId, userId),
    orderBy: (r, { asc }) => [asc(r.date)]
  })
})
