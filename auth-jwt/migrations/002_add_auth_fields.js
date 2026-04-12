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
}

export default class AddAuthFields extends BaseMigration {
  id = 2
  name = 'Add authentication fields to users table'

  async up(sql) {
    const columns = [
      { name: 'password', def: "TEXT NOT NULL DEFAULT ''" },
      { name: 'verified', def: 'BOOLEAN DEFAULT FALSE' },
      { name: 'superadmin', def: 'BOOLEAN DEFAULT FALSE' },
      { name: 'token_key', def: 'UUID DEFAULT gen_random_uuid()' },
      { name: 'email_visibility', def: 'BOOLEAN DEFAULT FALSE' },
      { name: 'pending_email', def: 'TEXT' },
      { name: 'email_change_token', def: 'UUID' }
    ]

    for (const col of columns) {
      const exists = await this.columnExists(sql, 'users', col.name)
      if (!exists) {
        await this.exec(sql, `ALTER TABLE users ADD COLUMN ${col.name} ${col.def}`)
        console.log(`Added ${col.name} column to users`)
      }
    }
  }
}
