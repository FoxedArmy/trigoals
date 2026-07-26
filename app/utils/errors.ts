/**
 * Pulls a user-facing message out of whatever `$fetch` threw. Nitro puts the
 * `createError` message in `data.statusMessage`.
 */
export function apiErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null) {
    const data = (error as { data?: { statusMessage?: unknown, message?: unknown } }).data
    if (typeof data?.statusMessage === 'string' && data.statusMessage) return data.statusMessage
    if (typeof data?.message === 'string' && data.message) return data.message
  }
  return fallback
}
