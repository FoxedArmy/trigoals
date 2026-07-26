import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { users } from '../../database/schema'

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Passwort muss mindestens 8 Zeichen haben'),
  name: z.string().trim().min(1).max(80).optional()
})

export default defineEventHandler(async (event) => {
  const { email, password, name } = await readValidatedBody(event, bodySchema.parse)
  const db = await useDb()

  const normalizedEmail = email.toLowerCase()
  const existing = await db.query.users.findFirst({
    where: eq(users.email, normalizedEmail)
  })
  if (existing) {
    throw createError({ statusCode: 409, statusMessage: 'E-Mail ist bereits registriert' })
  }

  const passwordHash = await hashPassword(password)
  const [user] = await db
    .insert(users)
    .values({ email: normalizedEmail, passwordHash, name })
    .returning()

  if (!user) {
    throw createError({ statusCode: 500, statusMessage: 'Konto konnte nicht erstellt werden' })
  }

  const publicUser = { id: user.id, email: user.email, name: user.name }
  await setUserSession(event, { user: publicUser })

  return publicUser
})
