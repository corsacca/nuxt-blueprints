import { Kysely, sql } from 'kysely'
import { PostgresJSDialect } from 'kysely-postgres-js'
import postgres from 'postgres'
import type { Database } from '~/server/database/schema'

let _db: Kysely<Database> | null = null

function getDb(): Kysely<Database> {
  if (_db) return _db

  const databaseUrl = useRuntimeConfig().databaseUrl || process.env.DATABASE_URL
  if (!databaseUrl) throw new Error('DATABASE_URL is not set')

  const isLocal = databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1')

  _db = new Kysely<Database>({
    dialect: new PostgresJSDialect({
      postgres: postgres(databaseUrl, {
        ssl: isLocal ? false : 'require',
        max: 10,
        idle_timeout: 20,
        connect_timeout: 30,
        onnotice: () => {},
      }),
    }),
  })

  return _db
}

export const db = new Proxy({} as Kysely<Database>, {
  get: (_, prop) => {
    const real = getDb()
    const value = (real as any)[prop]
    return typeof value === 'function' ? value.bind(real) : value
  },
})

export { sql }
