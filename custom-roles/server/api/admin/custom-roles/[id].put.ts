import { readBody, getRouterParam, getHeader } from 'h3'
import { db } from '../../../utils/database'
import { requirePermission } from '../../../utils/rbac'
import { logEvent } from '../../../utils/activity-logger'
import { isStaticRole } from '~~/app/utils/role-definitions'
import { isPermission } from '~~/app/utils/permissions'

export default defineEventHandler(async (event) => {
  const admin = await requirePermission(event, 'roles.manage')

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Custom role id is required' })
  }

  const body = await readBody(event)
  const hasName = typeof body?.name === 'string'
  const hasDescription = typeof body?.description === 'string'
  const hasPermissions = Array.isArray(body?.permissions)

  if (!hasName && !hasDescription && !hasPermissions) {
    throw createError({ statusCode: 400, statusMessage: 'Nothing to update' })
  }

  const existing = await db
    .selectFrom('custom_roles')
    .select(['id', 'name', 'description', 'permissions'])
    .where('id', '=', id)
    .executeTakeFirst()
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Custom role not found' })
  }

  const update: Record<string, unknown> = { updated: new Date().toISOString() }

  if (hasName) {
    const next = body.name.trim()
    if (next.length < 2) {
      throw createError({ statusCode: 400, statusMessage: 'Name must be at least 2 characters' })
    }
    if (next !== existing.name) {
      if (isStaticRole(next)) {
        throw createError({ statusCode: 409, statusMessage: `"${next}" is a built-in role name` })
      }
      const collision = await db
        .selectFrom('custom_roles')
        .select('id')
        .where('name', '=', next)
        .where('id', '!=', id)
        .executeTakeFirst()
      if (collision) {
        throw createError({ statusCode: 409, statusMessage: `A role named "${next}" already exists` })
      }
      update.name = next
    }
  }

  if (hasDescription) {
    update.description = body.description
  }

  if (hasPermissions) {
    if (body.permissions.some((p: unknown) => typeof p !== 'string')) {
      throw createError({ statusCode: 400, statusMessage: 'permissions must be an array of strings' })
    }
    const permissions = Array.from(new Set(body.permissions as string[]))
    const invalid = permissions.filter(p => !isPermission(p))
    if (invalid.length > 0) {
      throw createError({
        statusCode: 400,
        statusMessage: `Unknown permission(s): ${invalid.join(', ')}`
      })
    }
    update.permissions = permissions
  }

  const row = await db
    .updateTable('custom_roles')
    .set(update)
    .where('id', '=', id)
    .returning(['id', 'name', 'description', 'permissions', 'created', 'updated'])
    .executeTakeFirstOrThrow()

  await logEvent({
    eventType: 'admin_update_custom_role',
    tableName: 'custom_roles',
    recordId: id,
    userId: admin.userId,
    userAgent: getHeader(event, 'user-agent') || undefined,
    metadata: {
      from: { name: existing.name, description: existing.description, permissions: existing.permissions },
      to: { name: row.name, description: row.description, permissions: row.permissions }
    }
  })

  return { role: row }
})
