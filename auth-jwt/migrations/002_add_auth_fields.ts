import { Kysely, sql, type ColumnDefinitionBuilder } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('users')
    .addColumn('password', 'text')
    .addColumn('verified', 'boolean', col => col.defaultTo(false))
    .addColumn(
      'roles',
      sql`text[]`,
      (col: ColumnDefinitionBuilder) => col.notNull().defaultTo(sql`'{}'::text[]`)
    )
    .addColumn('token_key', 'uuid', col => col.defaultTo(sql`gen_random_uuid()`))
    .addColumn('token_expires_at', 'timestamptz')
    .addColumn('pending_email', 'text')
    .addColumn('email_change_token', 'uuid')
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('users')
    .dropColumn('password')
    .dropColumn('verified')
    .dropColumn('roles')
    .dropColumn('token_key')
    .dropColumn('token_expires_at')
    .dropColumn('pending_email')
    .dropColumn('email_change_token')
    .execute()
}
