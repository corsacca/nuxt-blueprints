import { ROLES, type RoleDefinition } from '~~/app/utils/role-definitions'

export interface AssignableRole {
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
export async function useAssignableRoles(): Promise<ComputedRef<AssignableRole[]>> {
  const staticRoles = Object.values(ROLES) as RoleDefinition[]

  const { data } = await useFetch<CustomRolesResponse>('/api/admin/custom-roles', {
    default: () => ({ roles: [] })
  })

  return computed<AssignableRole[]>(() => [
    ...staticRoles.map(r => ({
      name: r.name,
      description: r.description,
      source: 'static' as const,
      permissions: [...r.permissions]
    })),
    ...(data.value?.roles ?? []).map(r => ({
      name: r.name,
      description: r.description,
      source: 'custom' as const,
      permissions: [...r.permissions]
    }))
  ])
}
