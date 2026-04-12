#!/usr/bin/env node
/**
 * Build-time migration runner.
 * Runs all migrations in the migrations/ directory during build/dev.
 */

import postgres from 'postgres'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { readdir, readFile } from 'fs/promises'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

async function loadEnv() {
  try {
    const envPath = join(process.cwd(), '.env')
    const envContent = await readFile(envPath, 'utf-8')
    for (const line of envContent.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eqIndex = trimmed.indexOf('=')
      if (eqIndex === -1) continue
      const key = trimmed.slice(0, eqIndex)
      const value = trimmed.slice(eqIndex + 1)
      if (!process.env[key]) {
        process.env[key] = value
      }
    }
  } catch {
    // .env file not found, continue with existing env vars
  }
}

await loadEnv()

async function loadMigrations(dir) {
  try {
    const files = await readdir(dir)
    const migrationFiles = files
      .filter(file => file.endsWith('.js'))
      .sort()

    const migrations = []

    for (const file of migrationFiles) {
      const match = file.match(/^(\d+)_(.+)\.js$/)
      if (!match) {
        console.warn(`Skipping invalid migration file: ${file}`)
        continue
      }

      const id = parseInt(match[1], 10)
      const filePath = join(dir, file)

      try {
        const fileUrl = `file://${filePath.replace(/\\/g, '/')}`
        const migrationModule = await import(fileUrl)
        const MigrationClass = migrationModule.default

        if (!MigrationClass) {
          console.warn(`Migration file ${file} does not export a default class`)
          continue
        }

        const migrationInstance = new MigrationClass()

        if (migrationInstance.id !== id) {
          console.warn(`Migration file ${file} has mismatched ID: expected ${id}, got ${migrationInstance.id}`)
          continue
        }

        migrations.push(migrationInstance)
      } catch (error) {
        console.error(`Failed to load migration ${file}:`, error)
        continue
      }
    }

    return migrations.sort((a, b) => a.id - b.id)
  } catch {
    return []
  }
}

async function runMigrations() {
  const databaseUrl = process.env.DATABASE_URL

  if (!databaseUrl) {
    console.error('DATABASE_URL environment variable is required')
    process.exit(1)
  }

  console.log('Running build-time migrations...')

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
    console.log('Loading migrations from:', migrationsDir)
    const migrations = await loadMigrations(migrationsDir)
    console.log(`Found ${migrations.length} migration(s)`)

    if (migrations.length === 0) {
      console.log('No migrations found')
      await sql.end()
      return
    }

    const rows = await sql`SELECT migration_id FROM migrations ORDER BY id`
    const executedIds = new Set(rows.map(row => row.migration_id))

    const pendingMigrations = migrations.filter(m => !executedIds.has(m.id))

    if (pendingMigrations.length === 0) {
      console.log('All migrations are up to date')
      await sql.end()
      return
    }

    console.log(`Found ${pendingMigrations.length} pending migration(s)`)

    for (const migration of pendingMigrations) {
      console.log(`Running migration ${migration.id}: ${migration.name}`)

      await sql.begin(async (tx) => {
        await migration.up(tx)
        await tx`
          INSERT INTO migrations (migration_id, name)
          VALUES (${migration.id}, ${migration.name})
        `
      })

      console.log(`Migration ${migration.id} completed`)
    }

    console.log('All migrations completed successfully')
  } catch (error) {
    console.error('Migration failed:', error)
    await sql.end()
    process.exit(1)
  }

  await sql.end()
}

runMigrations()
