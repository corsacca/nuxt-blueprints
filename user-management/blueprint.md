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
server/api/admin/users/index.post.ts
server/api/admin/users/[id].patch.ts
server/api/admin/users/[id].delete.ts
server/api/admin/users/[id]/roles.put.ts
server/api/admin/users/[id]/verify.post.ts
server/api/admin/users/[id]/send-verification.post.ts
server/api/admin/users/[id]/resend-invite.post.ts
```

## Package Dependencies

None beyond what dependencies provide.

## Migrations

None.

## Database & Types

No schema changes.

## Routes & Endpoints

- `/admin/users` — paginated users list with status badges (Active / Not verified / Pending invite / Expired invite), search and sort, an "Invite user" button in the header, and a row slideover for editing display name, assigning roles, managing verification, resending invites, and deleting
- `/admin/roles` — accordion view of every role (from `app/utils/role-definitions.ts`) with a per-permission granted / not-granted indicator and descriptions from `PERMISSION_META`
- `GET /api/admin/users` — paginated list with computed `status` field, `users.view`
- `POST /api/admin/users` — invite a new user (body: `email`, `display_name`, `roles[]`), `users.invite` + subset delegation, audit-logged as `invite_sent`, sends the `invite` email
- `PATCH /api/admin/users/[id]` — update display name, `users.edit`, audit-logged
- `DELETE /api/admin/users/[id]` — delete user + password reset records (also the cancel-invite path for pending/expired invites), `users.delete`, audit-logged, refuses to delete the caller or the last `admin`
- `PUT /api/admin/users/[id]/roles` — replace the user's `roles` array, `users.assign-roles` + subset delegation, audit-logged, refuses to remove the last `admin`
- `POST /api/admin/users/[id]/verify` — mark the user as verified without requiring them to click the verification link, `users.verify`, audit-logged
- `POST /api/admin/users/[id]/send-verification` — rotate `token_key`, reset `token_expires_at` to +7 days, and resend the verification email, `users.verify`, audit-logged. Rejects users who haven't accepted their invite yet (use `/resend-invite` for those).
- `POST /api/admin/users/[id]/resend-invite` — rotate `token_key`, reset `token_expires_at` to +7 days, and resend the invite email, `users.invite`, audit-logged. Rejects already-verified users and self-registered users (use `/send-verification` for those).

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
| `POST /api/admin/users` | `users.invite` + **subset delegation** |
| `PATCH /api/admin/users/[id]` | `users.edit` |
| `DELETE /api/admin/users/[id]` | `users.delete` |
| `PUT /api/admin/users/[id]/roles` | `users.assign-roles` + **subset delegation** |
| `POST /api/admin/users/[id]/verify` | `users.verify` |
| `POST /api/admin/users/[id]/send-verification` | `users.verify` |
| `POST /api/admin/users/[id]/resend-invite` | `users.invite` |

### Subset Delegation

`PUT /api/admin/users/[id]/roles` and `POST /api/admin/users` (invite) both enforce a subset rule: for every role being assigned, added, or removed, the caller must already hold every permission that role grants. Prevents any user with `users.assign-roles` or `users.invite` (but without the full `admin` role) from escalating privileges via role assignment or by inviting a new admin.

Implementation uses `getRolePermissions` + `getUserPermissions` from `auth-jwt`'s `server/utils/rbac.ts`.

### UI ripple effects

- Users list page (`/admin/users`) disables row clicks when the viewer holds none of `users.edit` / `users.delete` / `users.assign-roles` / `users.verify` / `users.invite` — the slideover only opens when the viewer can act on the user. Inside the slideover each section (Edit details, verify buttons, Resend invite, Roles editor, Delete action) is hidden unless the viewer holds the matching granular permission.
- The "Invite user" button in the page header is hidden unless the viewer holds `users.invite`. The invite modal reuses the same role-checkbox UI as the slideover (subject to subset delegation).
- The status badge in the slideover hero shows different action buttons depending on state: `not_verified` users get "Mark verified" + "Resend email"; `pending_invite` and `expired_invite` users get "Resend invite"; `active` users get no action.
- Inside the role-editor section of the slideover, any role whose permissions aren't a subset of the viewer's gets a disabled checkbox with a tooltip listing the missing permissions and a "Cannot assign" badge.
- `/admin/roles` reference page displays **static roles only**. The optional `custom-roles` block ships a replacement that adds a DB-backed custom-roles section with create/edit/delete.
