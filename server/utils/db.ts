import { resolve } from 'node:path'
import { mkdirSync } from 'node:fs'
import * as schema from '../database/schema'

/**
 * Database access with automatic driver selection:
 *  - If `DATABASE_URL` is set  → Neon serverless (production / Vercel).
 *  - Otherwise                 → PGlite, an in-process Postgres persisted to
 *    `.data/pglite` so local development works with zero external setup.
 *
 * The instance is created lazily and memoised on `globalThis` to survive HMR.
 */
type Schema = typeof schema
/**
 * Driver-agnostic handle. The query-dialect parameter differs between the Neon
 * and PGlite builds, so it stays unconstrained here — every call site uses the
 * shared query/insert API, not driver-specific extras.
 */
export type Database = import('drizzle-orm/pg-core').PgDatabase<
  import('drizzle-orm/pg-core').PgQueryResultHKT,
  Schema
> & { $client: unknown }

const MIGRATIONS_DIR = resolve(process.cwd(), 'server/database/migrations')

const g = globalThis as unknown as { __trigoalsDb?: Promise<Database> }

async function createDb(): Promise<Database> {
  const url = process.env.DATABASE_URL

  if (url) {
    const { drizzle } = await import('drizzle-orm/neon-http')
    const { neon } = await import('@neondatabase/serverless')
    const db = drizzle(neon(url), { schema })
    return db as unknown as Database
  }

  // Local development fallback — PGlite (Postgres compiled to WASM). The guard
  // is `import.meta.dev`, which the production build inlines to `false` so this
  // whole block — and PGlite's ~17 MB of WASM — is dropped from the bundle.
  if (import.meta.dev) {
    const { PGlite } = await import('@electric-sql/pglite')
    const { drizzle } = await import('drizzle-orm/pglite')
    const { migrate } = await import('drizzle-orm/pglite/migrator')

    const dataDir = resolve(process.cwd(), '.data/pglite')
    mkdirSync(dataDir, { recursive: true })
    const client = new PGlite(dataDir)
    const db = drizzle(client, { schema })
    await migrate(db, { migrationsFolder: MIGRATIONS_DIR })
    return db as unknown as Database
  }

  throw createError({
    statusCode: 500,
    statusMessage: 'DATABASE_URL ist nicht gesetzt'
  })
}

export function useDb(): Promise<Database> {
  if (!g.__trigoalsDb) {
    // Don't cache a rejected promise — allow the next request to retry.
    g.__trigoalsDb = createDb().catch((err) => {
      g.__trigoalsDb = undefined
      throw err
    })
  }
  return g.__trigoalsDb
}

export { schema }
