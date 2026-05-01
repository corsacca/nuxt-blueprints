import { PERMISSIONS, type Permission } from './permissions'

export interface RoleDefinition {
  name: string
  description: string
  permissions: readonly Permission[]
}

export const ROLES = {
  admin: {
    name: 'Admin',
    description: 'Full access to all features and user management.',
    permissions: [...PERMISSIONS]
  },
  member: {
    name: 'Member',
    description: 'Basic authenticated access.',
    permissions: []
  }
} as const satisfies Record<string, RoleDefinition>

export type StaticRoleName = keyof typeof ROLES

export const STATIC_ROLE_NAMES = Object.keys(ROLES) as StaticRoleName[]

export type StaticRoleEntry = RoleDefinition & { key: StaticRoleName }

export const STATIC_ROLES: readonly StaticRoleEntry[] = (
  Object.entries(ROLES) as [StaticRoleName, RoleDefinition][]
).map(([key, def]) => ({ key, ...def }))

export function getStaticRole(name: string): RoleDefinition | null {
  return (ROLES as Record<string, RoleDefinition>)[name] ?? null
}

export function isStaticRole(name: string): name is StaticRoleName {
  return name in ROLES
}
