class BaseMigration {
  async exec(sql, query) {
    await sql.unsafe(query)
  }

  async tableExists(sql, tableName) {
    const result = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = ${tableName}
      ) as exists
    `
    return result[0]?.exists || false
  }

  async columnExists(sql, tableName, columnName) {
    const result = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = ${tableName}
        AND column_name = ${columnName}
      ) as exists
    `
    return result[0]?.exists || false
  }

  down(sql) {
    throw new Error(`Down migration not implemented for migration ${this.id}`)
  }
}

export default class AddGoogleAuth extends BaseMigration {
  id = 5
  name = 'Add Google authentication support'

  async up(sql) {
    const hasGoogleId = await this.columnExists(sql, 'users', 'google_id')
    if (hasGoogleId) {
      console.log('📝 google_id column already exists, skipping')
      return
    }

    console.log('🔄 Adding google_id column to users table...')
    await this.exec(sql, `
      ALTER TABLE users ADD COLUMN google_id TEXT UNIQUE
    `)

    console.log('🔄 Creating index on google_id...')
    await this.exec(sql, `
      CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id)
    `)

    console.log('🔄 Making password column nullable for Google-only accounts...')
    await this.exec(sql, `
      ALTER TABLE users ALTER COLUMN password DROP NOT NULL
    `)

    console.log('✅ Google authentication support added successfully!')
  }

  async down(sql) {
    await this.exec(sql, 'DROP INDEX IF EXISTS idx_users_google_id')
    await this.exec(sql, 'ALTER TABLE users DROP COLUMN IF EXISTS google_id')
    await this.exec(sql, 'ALTER TABLE users ALTER COLUMN password SET NOT NULL')
  }
}
