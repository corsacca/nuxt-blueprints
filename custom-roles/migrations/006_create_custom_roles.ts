import { Kysely, sql, type ColumnDefinitionBuilder } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('custom_roles')
    .ifNotExists()
    .addColumn('id', 'uuid', col => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('created', 'timestamptz', col => col.defaultTo(sql`now()`))
    .addColumn('updated', 'timestamptz', col => col.defaultTo(sql`now()`))
    .addColumn('name', 'text', col => col.notNull().unique())
    .addColumn('description', 'text', col => col.notNull().defaultTo(''))
    .addColumn(
      'permissions',
      sql`text[]`,
      (col: ColumnDefinitionBuilder) => col.notNull().defaultTo(sql`'{}'::text[]`)
    )
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('custom_roles').ifExists().execute()
}
