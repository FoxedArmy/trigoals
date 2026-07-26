import { eq } from 'drizzle-orm'
import { stravaConnections } from '../../database/schema'
import { stravaConfigured } from '../../utils/strava'

/** Connection state for the settings page. Never returns tokens. */
export default defineEventHandler(async (event) => {
  const userId = await requireAdmin(event)
  const db = await useDb()

  const connection = await db.query.stravaConnections.findFirst({
    where: eq(stravaConnections.userId, userId),
    columns: {
      athleteId: true,
      athleteName: true,
      scope: true,
      lastSyncAt: true,
      createdAt: true
    }
  })

  return {
    configured: stravaConfigured(event),
    encryptionReady: hasEncryptionKey(),
    connection: connection ?? null
  }
})
