import type { Database as BaseDatabase, UsersTable as BaseUsersTable } from '~/server/database/schema'

export interface UsersTable extends Omit<BaseUsersTable, 'password'> {
  password: string | null
  firebase_uid: string | null
}

export interface Database extends Omit<BaseDatabase, 'users'> {
  users: UsersTable
}
