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
}

export default class CreateActivityLogsTable extends BaseMigration {
  id = 4
  name = 'Create activity_logs table'

  async up(sql) {
    const activityLogsTableExists = await this.tableExists(sql, 'activity_logs')
    if (!activityLogsTableExists) {
      console.log('Creating activity_logs table...')
      await this.exec(sql, `
        CREATE TABLE activity_logs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          timestamp BIGINT NOT NULL,
          event_type TEXT NOT NULL,
          table_name TEXT,
          record_id TEXT,
          user_id UUID,
          user_agent TEXT,
          metadata JSONB DEFAULT '{}'::jsonb
        )
      `)
      console.log('Activity_logs table created')
    } else {
      console.log('Activity_logs table already exists, skipping')
    }

    console.log('Creating indexes...')

    await this.exec(sql, `
      CREATE INDEX IF NOT EXISTS idx_activity_logs_timestamp
      ON activity_logs(timestamp DESC)
    `)

    await this.exec(sql, `
      CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id
      ON activity_logs(user_id)
    `)

    await this.exec(sql, `
      CREATE INDEX IF NOT EXISTS idx_activity_logs_event_type
      ON activity_logs(event_type)
    `)

    console.log('Indexes created')
  }
}
