import { and, eq } from 'drizzle-orm'
import { races } from '../../database/schema'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const id = getRouterParam(event, 'id')!
  const db = await useDb()

  const deleted = await db
    .delete(races)
    .where(and(eq(races.id, id), eq(races.userId, userId)))
    .returning()

  if (!deleted.length) {
    throw createError({ statusCode: 404, statusMessage: 'Wettkampf nicht gefunden' })
  }

  return { ok: true }
})
