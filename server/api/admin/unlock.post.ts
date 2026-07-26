import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { users } from '../../database/schema'

const bodySchema = z.object({
  password: z.string().min(1).max(200)
})

/**
 * Grants the current account admin rights in exchange for the operator
 * password. Deliberately a per-account flag rather than a shared login, so
 * actions stay attributable and the gate survives a page reload.
 */
export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const { password } = await readValidatedBody(event, bodySchema.parse)

  // Throttle per account — the session is already required, so this is a
  // stronger key than an IP address.
  checkUnlockThrottle(userId)

  if (!adminPasswordConfigured()) {
    throw createError({
      statusCode: 503,
      statusMessage: 'Admin unlock not configured',
      message:
        'Kein Admin-Passwort konfiguriert. NUXT_ADMIN_UNLOCK_PASSWORD setzen (mind. 12 Zeichen).'
    })
  }

  if (!verifyAdminPassword(password)) {
    // Same message for wrong password regardless of reason.
    throw createError({ statusCode: 401, statusMessage: 'Passwort ist falsch' })
  }

  clearUnlockThrottle(userId)

  const db = await useDb()
  const [user] = await db
    .update(users)
    .set({ isAdmin: true })
    .where(eq(users.id, userId))
    .returning()

  if (!user) {
    throw createError({ statusCode: 500, statusMessage: 'Freischaltung fehlgeschlagen' })
  }

  // Refresh the session hint the UI reads.
  await setUserSession(event, {
    user: { id: user.id, email: user.email, name: user.name, isAdmin: true }
  })

  return { isAdmin: true }
})
