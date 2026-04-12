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

export default class CreateUsersTable extends BaseMigration {
  id = 1
  name = 'Create users table'

  async up(sql) {
    const usersTableExists = await this.tableExists(sql, 'users')
    if (!usersTableExists) {
      console.log('Creating users table...')
      await this.exec(sql, `
        CREATE TABLE users (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          created TIMESTAMPTZ DEFAULT NOW(),
          updated TIMESTAMPTZ DEFAULT NOW(),
          email TEXT UNIQUE NOT NULL,
          display_name TEXT NOT NULL,
          avatar TEXT DEFAULT ''
        )
      `)
      console.log('Users table created')
    } else {
      console.log('Users table already exists, skipping')
    }
  }
}
