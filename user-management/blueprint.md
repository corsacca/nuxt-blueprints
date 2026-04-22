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
server/api/admin/users/[id]/verify.post.ts
server/api/admin/users/[id]/send-verification.post.ts
```

## Package Dependencies

None beyond what dependencies provide.

## Migrations

None.

## Database & Types

No schema changes.

## Routes & Endpoints

- `/admin/users` — paginated users list with search and sort, a row slideover for editing display name, assigning roles, managing verification, and deleting
- `/admin/roles` — accordion view of every role (from `app/utils/role-definitions.ts`) with a per-permission granted / not-granted indicator and descriptions from `PERMISSION_META`
- `GET /api/admin/users` — paginated list, `requireRole('admin')`
- `PATCH /api/admin/users/[id]` — update display name, `requireRole('admin')`, audit-logged
- `DELETE /api/admin/users/[id]` — delete user + password reset records, `requireRole('admin')`, audit-logged, refuses to delete the caller or the last `admin`
- `PUT /api/admin/users/[id]/roles` — replace the user's `roles` array, `requireRole('admin')`, audit-logged, validates every role name against static (and, if installed, custom) role definitions, refuses to remove the last `admin`
- `POST /api/admin/users/[id]/verify` — mark the user as verified without requiring them to click the verification link, `users.manage`, audit-logged
- `POST /api/admin/users/[id]/send-verification` — (re)send the verification email using the user's existing `token_key`, `users.manage`, audit-logged, 400s if already verified

## Wiring Notes

When this block is included, modify the file provided by `admin`:

---

### `app/layouts/admin.vue` — Add Users + Roles nav entries (permission-gated)

Replace the static `navItems` array with a computed that hides entries the current user can't use. At the top of `<script setup>`, add alongside the existing `useAuth` call:

```typescript
const { hasPermission } = usePermissions()
```

Then replace:

```typescript
const navItems = [
  { to: '/admin', label: 'Dashboard', icon: 'i-lucide-layout-dashboard' }
]
```

with:

```typescript
const navItems = computed(() => [
  { to: '/admin', label: 'Dashboard', icon: 'i-lucide-layout-dashboard' },
  ...(hasPermission('users.view')
    ? [{ to: '/admin/users', label: 'Users', icon: 'i-lucide-users' }]
    : []),
  ...(hasPermission('roles.view')
    ? [{ to: '/admin/roles', label: 'Roles', icon: 'i-lucide-shield' }]
    : [])
])
```

The new pages pick up the admin layout + middleware via `definePageMeta({ layout: 'admin', middleware: ['auth', 'admin'] })`.

## Gate Model

All endpoints use specific permission guards from `auth-jwt`'s `server/utils/rbac.ts` instead of a blanket `requireRole('admin')`:

| Endpoint | Guard |
|---|---|
| `GET /api/admin/users` | `users.view` |
| `PATCH /api/admin/users/[id]` | `users.manage` |
| `DELETE /api/admin/users/[id]` | `users.manage` |
| `PUT /api/admin/users/[id]/roles` | `users.manage` + **subset delegation** |
| `POST /api/admin/users/[id]/verify` | `users.manage` |
| `POST /api/admin/users/[id]/send-verification` | `users.manage` |

### Subset Delegation

`PUT /api/admin/users/[id]/roles` enforces a subset rule: for every role being added or removed, the assigner must already hold every permission that role grants. Prevents any user with `users.manage` (but without the full `admin` role) from escalating privileges via role assignment.

Implementation uses `getRolePermissions` + `getUserPermissions` from `auth-jwt`'s `server/utils/rbac.ts`.

### UI ripple effects

- Users list page (`/admin/users`) disables row clicks when the viewer lacks `users.manage` — the slideover (which contains edit / delete / role-assignment controls) only opens when the viewer can act on it.
- Inside the role-editor section of the slideover, any role whose permissions aren't a subset of the viewer's gets a disabled checkbox with a tooltip listing the missing permissions and a "Cannot assign" badge.
- `/admin/roles` reference page displays **static roles only**. The optional `custom-roles` block ships a replacement that adds a DB-backed custom-roles section with create/edit/delete.
