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

export default class AddFirebaseAuth extends BaseMigration {
  id = 5
  name = 'Add Firebase authentication support'

  async up(sql) {
    const hasFirebaseUid = await this.columnExists(sql, 'users', 'firebase_uid')
    if (hasFirebaseUid) {
      console.log('📝 firebase_uid column already exists, skipping')
      return
    }

    console.log('🔄 Adding firebase_uid column to users table...')
    await this.exec(sql, `
      ALTER TABLE users ADD COLUMN firebase_uid TEXT UNIQUE
    `)

    console.log('🔄 Creating index on firebase_uid...')
    await this.exec(sql, `
      CREATE INDEX IF NOT EXISTS idx_users_firebase_uid ON users(firebase_uid)
    `)

    console.log('🔄 Making password column nullable for Firebase-only accounts...')
    await this.exec(sql, `
      ALTER TABLE users ALTER COLUMN password DROP NOT NULL
    `)

    console.log('✅ Firebase authentication support added successfully!')
  }

  async down(sql) {
    await this.exec(sql, 'DROP INDEX IF EXISTS idx_users_firebase_uid')
    await this.exec(sql, 'ALTER TABLE users DROP COLUMN IF EXISTS firebase_uid')
    await this.exec(sql, 'ALTER TABLE users ALTER COLUMN password SET NOT NULL')
  }
}
