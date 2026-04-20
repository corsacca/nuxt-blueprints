import type { ColumnType, Generated } from 'kysely'
import type { Database as BaseDatabase } from '~/server/database/schema'

export interface CustomRolesTable {
  id: Generated<string>
  created: ColumnType<Date, string | undefined, string>
  updated: ColumnType<Date, string | undefined, string>
  name: string
  description: Generated<string>
  permissions: Generated<string[]>
}

export interface Database extends BaseDatabase {
  custom_roles: CustomRolesTable
}
