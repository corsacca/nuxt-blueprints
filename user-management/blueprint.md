# User Management Block

Admin UI for managing users: a paginated users list, a detail slideover for editing display name / role assignments / deleting the user, and a read-only roles reference page.

Built on top of the baseline RBAC shipped by `auth-jwt` (role definitions, permission registry, guards) and the admin shell from `admin` (layout, middleware, gate).

## Dependencies

- `core` (database)
- `auth-jwt` (roles, rbac.ts guards, role-definitions)
- `activity-log` (audit trail for user edits, deletes, role changes)
- `admin` (admin layout, middleware, nav)

## Files Provided

```
app/pages/admin/users.vue
app/pages/admin/roles.vue
server/api/admin/users.get.ts
server/api/admin/users/[id].patch.ts
server/api/admin/users/[id].delete.ts
server/api/admin/users/[id]/roles.put.ts
```

## Package Dependencies

None beyond what dependencies provide.

## Migrations

None.

## Database & Types

No schema changes.

## Routes & Endpoints

- `/admin/users` — paginated users list with search and sort, a row slideover for editing display name, assigning roles, and deleting
- `/admin/roles` — accordion view of every role (from `app/utils/role-definitions.ts`) with a per-permission granted / not-granted indicator and descriptions from `PERMISSION_META`
- `GET /api/admin/users` — paginated list, `requireRole('admin')`
- `PATCH /api/admin/users/[id]` — update display name, `requireRole('admin')`, audit-logged
- `DELETE /api/admin/users/[id]` — delete user + password reset records, `requireRole('admin')`, audit-logged, refuses to delete the caller or the last `admin`
- `PUT /api/admin/users/[id]/roles` — replace the user's `roles` array, `requireRole('admin')`, audit-logged, validates every role name against static (and, if installed, custom) role definitions, refuses to remove the last `admin`

## Wiring Notes

When this block is included, modify the file provided by `admin`:

---

### `app/layouts/admin.vue` — Add Users + Roles nav entries

Extend the `navItems` array from:

```typescript
const navItems = [
  { to: '/admin', label: 'Dashboard', icon: 'i-lucide-layout-dashboard' }
]
```

to:

```typescript
const navItems = [
  { to: '/admin', label: 'Dashboard', icon: 'i-lucide-layout-dashboard' },
  { to: '/admin/users', label: 'Users', icon: 'i-lucide-users' },
  { to: '/admin/roles', label: 'Roles', icon: 'i-lucide-shield' }
]
```

This is the only place you need to wire up — the new pages pick up the admin layout + middleware via `definePageMeta({ layout: 'admin', middleware: ['auth', 'admin'] })`.
