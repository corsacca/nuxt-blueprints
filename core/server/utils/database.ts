import postgres from 'postgres'

let connection: ReturnType<typeof postgres> | null = null

function initConnection() {
  if (connection) return connection

  const databaseUrl = useRuntimeConfig().databaseUrl || process.env.DATABASE_URL

  if (!databaseUrl) {
    console.warn('DATABASE_URL environment variable is not set')
    return null
  }

  const isLocalhost = databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1')

  connection = postgres(databaseUrl, {
    ssl: isLocalhost ? false : 'require',
    max: 10,
    idle_timeout: 20,
    connect_timeout: 30,
    onnotice: () => {},
  })

  return connection
}

function sqlProxy(...args: any[]): any {
  const connection = initConnection()
  if (!connection) {
    throw new Error('Database not configured')
  }
  return (connection as any)(...args)
}

export const sql = new Proxy(sqlProxy, {
  get(target, prop) {
    const connection = initConnection()
    if (!connection) {
      throw new Error('Database not configured')
    }
    return (connection as any)[prop]
  }
})

export async function tableExists(tableName: string): Promise<boolean> {
  const result = await sql`
    SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name = ${tableName}
    ) as exists
  `
  return result[0]?.exists || false
}
