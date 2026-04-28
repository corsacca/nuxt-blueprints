import { ROLES, type RoleDefinition } from '~~/app/utils/role-definitions'

export interface AssignableRole {
  name: string
  description: string
  source: 'static' | 'custom'
  permissions: string[]
}

// Returns the roles available in the admin role-editor / invite UI.
// `custom-roles` ships a replacement that appends DB-backed roles. Keep the
// shape stable across both versions so consumers don't branch on the source.
export async function useAssignableRoles(): Promise<ComputedRef<AssignableRole[]>> {
  const staticRoles = Object.values(ROLES) as RoleDefinition[]

  return computed<AssignableRole[]>(() =>
    staticRoles.map(r => ({
      name: r.name,
      description: r.description,
      source: 'static' as const,
      permissions: [...r.permissions]
    }))
  )
}
