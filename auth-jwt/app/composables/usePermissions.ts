import type { Permission } from '~~/app/utils/permissions'

export const usePermissions = () => {
  const { user } = useAuth()

  const roles = computed<string[]>(() => user.value?.roles ?? [])
  const permissions = computed<string[]>(() => user.value?.permissions ?? [])

  const hasRole = (name: string) => roles.value.includes(name)
  const hasPermission = (name: Permission | string) => permissions.value.includes(name)
  const isAdmin = computed(() => hasRole('admin'))

  return {
    roles,
    permissions,
    hasRole,
    hasPermission,
    isAdmin
  }
}
