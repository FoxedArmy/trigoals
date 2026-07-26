/**
 * Pulls a user-facing message out of whatever `$fetch` threw.
 *
 * `message` is checked first because h3 reserves `statusMessage` for short
 * canonical reasons and will sanitise it in future versions — longer
 * explanations therefore live in `message`.
 */
export function apiErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null) {
    const data = (error as { data?: { statusMessage?: unknown, message?: unknown } }).data
    if (typeof data?.message === 'string' && data.message) return data.message
    if (typeof data?.statusMessage === 'string' && data.statusMessage) return data.statusMessage
  }
  return fallback
}
