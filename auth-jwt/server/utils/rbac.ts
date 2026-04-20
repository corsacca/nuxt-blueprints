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

// Resolves a role name to the list of permissions it grants.
// v1: static-only. The optional custom-roles block extends this to fall back
// to the `custom_roles` table when the name is not a static role.
function resolveRolePermissions(roleName: string): readonly Permission[] {
  const role = getStaticRole(roleName)
  return role ? role.permissions : []
}

export async function getUserPermissions(userId: string): Promise<Set<Permission>> {
  const roles = await getUserRoles(userId)
  const set = new Set<Permission>()
  for (const roleName of roles) {
    for (const perm of resolveRolePermissions(roleName)) {
      set.add(perm)
    }
  }
  return set
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

// Validates that every entry in `roles` is a known role name.
// v1: only static roles are known. The optional custom-roles block extends
// this to also consult the `custom_roles` table.
export async function validateRoleNames(roles: string[]): Promise<{ valid: boolean; unknown: string[] }> {
  const known = new Set<string>(STATIC_ROLE_NAMES)
  const unknown = roles.filter(r => !known.has(r))
  return { valid: unknown.length === 0, unknown }
}

export { ROLES, STATIC_ROLE_NAMES }
