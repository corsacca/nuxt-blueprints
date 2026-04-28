import type { ColumnType, Generated } from 'kysely'
import type { Database as BaseDatabase, UsersTable as BaseUsersTable } from '~/server/database/schema'

export interface UsersTable extends BaseUsersTable {
  password: ColumnType<string | null, string | null | undefined, string | null>
  verified: Generated<boolean>
  roles: Generated<string[]>
  token_key: Generated<string>
  token_expires_at: ColumnType<Date | null, Date | string | null | undefined, Date | string | null>
  pending_email: string | null
  email_change_token: string | null
}

export interface PasswordResetRequestsTable {
  id: Generated<string>
  created: ColumnType<Date, Date | string | undefined, Date | string>
  expires: ColumnType<Date, Date | string, Date | string>
  user_id: string
  token: string
  used: Generated<boolean>
}

export interface Database extends Omit<BaseDatabase, 'users'> {
  users: UsersTable
  password_reset_requests: PasswordResetRequestsTable
}
