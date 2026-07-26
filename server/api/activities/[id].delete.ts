import { and, eq } from 'drizzle-orm'
import { activities } from '../../database/schema'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const id = getRouterParam(event, 'id')!
  const db = await useDb()

  // The match row is removed by the cascading foreign key.
  const deleted = await db
    .delete(activities)
    .where(and(eq(activities.id, id), eq(activities.userId, userId)))
    .returning()

  if (!deleted.length) {
    throw createError({ statusCode: 404, statusMessage: 'Aktivität nicht gefunden' })
  }

  return { ok: true }
})
