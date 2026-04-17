import postgres from 'postgres'
import { readdir } from 'fs/promises'
import { join } from 'path'

interface Migration {
  id: number
  name: string
  up: (sql: any) => Promise<void>
}

async function loadMigrations(dir: string): Promise<Migration[]> {
  try {
    const files = await readdir(dir)
    const migrationFiles = files.filter(f => f.endsWith('.js')).sort()
    const migrations: Migration[] = []

    for (const file of migrationFiles) {
      const match = file.match(/^(\d+)_(.+)\.js$/)
      if (!match) continue

      const id = parseInt(match[1], 10)
      const filePath = join(dir, file)

      try {
        const mod = await import(`file://${filePath.replace(/\\/g, '/')}`)
        const MigrationClass = mod.default
        if (!MigrationClass) continue

        const instance = new MigrationClass()
        if (instance.id !== id) {
          console.warn(`Migration ${file}: expected id ${id}, got ${instance.id}`)
          continue
        }

        migrations.push(instance)
      } catch (err) {
        console.error(`Failed to load migration ${file}:`, err)
      }
    }

    return migrations.sort((a, b) => a.id - b.id)
  } catch {
    return []
  }
}

export default defineNitroPlugin(async () => {
  const config = useRuntimeConfig()
  const databaseUrl = config.databaseUrl || process.env.DATABASE_URL

  if (!databaseUrl) {
    console.warn('DATABASE_URL not set, skipping migrations')
    return
  }

  const isLocalhost = databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1')

  const sql = postgres(databaseUrl, {
    ssl: isLocalhost ? false : 'require',
    max: 1,
    idle_timeout: 20,
    connect_timeout: 30,
    onnotice: () => {},
  })

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        migration_id INTEGER NOT NULL UNIQUE,
        name TEXT NOT NULL,
        executed_at TIMESTAMPTZ DEFAULT NOW()
      )
    `

    const migrationsDir = join(process.cwd(), 'migrations')
    const migrations = await loadMigrations(migrationsDir)

    if (migrations.length === 0) {
      await sql.end()
      return
    }

    const rows = await sql`SELECT migration_id FROM migrations ORDER BY id`
    const executedIds = new Set(rows.map(r => r.migration_id))
    const pending = migrations.filter(m => !executedIds.has(m.id))

    if (pending.length === 0) {
      await sql.end()
      return
    }

    console.log(`Running ${pending.length} pending migration(s)...`)

    for (const migration of pending) {
      console.log(`  Migration ${migration.id}: ${migration.name}`)
      await sql.begin(async (tx: any) => {
        await migration.up(tx)
        await tx`
          INSERT INTO migrations (migration_id, name)
          VALUES (${migration.id}, ${migration.name})
        `
      })
    }

    console.log('Migrations complete')
  } catch (err) {
    console.error('Migration failed:', err)
    throw err
  } finally {
    await sql.end()
  }
})
