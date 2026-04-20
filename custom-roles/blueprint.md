# Custom Roles Block

Optional extension of the baseline RBAC. Adds a DB-backed `custom_roles` table so admins can create, edit, and delete roles at runtime without editing `app/utils/role-definitions.ts`.

Role names in the consumer app can now resolve against **static definitions first, then the `custom_roles` table**. Users are assigned custom roles by name via the same `users.roles TEXT[]` column they already use for static ones.

## Dependencies

- `core` (database)
- `auth-jwt` (baseline RBAC: permissions, role-definitions, rbac.ts, usePermissions)
- `activity-log` (audit trail for custom-role CRUD)
- `admin` (layout, middleware)
- `user-management` (users page + roles reference page this block extends)

## Files Provided

```
app/pages/admin/roles.vue                                       (REPLACES user-management)
app/pages/admin/users.vue                                       (REPLACES user-management)
server/utils/rbac.ts                                            (REPLACES auth-jwt)
server/database/schema.ts
server/api/admin/custom-roles/index.get.ts
server/api/admin/custom-roles/index.post.ts
server/api/admin/custom-roles/[id].put.ts
server/api/admin/custom-roles/[id].delete.ts
migrations/006_create_custom_roles.ts
```

Three files in this block **replace** files from earlier-processed blocks when assembled:

- `app/pages/admin/roles.vue` replaces `user-management`'s version with one that has Built-in / Custom sections, a "Create role" button, and inline edit/delete modals.
- `app/pages/admin/users.vue` replaces `user-management`'s version with one that fetches `/api/admin/custom-roles` and merges custom roles into the role editor.
- `server/utils/rbac.ts` replaces `auth-jwt`'s version with one whose `getRolePermissions` / `validateRoleNames` fall back to the `custom_roles` table for role names not found in static definitions.

At assembly time the later `cp` overwrites the earlier one — make sure `custom-roles` is processed after `auth-jwt` and `user-management`.

## Package Dependencies

None beyond what the dependencies already provide.

## Migrations

- `006_create_custom_roles.ts` — Creates the `custom_roles` table: `id UUID PK`, `created/updated timestamptz`, `name TEXT UNIQUE`, `description TEXT`, `permissions TEXT[]`.

At assembly time this becomes the next sequential migration after whatever the selected blocks produce (typically 006 — after auth-jwt's 002/003, activity-log's 004, and the auth-google/auth-firebase slot at 005).

## Database & Types

- `server/database/schema.ts` — Appends `CustomRolesTable` to the project's consolidated `Database` interface. Merge in during assembly after `auth-jwt`, `activity-log`, and any social auth block.

## Routes & Endpoints

- `GET /api/admin/custom-roles` — list all custom roles, `requirePermission('roles.view')`
- `POST /api/admin/custom-roles` — create, `requirePermission('roles.manage')`. Rejects (409) if the name collides with any static role or existing custom role. Rejects (400) if permissions contain unknown strings.
- `PUT /api/admin/custom-roles/[id]` — update name / description / permissions, `requirePermission('roles.manage')`. Same validation as POST.
- `DELETE /api/admin/custom-roles/[id]` — delete, `requirePermission('roles.manage')`. Reports `users_affected` count in the response. Users who had this role keep the name in their `users.roles` array; it silently resolves to no permissions until reassigned.

All endpoints audit-logged.

## UI

- `/admin/roles` now splits into two sections:
  - **Built-in** — read-only accordion from `app/utils/role-definitions.ts` (existing view from `user-management`)
  - **Custom** — accordion with edit / delete buttons per row, plus a "Create role" header button. Modal for create/edit has name + description + permissions checkboxes grouped by resource.
- `/admin/users` role editor now includes custom roles alongside static ones, each with a "Custom" badge. Subset-delegation rule from `user-management` still applies — any role whose permissions aren't a subset of the viewer's is disabled with a tooltip.

## Name Collisions

Custom role names must be distinct from static role names (e.g., you cannot create a custom role named `admin` or `member`). Enforced at both the DB (UNIQUE constraint on `name`) and the API (explicit `isStaticRole` check before insert/update).

## Wiring Notes

None — this block's files replace the earlier versions outright. No in-place edits to other blocks.

## Orphaned Role References

When a custom role is deleted, users still carry the role name in their `users.roles TEXT[]` array. These references silently resolve to no permissions until the admin reassigns the user or recreates a role with the same name. The delete endpoint reports `users_affected` so the admin can follow up.
