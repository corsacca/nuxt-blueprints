import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('users')
    .ifNotExists()
    .addColumn('id', 'uuid', col => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('created', 'timestamptz', col => col.defaultTo(sql`now()`))
    .addColumn('updated', 'timestamptz', col => col.defaultTo(sql`now()`))
    .addColumn('email', 'text', col => col.unique().notNull())
    .addColumn('display_name', 'text', col => col.notNull())
    .addColumn('avatar', 'text', col => col.defaultTo(''))
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('users').ifExists().execute()
}
