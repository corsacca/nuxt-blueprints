import { Kysely } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('users')
    .addColumn('firebase_uid', 'text', col => col.unique())
    .execute()

  await db.schema
    .createIndex('idx_users_firebase_uid')
    .ifNotExists()
    .on('users')
    .column('firebase_uid')
    .execute()

  await db.schema
    .alterTable('users')
    .alterColumn('password', col => col.dropNotNull())
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropIndex('idx_users_firebase_uid').ifExists().execute()
  await db.schema.alterTable('users').dropColumn('firebase_uid').execute()
  await db.schema
    .alterTable('users')
    .alterColumn('password', col => col.setNotNull())
    .execute()
}
