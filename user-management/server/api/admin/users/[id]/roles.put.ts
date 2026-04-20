import { readBody, getRouterParam, getHeader } from 'h3'
import { db, sql } from '../../../../utils/database'
import { requireRole, validateRoleNames } from '../../../../utils/rbac'
import { logEvent } from '../../../../utils/activity-logger'

export default defineEventHandler(async (event) => {
  const admin = await requireRole(event, 'admin')

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'User id is required' })
  }

  const body = await readBody(event)
  const input = Array.isArray(body?.roles) ? body.roles : null
  if (!input || input.some((r: unknown) => typeof r !== 'string')) {
    throw createError({ statusCode: 400, statusMessage: 'roles must be an array of strings' })
  }

  const roles = Array.from(new Set(input as string[]))

  const { valid, unknown } = await validateRoleNames(roles)
  if (!valid) {
    throw createError({
      statusCode: 400,
      statusMessage: `Unknown role(s): ${unknown.join(', ')}`
    })
  }

  const existing = await db
    .selectFrom('users')
    .select(['id', 'roles'])
    .where('id', '=', id)
    .executeTakeFirst()

  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'User not found' })
  }

  const prior = existing.roles
  const priorSet = new Set(prior)
  const nextSet = new Set(roles)
  const removed = prior.filter(r => !nextSet.has(r))
  const added = roles.filter(r => !priorSet.has(r))

  if (added.length === 0 && removed.length === 0) {
    return { user: { id: existing.id, roles: prior } }
  }

  // Prevent removing the last admin in the system.
  if (priorSet.has('admin') && !nextSet.has('admin')) {
    const countRow = await db
      .selectFrom('users')
      .select(eb => eb.fn.count<string>('id').as('count'))
      .where(sql<boolean>`'admin' = ANY(roles)`)
      .executeTakeFirst()

    const adminCount = Number(countRow?.count ?? 0)
    if (adminCount <= 1) {
      throw createError({ statusCode: 409, statusMessage: 'Cannot remove the last admin' })
    }
  }

  await db
    .updateTable('users')
    .set({ roles, updated: new Date().toISOString() })
    .where('id', '=', id)
    .execute()

  await logEvent({
    eventType: 'admin_update_user_roles',
    tableName: 'users',
    recordId: id,
    userId: admin.userId,
    userAgent: getHeader(event, 'user-agent') || undefined,
    metadata: { from: prior, to: roles, added, removed }
  })

  return { user: { id, roles } }
})
