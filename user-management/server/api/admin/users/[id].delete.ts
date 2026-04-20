import { getRouterParam, getHeader } from 'h3'
import { db, sql } from '../../../utils/database'
import { requirePermission } from '../../../utils/rbac'
import { logEvent } from '../../../utils/activity-logger'

export default defineEventHandler(async (event) => {
  const admin = await requirePermission(event, 'users.manage')

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'User id is required' })
  }

  if (id === admin.userId) {
    throw createError({ statusCode: 400, statusMessage: 'You cannot delete your own account' })
  }

  const target = await db
    .selectFrom('users')
    .select(['id', 'email', 'display_name', 'roles'])
    .where('id', '=', id)
    .executeTakeFirst()

  if (!target) {
    throw createError({ statusCode: 404, statusMessage: 'User not found' })
  }

  if (target.roles.includes('admin')) {
    const countRow = await db
      .selectFrom('users')
      .select(eb => eb.fn.count<string>('id').as('count'))
      .where(sql<boolean>`'admin' = ANY(roles)`)
      .executeTakeFirst()

    const adminCount = Number(countRow?.count ?? 0)
    if (adminCount <= 1) {
      throw createError({ statusCode: 409, statusMessage: 'Cannot delete the last admin' })
    }
  }

  await db.transaction().execute(async (trx) => {
    await trx.deleteFrom('password_reset_requests').where('user_id', '=', id).execute()
    await trx.deleteFrom('users').where('id', '=', id).execute()
  })

  await logEvent({
    eventType: 'admin_delete_user',
    tableName: 'users',
    recordId: id,
    userId: admin.userId,
    userAgent: getHeader(event, 'user-agent') || undefined,
    metadata: {
      email: target.email,
      display_name: target.display_name,
      roles: target.roles
    }
  })

  return { success: true }
})
