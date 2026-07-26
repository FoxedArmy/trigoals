import { z } from 'zod'
import { athleteProfiles } from '../database/schema'

const nInt = z.number().int().positive().nullish()

const bodySchema = z.object({
  ftp: nInt,
  thresholdPaceRun: nInt, // sec / km
  css: nInt, // sec / 100 m
  lthr: nInt,
  maxHr: nInt,
  restHr: nInt,
  weightKg: z.number().positive().max(300).nullish()
})

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const data = await readValidatedBody(event, bodySchema.parse)
  const db = await useDb()

  const values = { userId, ...data, updatedAt: new Date() }

  const [profile] = await db
    .insert(athleteProfiles)
    .values(values)
    .onConflictDoUpdate({ target: athleteProfiles.userId, set: { ...data, updatedAt: new Date() } })
    .returning()

  return profile
})
