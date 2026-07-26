import { eq } from 'drizzle-orm'
import { activities, athleteProfiles } from '../../database/schema'

const MAX_FILE_BYTES = 25 * 1024 * 1024

/** Why a single file failed, in words the athlete can act on. */
function parseErrorReason(err: unknown): string {
  if (typeof err === 'object' && err !== null) {
    const e = err as { statusMessage?: unknown, message?: unknown }
    if (typeof e.statusMessage === 'string' && e.statusMessage) return e.statusMessage
    if (typeof e.message === 'string' && e.message) return e.message
  }
  return 'Unbekannter Fehler'
}

/**
 * Imports one or more workout files (.fit / .gpx / .tcx) as activities.
 * Each file is parsed independently so one bad file doesn't fail the batch.
 */
export default defineEventHandler(async (event) => {
  const userId = await requireUserId(event)
  const form = await readMultipartFormData(event)

  const files = (form ?? []).filter(p => p.name === 'files' && p.filename && p.data?.length)
  if (!files.length) {
    throw createError({ statusCode: 400, statusMessage: 'Keine Datei übermittelt' })
  }

  const db = await useDb()
  const profile = await db.query.athleteProfiles.findFirst({
    where: eq(athleteProfiles.userId, userId)
  })

  const imported: unknown[] = []
  const failed: { file: string, reason: string }[] = []

  for (const file of files) {
    const name = file.filename!
    try {
      if (file.data.length > MAX_FILE_BYTES) {
        throw new Error('Datei ist größer als 25 MB')
      }

      const parsed = await parseWorkoutFile(name, file.data)

      const avgPaceSecPerKm
        = parsed.distanceM && parsed.distanceM > 0
          ? Math.round(parsed.durationSec / (parsed.distanceM / 1000))
          : null

      const load = computeActivityLoad(
        {
          sport: parsed.sport,
          durationSec: parsed.durationSec,
          distanceM: parsed.distanceM,
          avgPower: parsed.avgPower,
          avgHr: parsed.avgHr
        },
        profile
      )

      const [activity] = await db
        .insert(activities)
        .values({
          userId,
          source: 'import',
          sport: parsed.sport,
          name: parsed.name,
          startTime: parsed.startTime,
          durationSec: parsed.durationSec,
          distanceM: parsed.distanceM,
          avgPower: parsed.avgPower,
          avgHr: parsed.avgHr,
          maxHr: parsed.maxHr,
          avgPaceSecPerKm,
          elevationM: parsed.elevationM,
          load,
          rawFileName: name
        })
        .returning()

      const match = await autoMatchActivity(db, userId, activity!)
      imported.push({ activity, match })
    } catch (err) {
      failed.push({ file: name, reason: parseErrorReason(err) })
    }
  }

  return { imported: imported.length, failed, activities: imported }
})
