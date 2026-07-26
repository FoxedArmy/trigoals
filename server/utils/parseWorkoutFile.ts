import { XMLParser } from 'fast-xml-parser'
import type { Sport } from '../database/schema'

export interface ParsedActivity {
  sport: Sport
  name: string | null
  startTime: Date
  durationSec: number
  distanceM: number | null
  avgPower: number | null
  avgHr: number | null
  maxHr: number | null
  elevationM: number | null
}

/** Maps the sport names used by Garmin/Strava exports onto our own. */
function normaliseSport(raw: string | undefined | null): Sport {
  const s = (raw ?? '').toLowerCase()
  if (s.includes('swim')) return 'swim'
  if (s.includes('bik') || s.includes('cycl') || s.includes('ride')) return 'bike'
  if (s.includes('run') || s.includes('walk') || s.includes('hik')) return 'run'
  if (s.includes('strength') || s.includes('training')) return 'strength'
  return 'other'
}

const asArray = <T>(v: T | T[] | undefined): T[] =>
  v === undefined ? [] : Array.isArray(v) ? v : [v]

const num = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

/** Haversine distance in metres. */
function haversine(a: [number, number], b: [number, number]): number {
  const R = 6_371_000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b[0] - a[0])
  const dLon = toRad(b[1] - a[1])
  const lat1 = toRad(a[0])
  const lat2 = toRad(b[0])
  const h
    = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

function average(values: number[]): number | null {
  if (!values.length) return null
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length)
}

const xml = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@',
  removeNSPrefix: true,
  parseTagValue: true
})

// ---------------------------------------------------------------------------
// GPX
// ---------------------------------------------------------------------------
function parseGpx(content: string, fileName: string): ParsedActivity {
  const doc = xml.parse(content)
  const gpx = doc.gpx
  if (!gpx) throw new Error('Keine GPX-Daten gefunden')

  const tracks = asArray(gpx.trk)
  const track = tracks[0]
  const points = tracks.flatMap(t => asArray(t.trkseg)).flatMap(seg => asArray(seg.trkpt))

  if (!points.length) throw new Error('GPX enthält keine Trackpunkte')

  const times: Date[] = []
  const coords: [number, number][] = []
  const elevations: number[] = []
  const hrs: number[] = []
  const powers: number[] = []

  for (const p of points) {
    const lat = num(p['@lat'])
    const lon = num(p['@lon'])
    if (lat !== null && lon !== null) coords.push([lat, lon])

    if (p.time) {
      const t = new Date(p.time)
      if (!Number.isNaN(t.valueOf())) times.push(t)
    }

    const ele = num(p.ele)
    if (ele !== null) elevations.push(ele)

    // Heart rate / power live in the TrackPointExtension namespace.
    const ext = p.extensions?.TrackPointExtension ?? p.extensions
    const hr = num(ext?.hr)
    if (hr !== null) hrs.push(hr)
    const pw = num(p.extensions?.power ?? ext?.power)
    if (pw !== null) powers.push(pw)
  }

  let distanceM = 0
  for (let i = 1; i < coords.length; i++) {
    distanceM += haversine(coords[i - 1]!, coords[i]!)
  }

  let gain = 0
  for (let i = 1; i < elevations.length; i++) {
    const d = elevations[i]! - elevations[i - 1]!
    if (d > 0) gain += d
  }

  const startTime = times[0] ?? new Date()
  const endTime = times[times.length - 1] ?? startTime
  const durationSec = Math.max(1, Math.round((endTime.valueOf() - startTime.valueOf()) / 1000))

  return {
    sport: normaliseSport(track?.type ?? gpx.trk?.type),
    name: (typeof track?.name === 'string' ? track.name : null) ?? fileName,
    startTime,
    durationSec,
    distanceM: distanceM > 0 ? Math.round(distanceM) : null,
    avgPower: average(powers),
    avgHr: average(hrs),
    maxHr: hrs.length ? Math.max(...hrs) : null,
    elevationM: gain > 0 ? Math.round(gain) : null
  }
}

// ---------------------------------------------------------------------------
// TCX
// ---------------------------------------------------------------------------
function parseTcx(content: string, fileName: string): ParsedActivity {
  const doc = xml.parse(content)
  const activity = asArray(doc.TrainingCenterDatabase?.Activities?.Activity)[0]
  if (!activity) throw new Error('Keine TCX-Aktivität gefunden')

  const laps = asArray(activity.Lap)
  if (!laps.length) throw new Error('TCX enthält keine Runden')

  let durationSec = 0
  let distanceM = 0
  const hrs: number[] = []
  const powers: number[] = []

  for (const lap of laps) {
    durationSec += num(lap.TotalTimeSeconds) ?? 0
    distanceM += num(lap.DistanceMeters) ?? 0

    const avgHr = num(lap.AverageHeartRateBpm?.Value)
    if (avgHr !== null) hrs.push(avgHr)

    const trackpoints = asArray(lap.Track).flatMap(t => asArray(t.Trackpoint))
    for (const tp of trackpoints) {
      const pw = num(tp.Extensions?.TPX?.Watts)
      if (pw !== null) powers.push(pw)
    }
  }

  const maxHrValues = laps
    .map(l => num(l.MaximumHeartRateBpm?.Value))
    .filter((n): n is number => n !== null)

  const startTime = new Date(activity.Id ?? laps[0]?.['@StartTime'] ?? Date.now())

  return {
    sport: normaliseSport(activity['@Sport']),
    name: fileName,
    startTime: Number.isNaN(startTime.valueOf()) ? new Date() : startTime,
    durationSec: Math.max(1, Math.round(durationSec)),
    distanceM: distanceM > 0 ? Math.round(distanceM) : null,
    avgPower: average(powers),
    avgHr: average(hrs),
    maxHr: maxHrValues.length ? Math.max(...maxHrValues) : null,
    elevationM: null
  }
}

// ---------------------------------------------------------------------------
// FIT
// ---------------------------------------------------------------------------
/** The fields we read out of a parsed FIT file; everything else is ignored. */
interface FitRecord {
  timestamp?: string | number | Date
  heart_rate?: unknown
  power?: unknown
}
interface FitSession {
  sport?: string
  start_time?: string | number | Date
  total_timer_time?: unknown
  total_elapsed_time?: unknown
  total_distance?: unknown
  avg_power?: unknown
  avg_heart_rate?: unknown
  max_heart_rate?: unknown
  total_ascent?: unknown
}
interface FitData {
  sessions?: FitSession | FitSession[]
  records?: FitRecord | FitRecord[]
  activity?: { timestamp?: string | number | Date }
}

async function parseFit(buffer: Buffer, fileName: string): Promise<ParsedActivity> {
  const { default: FitParser } = await import('fit-file-parser')

  const parser = new FitParser({
    force: true,
    speedUnit: 'm/s',
    lengthUnit: 'm',
    temperatureUnit: 'celsius',
    elapsedRecordField: true,
    mode: 'list'
  })

  const data = await new Promise<FitData>((resolve, reject) => {
    parser.parse(buffer, (err, result) =>
      err ? reject(err) : resolve((result ?? {}) as FitData)
    )
  })

  const session = asArray(data.sessions)[0]
  const activity = data.activity
  const records = asArray<FitRecord>(data.records)

  const hrs = records.map(r => num(r.heart_rate)).filter((n): n is number => n !== null)
  const powers = records.map(r => num(r.power)).filter((n): n is number => n !== null)

  const startTime = new Date(
    session?.start_time ?? activity?.timestamp ?? records[0]?.timestamp ?? Date.now()
  )

  const lastTimestamp = records[records.length - 1]?.timestamp
  const durationSec
    = num(session?.total_timer_time)
      ?? num(session?.total_elapsed_time)
      ?? (records.length > 1 && lastTimestamp
        ? Math.round((new Date(lastTimestamp).valueOf() - startTime.valueOf()) / 1000)
        : 0)

  return {
    sport: normaliseSport(session?.sport),
    name: fileName,
    startTime: Number.isNaN(startTime.valueOf()) ? new Date() : startTime,
    durationSec: Math.max(1, Math.round(durationSec)),
    distanceM: num(session?.total_distance),
    avgPower: num(session?.avg_power) ?? average(powers),
    avgHr: num(session?.avg_heart_rate) ?? average(hrs),
    maxHr: num(session?.max_heart_rate) ?? (hrs.length ? Math.max(...hrs) : null),
    elevationM: num(session?.total_ascent)
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------
export async function parseWorkoutFile(
  fileName: string,
  buffer: Buffer
): Promise<ParsedActivity> {
  const lower = fileName.toLowerCase()
  const base = fileName.replace(/\.[^.]+$/, '')

  if (lower.endsWith('.gpx')) return parseGpx(buffer.toString('utf8'), base)
  if (lower.endsWith('.tcx')) return parseTcx(buffer.toString('utf8'), base)
  if (lower.endsWith('.fit')) return parseFit(buffer, base)

  throw createError({
    statusCode: 400,
    statusMessage: 'Nicht unterstütztes Format — bitte .fit, .gpx oder .tcx'
  })
}
