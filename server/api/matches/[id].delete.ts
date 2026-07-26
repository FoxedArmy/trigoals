import { and, eq } from 'drizzle-orm'
import { workoutMatches } from '../../database/schema'

/** Removes a match, returning the plan to "open" and the activity to "unplanned". */
export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const id = getRouterParam(event, 'id')!
  const db = await useDb()

  const deleted = await db
    .delete(workoutMatches)
    .where(and(eq(workoutMatches.id, id), eq(workoutMatches.userId, userId)))
    .returning()

  if (!deleted.length) {
    throw createError({ statusCode: 404, statusMessage: 'Zuordnung nicht gefunden' })
  }

  return { ok: true }
})
