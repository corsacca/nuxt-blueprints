import { STATIC_ROLES } from '~~/app/utils/role-definitions'

export interface AssignableRole {
  key: string
  name: string
  description: string
  source: 'static' | 'custom'
  permissions: string[]
}

// Returns the roles available in the admin role-editor / invite UI.
// `custom-roles` ships a replacement that appends DB-backed roles. Keep the
// shape stable across both versions so consumers don't branch on the source.
//
// `key` is the stable identifier used for storage/matching (the value stored
// in `users.roles[]` and validated by the server). `name` is the free-form
// display label and may be edited without breaking matching.
export async function useAssignableRoles(): Promise<ComputedRef<AssignableRole[]>> {
  return computed<AssignableRole[]>(() =>
    STATIC_ROLES.map(r => ({
      key: r.key,
      name: r.name,
      description: r.description,
      source: 'static' as const,
      permissions: [...r.permissions]
    }))
  )
}
