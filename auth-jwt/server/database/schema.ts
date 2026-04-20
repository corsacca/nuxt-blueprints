import type { ColumnType, Generated } from 'kysely'
import type { Database as BaseDatabase, UsersTable as BaseUsersTable } from '~/server/database/schema'

export interface UsersTable extends BaseUsersTable {
  password: Generated<string>
  verified: Generated<boolean>
  roles: Generated<string[]>
  token_key: Generated<string>
  pending_email: string | null
  email_change_token: string | null
}

export interface PasswordResetRequestsTable {
  id: Generated<string>
  created: ColumnType<Date, string | undefined, string>
  expires: ColumnType<Date, string, string>
  user_id: string
  token: string
  used: Generated<boolean>
}

export interface Database extends Omit<BaseDatabase, 'users'> {
  users: UsersTable
  password_reset_requests: PasswordResetRequestsTable
}
