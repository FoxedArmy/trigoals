import type { H3Event } from 'h3'

/** Returns the authenticated user's id or throws a 401. */
export async function requireUserId(event: H3Event): Promise<string> {
  const { user } = await requireUserSession(event)
  return user!.id
}
