// Central permission registry.
//
// When porting to nuxt-blueprints, each block ships a `permissions.ts` fragment
// and blueprint assembly merges the fragments into this file. Consumer projects
// own this file and are free to edit it.
export const PERMISSIONS = [
  'users.view',
  'users.manage',
  'roles.view'
] as const

export type Permission = typeof PERMISSIONS[number]

// Optional: human-readable titles and descriptions shown in admin UI.
// Keys must match entries in PERMISSIONS. Missing entries fall back to the raw
// permission string.
export const PERMISSION_META: Record<string, { title: string; description: string }> = {
  'users.view': {
    title: 'View users',
    description: 'See the users list.'
  },
  'users.manage': {
    title: 'Manage users',
    description: 'Edit, delete, and assign roles to other users.'
  },
  'roles.view': {
    title: 'View roles',
    description: 'See the roles reference page.'
  }
}

export function isPermission(value: string): value is Permission {
  return (PERMISSIONS as readonly string[]).includes(value)
}
