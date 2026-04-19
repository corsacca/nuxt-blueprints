import { Kysely } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('users')
    .addColumn('google_id', 'text', col => col.unique())
    .execute()

  await db.schema
    .createIndex('idx_users_google_id')
    .ifNotExists()
    .on('users')
    .column('google_id')
    .execute()

  await db.schema
    .alterTable('users')
    .alterColumn('password', col => col.dropNotNull())
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropIndex('idx_users_google_id').ifExists().execute()
  await db.schema.alterTable('users').dropColumn('google_id').execute()
  await db.schema
    .alterTable('users')
    .alterColumn('password', col => col.setNotNull())
    .execute()
}
