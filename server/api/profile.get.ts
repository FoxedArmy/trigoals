import { eq } from 'drizzle-orm'
import { athleteProfiles } from '../database/schema'

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const db = await useDb()

  const profile = await db.query.athleteProfiles.findFirst({
    where: eq(athleteProfiles.userId, userId)
  })

  return profile ?? null
})
