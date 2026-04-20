import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('activity_logs')
    .ifNotExists()
    .addColumn('id', 'uuid', col => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('timestamp', 'timestamptz', col => col.notNull().defaultTo(sql`now()`))
    .addColumn('event_type', 'text', col => col.notNull())
    .addColumn('table_name', 'text')
    .addColumn('record_id', 'text')
    .addColumn('user_id', 'uuid')
    .addColumn('user_agent', 'text')
    .addColumn('metadata', 'jsonb', col => col.defaultTo(sql`'{}'::jsonb`))
    .execute()

  await db.schema
    .createIndex('idx_activity_logs_timestamp')
    .ifNotExists()
    .on('activity_logs')
    .expression(sql`timestamp DESC`)
    .execute()

  await db.schema
    .createIndex('idx_activity_logs_user_id')
    .ifNotExists()
    .on('activity_logs')
    .column('user_id')
    .execute()

  await db.schema
    .createIndex('idx_activity_logs_event_type')
    .ifNotExists()
    .on('activity_logs')
    .column('event_type')
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('activity_logs').ifExists().execute()
}
