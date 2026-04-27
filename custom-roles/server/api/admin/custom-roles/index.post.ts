import { readBody, getHeader } from 'h3'
import { db } from '../../../utils/database'
import { requirePermission } from '../../../utils/rbac'
import { logEvent } from '../../../utils/activity-logger'
import { isStaticRole } from '~~/app/utils/role-definitions'
import { isPermission } from '~~/app/utils/permissions'

export default defineEventHandler(async (event) => {
  const admin = await requirePermission(event, 'roles.write')

  const body = await readBody(event)
  const rawName = typeof body?.name === 'string' ? body.name.trim() : ''
  const rawDescription = typeof body?.description === 'string' ? body.description : ''
  const rawPermissions = Array.isArray(body?.permissions) ? body.permissions : null

  if (rawName.length < 2) {
    throw createError({ statusCode: 400, statusMessage: 'Name must be at least 2 characters' })
  }

  if (isStaticRole(rawName)) {
    throw createError({
      statusCode: 409,
      statusMessage: `"${rawName}" is a built-in role name`
    })
  }

  if (!rawPermissions || rawPermissions.some((p: unknown) => typeof p !== 'string')) {
    throw createError({ statusCode: 400, statusMessage: 'permissions must be an array of strings' })
  }

  const permissions = Array.from(new Set(rawPermissions as string[]))
  const invalid = permissions.filter(p => !isPermission(p))
  if (invalid.length > 0) {
    throw createError({
      statusCode: 400,
      statusMessage: `Unknown permission(s): ${invalid.join(', ')}`
    })
  }

  const collision = await db
    .selectFrom('custom_roles')
    .select('id')
    .where('name', '=', rawName)
    .executeTakeFirst()
  if (collision) {
    throw createError({ statusCode: 409, statusMessage: `A role named "${rawName}" already exists` })
  }

  const now = new Date().toISOString()
  const row = await db
    .insertInto('custom_roles')
    .values({
      created: now,
      updated: now,
      name: rawName,
      description: rawDescription,
      permissions
    })
    .returning(['id', 'name', 'description', 'permissions', 'created', 'updated'])
    .executeTakeFirstOrThrow()

  await logEvent({
    eventType: 'admin_create_custom_role',
    tableName: 'custom_roles',
    recordId: row.id,
    userId: admin.userId,
    userAgent: getHeader(event, 'user-agent') || undefined,
    metadata: { name: row.name, permissions: row.permissions }
  })

  return { role: row }
})
