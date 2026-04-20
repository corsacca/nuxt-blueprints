import { getRouterParam, getHeader } from 'h3'
import { db, sql } from '../../../utils/database'
import { requirePermission } from '../../../utils/rbac'
import { logEvent } from '../../../utils/activity-logger'

export default defineEventHandler(async (event) => {
  const admin = await requirePermission(event, 'roles.manage')

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Custom role id is required' })
  }

  const existing = await db
    .selectFrom('custom_roles')
    .select(['id', 'name', 'description', 'permissions'])
    .where('id', '=', id)
    .executeTakeFirst()
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Custom role not found' })
  }

  const assignedCountRow = await db
    .selectFrom('users')
    .select(eb => eb.fn.count<string>('id').as('count'))
    .where(sql<boolean>`${existing.name} = ANY(roles)`)
    .executeTakeFirst()
  const assignedCount = Number(assignedCountRow?.count ?? 0)

  await db.deleteFrom('custom_roles').where('id', '=', id).execute()

  await logEvent({
    eventType: 'admin_delete_custom_role',
    tableName: 'custom_roles',
    recordId: id,
    userId: admin.userId,
    userAgent: getHeader(event, 'user-agent') || undefined,
    metadata: {
      name: existing.name,
      description: existing.description,
      permissions: existing.permissions,
      users_affected: assignedCount
    }
  })

  return { success: true, users_affected: assignedCount }
})
