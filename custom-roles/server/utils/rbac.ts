import type { H3Event } from 'h3'
import { db } from './database'
import { requireAuth } from './auth'
import { getStaticRole, ROLES, STATIC_ROLE_NAMES } from '~~/app/utils/role-definitions'
import type { Permission } from '~~/app/utils/permissions'

export async function getUserRoles(userId: string): Promise<string[]> {
  const row = await db
    .selectFrom('users')
    .select('roles')
    .where('id', '=', userId)
    .executeTakeFirst()

  return row?.roles ?? []
}

// Resolves a list of role names to the union of permissions they grant.
// Static definitions win; names that aren't static fall back to the DB-backed
// `custom_roles` table. Unknown names silently contribute no permissions.
export async function getRolePermissions(roleNames: readonly string[]): Promise<Set<Permission>> {
  if (roleNames.length === 0) return new Set()

  const set = new Set<Permission>()
  const unknownNames: string[] = []

  for (const roleName of roleNames) {
    const staticRole = getStaticRole(roleName)
    if (staticRole) {
      for (const perm of staticRole.permissions) set.add(perm)
    } else {
      unknownNames.push(roleName)
    }
  }

  if (unknownNames.length > 0) {
    const customRows = await db
      .selectFrom('custom_roles')
      .select('permissions')
      .where('name', 'in', unknownNames)
      .execute()
    for (const row of customRows) {
      for (const perm of row.permissions) set.add(perm as Permission)
    }
  }

  return set
}

export async function getUserPermissions(userId: string): Promise<Set<Permission>> {
  const roles = await getUserRoles(userId)
  return getRolePermissions(roles)
}

export async function userHasRole(userId: string, roleName: string): Promise<boolean> {
  const roles = await getUserRoles(userId)
  return roles.includes(roleName)
}

export async function userHasPermission(userId: string, permission: Permission): Promise<boolean> {
  const perms = await getUserPermissions(userId)
  return perms.has(permission)
}

export async function requireRole(event: H3Event, roleName: string) {
  const authUser = requireAuth(event)
  const ok = await userHasRole(authUser.userId, roleName)
  if (!ok) {
    throw createError({ statusCode: 403, statusMessage: `Role required: ${roleName}` })
  }
  return authUser
}

export async function requirePermission(event: H3Event, permission: Permission) {
  const authUser = requireAuth(event)
  const ok = await userHasPermission(authUser.userId, permission)
  if (!ok) {
    throw createError({ statusCode: 403, statusMessage: `Permission required: ${permission}` })
  }
  return authUser
}

// Validates that every entry in `roles` is a known role name. Checks static
// definitions first, then the `custom_roles` table for any remaining names.
export async function validateRoleNames(roles: string[]): Promise<{ valid: boolean; unknown: string[] }> {
  const staticKnown = new Set<string>(STATIC_ROLE_NAMES)
  const unknownAfterStatic = roles.filter(r => !staticKnown.has(r))
  if (unknownAfterStatic.length === 0) {
    return { valid: true, unknown: [] }
  }

  const customRows = await db
    .selectFrom('custom_roles')
    .select('name')
    .where('name', 'in', unknownAfterStatic)
    .execute()
  const customKnown = new Set(customRows.map(r => r.name))
  const unknown = unknownAfterStatic.filter(r => !customKnown.has(r))
  return { valid: unknown.length === 0, unknown }
}

export { ROLES, STATIC_ROLE_NAMES }
