import { FileMigrationProvider, Migrator } from 'kysely'
import { promises as fs } from 'fs'
import * as path from 'path'
import { db } from '../utils/database'

export default defineNitroPlugin(async () => {
  const databaseUrl = useRuntimeConfig().databaseUrl || process.env.DATABASE_URL
  if (!databaseUrl) {
    console.warn('DATABASE_URL not set, skipping migrations')
    return
  }

  const migrator = new Migrator({
    db,
    provider: new FileMigrationProvider({
      fs,
      path,
      migrationFolder: path.join(process.cwd(), 'migrations'),
    }),
  })

  // Identify pending migrations so we can announce them before execution
  const all = await migrator.getMigrations()
  const pending = all.filter(m => !m.executedAt)

  if (pending.length === 0) {
    console.log('Migrations already up-to-date')
    return
  }

  console.log(`Running ${pending.length} pending migration(s)...`)
  for (const m of pending) {
    console.log(`  Migration: ${m.name}`)
  }

  const { error, results } = await migrator.migrateToLatest()

  results?.forEach(r => {
    if (r.status === 'Success') console.log(`✓ ${r.migrationName}`)
    if (r.status === 'Error') console.error(`✗ ${r.migrationName}`)
  })

  if (error) {
    console.error('Migration failed:', error)
    throw error
  }

  console.log('Migrations complete')
})
