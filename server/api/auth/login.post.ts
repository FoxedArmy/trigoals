import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { users } from '../../database/schema'

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
})

export default defineEventHandler(async (event) => {
  const { email, password } = await readValidatedBody(event, bodySchema.parse)
  const db = await useDb()

  const user = await db.query.users.findFirst({
    where: eq(users.email, email.toLowerCase())
  })

  const invalid = () =>
    createError({ statusCode: 401, statusMessage: 'E-Mail oder Passwort ist falsch' })

  if (!user) throw invalid()

  const valid = await verifyPassword(user.passwordHash, password)
  if (!valid) throw invalid()

  const publicUser = {
    id: user.id,
    email: user.email,
    name: user.name,
    isAdmin: user.isAdmin
  }
  await setUserSession(event, { user: publicUser })

  return publicUser
})
