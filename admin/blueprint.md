# Admin Block

Minimal admin-area shell: a gated `/admin/*` layout, page-level middleware that redirects non-admins, and an empty dashboard page at `/admin`.

The gate uses the `admin.access` permission from the baseline RBAC shipped by `auth-jwt`. Users with the static `admin` role automatically have it; users with custom roles granted `admin.access` can also enter the admin area. Without this block, consumer projects can still use `requireRole(event, 'admin')` or `requirePermission(event, 'admin.access')` in their own handlers — this block just gives you a consistent admin UI scaffold to hang routes off of.

This block is deliberately small. Other admin-area blocks (`user-management`, future: `custom-roles`, etc.) add pages + nav entries on top via wiring notes.

## Dependencies

- `core` (layouts, Nuxt UI)
- `auth-jwt` (auth + the `admin` role)

## Files Provided

```
app/layouts/admin.vue
app/middleware/admin.ts
app/pages/admin/index.vue
```

## Package Dependencies

None beyond what `core` + `auth-jwt` provide.

## Migrations

None.

## Database & Types

No schema changes.

## How It's Gated

`app/middleware/admin.ts` runs `useAuth()` / `checkAuth()` and redirects the user to `/` if their resolved `permissions` array does not include `'admin.access'`. Apply it on any `/admin/*` page via `definePageMeta({ middleware: ['auth', 'admin'] })`.

Server-side guards live in `auth-jwt`'s `server/utils/rbac.ts` — use `await requirePermission(event, 'x.y')` at the top of any admin API handler (or `requireRole(event, 'roleName')` when a role-level check is more natural).

## Extending the Admin Nav

The layout at `app/layouts/admin.vue` exposes a `navItems` array. Other blocks extend it by adding entries through wiring notes in their own `blueprint.md`. For example, `user-management` adds:

```typescript
{ to: '/admin/users', label: 'Users', icon: 'i-lucide-users' },
{ to: '/admin/roles', label: 'Roles', icon: 'i-lucide-shield' }
```

Follow the same pattern for new admin blocks: document the `navItems` addition in your block's `blueprint.md`.

## Wiring Notes

None. This block doesn't modify files from other blocks.
