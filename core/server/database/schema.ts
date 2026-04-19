import type { ColumnType, Generated } from 'kysely'

export interface UsersTable {
  id: Generated<string>
  created: ColumnType<Date, string | undefined, string>
  updated: ColumnType<Date, string | undefined, string>
  email: string
  display_name: string
  avatar: Generated<string>
}

export interface Database {
  users: UsersTable
}
