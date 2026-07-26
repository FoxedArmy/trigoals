import { and, eq } from 'drizzle-orm'
import { plannedWorkouts } from '../../database/schema'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const id = getRouterParam(event, 'id')!
  const db = await useDb()

  const deleted = await db
    .delete(plannedWorkouts)
    .where(and(eq(plannedWorkouts.id, id), eq(plannedWorkouts.userId, userId)))
    .returning()

  if (!deleted.length) {
    throw createError({ statusCode: 404, statusMessage: 'Workout nicht gefunden' })
  }

  return { ok: true }
})
