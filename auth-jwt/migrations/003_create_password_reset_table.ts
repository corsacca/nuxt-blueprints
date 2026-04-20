import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('password_reset_requests')
    .ifNotExists()
    .addColumn('id', 'uuid', col => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('created', 'timestamptz', col => col.notNull().defaultTo(sql`current_timestamp`))
    .addColumn('expires', 'timestamptz', col => col.notNull())
    .addColumn('user_id', 'uuid', col => col.notNull().references('users.id').onDelete('cascade'))
    .addColumn('token', 'text', col => col.notNull().unique())
    .addColumn('used', 'boolean', col => col.notNull().defaultTo(false))
    .execute()

  await db.schema
    .createIndex('password_reset_requests_token_idx')
    .unique()
    .on('password_reset_requests')
    .column('token')
    .execute()

  await db.schema
    .createIndex('password_reset_requests_user_id_idx')
    .on('password_reset_requests')
    .column('user_id')
    .execute()

  await db.schema
    .createIndex('password_reset_requests_expires_idx')
    .on('password_reset_requests')
    .column('expires')
    .execute()

  await db.schema
    .createIndex('password_reset_requests_used_idx')
    .on('password_reset_requests')
    .column('used')
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('password_reset_requests').ifExists().execute()
}
