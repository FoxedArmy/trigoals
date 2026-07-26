/**
 * Date helpers. All calendar dates are handled as plain `YYYY-MM-DD` strings to
 * avoid timezone drift — a workout planned for Tuesday must stay on Tuesday
 * regardless of where the athlete is.
 */

/** `YYYY-MM-DD` for a Date, using its local calendar day. */
export function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Parses `YYYY-MM-DD` into a local Date at midnight. */
export function fromISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y!, m! - 1, d!)
}

export function addDays(iso: string, days: number): string {
  const d = fromISODate(iso)
  d.setDate(d.getDate() + days)
  return toISODate(d)
}

/** Monday of the week containing `iso` (ISO-8601 week, Monday start). */
export function startOfWeek(iso: string): string {
  const d = fromISODate(iso)
  const dow = (d.getDay() + 6) % 7 // Mon=0 .. Sun=6
  d.setDate(d.getDate() - dow)
  return toISODate(d)
}

export function endOfWeek(iso: string): string {
  return addDays(startOfWeek(iso), 6)
}

/** The seven `YYYY-MM-DD` dates of the week containing `iso`. */
export function weekDates(iso: string): string[] {
  const start = startOfWeek(iso)
  return Array.from({ length: 7 }, (_, i) => addDays(start, i))
}

export function today(): string {
  return toISODate(new Date())
}

/** ISO-8601 week number. */
export function isoWeekNumber(iso: string): number {
  const d = fromISODate(iso)
  const target = new Date(d.valueOf())
  const dayNr = (d.getDay() + 6) % 7
  target.setDate(target.getDate() - dayNr + 3) // nearest Thursday
  const firstThursday = new Date(target.getFullYear(), 0, 4)
  const firstDayNr = (firstThursday.getDay() + 6) % 7
  firstThursday.setDate(firstThursday.getDate() - firstDayNr + 3)
  return 1 + Math.round((target.valueOf() - firstThursday.valueOf()) / (7 * 24 * 3600 * 1000))
}

const WEEKDAYS_SHORT = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

/** German short weekday name for an ISO date. */
export function weekdayShort(iso: string): string {
  const dow = (fromISODate(iso).getDay() + 6) % 7
  return WEEKDAYS_SHORT[dow]!
}

/** e.g. "26.07." */
export function formatDayMonth(iso: string): string {
  const d = fromISODate(iso)
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.`
}

/** e.g. "26. Juli 2026" */
export function formatLongDate(iso: string): string {
  return fromISODate(iso).toLocaleDateString('de-DE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })
}

/** Whole days from today until `iso` (negative = in the past). */
export function daysUntil(iso: string): number {
  const a = fromISODate(today())
  const b = fromISODate(iso)
  return Math.round((b.valueOf() - a.valueOf()) / (24 * 3600 * 1000))
}
