import { STATIC_ROLES } from '~~/app/utils/role-definitions'

export interface AssignableRole {
  key: string
  name: string
  description: string
  source: 'static' | 'custom'
  permissions: string[]
}

interface CustomRolesResponse {
  roles: { id: string; name: string; description: string; permissions: string[] }[]
}

// Replaces user-management's static-only version when custom-roles is included.
// Fetches DB-backed custom roles and appends them to the static set so the
// admin role-editor / invite UI shows everything in one list.
//
// `key` is the stable identifier stored in `users.roles[]`. For static roles
// it's the ROLES object key; for custom roles it's the role's name (custom
// roles are referenced by name in the DB — see the custom-roles delete flow).
export async function useAssignableRoles(): Promise<ComputedRef<AssignableRole[]>> {
  const { data } = await useFetch<CustomRolesResponse>('/api/admin/custom-roles', {
    default: () => ({ roles: [] })
  })

  return computed<AssignableRole[]>(() => [
    ...STATIC_ROLES.map(r => ({
      key: r.key,
      name: r.name,
      description: r.description,
      source: 'static' as const,
      permissions: [...r.permissions]
    })),
    ...(data.value?.roles ?? []).map(r => ({
      key: r.name,
      name: r.name,
      description: r.description,
      source: 'custom' as const,
      permissions: [...r.permissions]
    }))
  ])
}
