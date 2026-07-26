import { z } from 'zod'
import { races } from '../../database/schema'

const bodySchema = z.object({
  name: z.string().trim().min(1).max(140),
  date: isoDate,
  sport: z.enum(['swim', 'bike', 'run', 'strength', 'other', 'triathlon']),
  distanceLabel: z.string().trim().max(60).nullish(),
  priority: z.enum(['A', 'B', 'C']).default('B'),
  notes: z.string().max(2000).nullish()
})

export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const data = await readValidatedBody(event, bodySchema.parse)
  const db = await useDb()

  const [race] = await db
    .insert(races)
    .values({ ...data, userId })
    .returning()

  return race
})
