# JWT Auth Block

JWT-based authentication with email verification, password reset, login/register pages, and user profile management.

This block also ships the **baseline roles-and-permissions system**: a `roles TEXT[]` column on users, static role definitions in `app/utils/role-definitions.ts`, a central `app/utils/permissions.ts` registry, server-side guards (`requireRole`, `requirePermission`), and a `usePermissions()` composable. By default it does little — there's no admin UI, only an `admin` and a `member` role, and no enforcement beyond what you write. The `admin` and `user-management` blocks add the UI; consumer projects extend the role/permission files to add their own.

## Dependencies

- `core` (users table, database, layouts)
- An email provider block (`core-email-smtp`, `core-email-mailgun`, or `core-email-ses`)
- `activity-log` (audit trail for auth events)
- `rate-limiting` (protects login, register, and forgot-password endpoints)

## Files Provided

```
app/composables/useAuth.ts
app/composables/usePermissions.ts
app/middleware/auth.ts
app/plugins/auth.client.ts
app/pages/login.vue
app/pages/register.vue
app/pages/reset-password.vue
app/pages/accept-invite.vue
app/pages/profile.vue
app/utils/permissions.ts
app/utils/role-definitions.ts
server/utils/auth.ts
server/utils/rbac.ts
server/api/auth/login.post.ts
server/api/auth/register.post.ts
server/api/auth/logout.post.ts
server/api/auth/me.get.ts
server/api/auth/verify.get.ts
server/api/auth/forgot-password.post.ts
server/api/auth/reset-password.post.ts
server/api/auth/verify-email-change.get.ts
server/api/auth/invite-info.get.ts
server/api/auth/accept-invite.post.ts
server/api/profile/name.patch.ts
server/api/profile/email.post.ts
server/api/profile/password.patch.ts
server/api/profile/account.delete.ts
server/database/schema.ts
migrations/002_add_auth_fields.ts
migrations/003_create_password_reset_table.ts
```

## Package Dependencies

```json
{
  "bcrypt": "^6.0.0",
  "jsonwebtoken": "^9.0.2"
}
```

devDependencies:
```json
{
  "@types/bcrypt": "^6.0.0",
  "@types/jsonwebtoken": "^9.0.10"
}
```

## Config

Add to `nuxt.config.ts` runtimeConfig:

```typescript
jwtSecret: process.env.JWT_SECRET || '',
```

## Environment Variables

```env
JWT_SECRET=your-super-secret-jwt-key-change-this
```

## Migrations

- `002_add_auth_fields.ts` — Adds password (nullable), verified, roles (text[]), token_key, token_expires_at, pending_email, email_change_token columns to the users table
- `003_create_password_reset_table.ts` — Creates the password_reset_requests table

## Database & Types

- `server/database/schema.ts` — Extends core's `UsersTable` with the auth columns and adds `PasswordResetRequestsTable`. Merge into the project's consolidated `server/database/schema.ts` during assembly.

## First-User Bootstrap

The first account registered on a fresh install (when the `users` table is empty) is automatically promoted by `register.post.ts`:

- `verified: true` — skips email verification
- `roles: ['admin']` — administrative access (subsequent registrations receive `roles: ['member']`)
- Auto-logged-in — the response sets the `auth-token` cookie and `useAuth.register()` redirects to `/dashboard` instead of showing the "check your email" message

The count-check, user insert, and audit log (`first_user_promoted`) all run inside a single transaction under a Postgres advisory lock (`pg_advisory_xact_lock`), so concurrent registrations at an empty DB can't both be promoted.

## Roles & Permissions (baseline)

This block ships a minimal but fully-wired RBAC foundation. Consumer projects own and edit these files freely:

- **`app/utils/permissions.ts`** — central `PERMISSIONS` constant + optional `PERMISSION_META` with human-readable titles/descriptions. Seed contents (granular by design — see `permissions-design.md` for why):
  - `admin.access` — gate for entering `/admin`
  - `users.view` — list users
  - `users.edit` — edit user attributes
  - `users.delete` — delete users
  - `users.assign-roles` — assign / revoke roles (subject to subset delegation)
  - `users.verify` — mark verified / resend verification email
  - `users.invite` — send invitation emails that let new users set a password and activate an account
  - `roles.view` — see the roles reference page
  - `roles.write` — create + edit custom roles
  - `roles.delete` — delete custom roles
- **`app/utils/role-definitions.ts`** — static `ROLES` map. Seed entries:
  - `admin` — every permission in the registry
  - `member` — no permissions (assigned to non-first registrations by default)
- **`server/utils/rbac.ts`** — resolver + guards: `getUserRoles`, `getRolePermissions(roleNames)`, `getUserPermissions(userId)`, `userHasRole`, `userHasPermission`, `requireRole(event, 'admin')`, `requirePermission(event, 'x.y')`, `validateRoleNames`. `getRolePermissions` is split out so callers (e.g. user-management's subset-delegation check) can resolve role-name lists without hitting the DB for a user lookup first.
- **`app/composables/usePermissions.ts`** — client helpers: `hasRole(name)`, `hasPermission(name)`, `isAdmin`.

`GET /api/auth/me` and `POST /api/auth/login` both return the user's resolved `permissions: string[]` alongside their `roles: string[]`, so client guards work without additional roundtrips.

Without the `admin` block, there's no admin UI — but `requireRole` / `requirePermission` are available for any custom route handler, and consumer projects can extend `PERMISSIONS` and `ROLES` to add their own access rules.

## Invite Flow

Admins can create new users by invitation instead of waiting for them to self-register. The invitee receives an email with a link to `/accept-invite?token=...`, picks a password (and optionally edits the display name the admin pre-filled), and is auto-logged-in on submit.

Storage model: pending invites live as rows in the `users` table, distinguished by `password IS NULL`. The existing `token_key` column doubles as the invite token; the new `token_expires_at` column gives both the invite link and the email-verification link a 7-day expiry.

User-state matrix:

| State | Condition |
|---|---|
| Active | `verified = true` |
| Not verified | `password IS NOT NULL AND verified = false` |
| Pending invite | `password IS NULL AND verified = false AND token_expires_at > now()` |
| Expired invite | `password IS NULL AND verified = false AND token_expires_at <= now()` |

Endpoints provided by this block:

- `GET /api/auth/invite-info?token=<token>` — public, returns `{ email, display_name }` for the accept page to pre-fill, 404 if not found, 410 if expired
- `POST /api/auth/accept-invite` — public, body `{ token, password, display_name }`, sets the password, marks the user verified, rotates `token_key`, issues the JWT cookie, logs both `invite_accepted` and a `LOGIN` event so the user appears in the admin "last login" column

The matching admin endpoint to *send* an invite (`POST /api/admin/users`) lives in the `user-management` block.

Login, password-change, email-change, and account-delete handlers all guard on `password === null` so a pending invitee can't authenticate against a row that hasn't accepted yet — and the leakage-safe response is "Invalid credentials," not a "your invite is pending" hint.

## Wiring Notes

When this block is included, modify the files provided by the `core` block:

**`app/layouts/default.vue`** — Add user display name and profile link to the header:
```vue
<script setup lang="ts">
const { user } = useAuth()
const config = useRuntimeConfig()
</script>
```
In the header-right slot, add before ThemeToggle:
```vue
<span class="text-(--ui-text-muted) text-sm hidden sm:inline">
  {{ user?.display_name || user?.email }}
</span>
<UButton to="/profile" variant="ghost" size="sm">
  Profile
</UButton>
```

**`app/pages/index.vue`** — Replace with auth-aware version that checks login status and shows login/register CTAs or redirects to dashboard.

**`app/pages/dashboard.vue`** — Add auth middleware:
```vue
<script setup lang="ts">
definePageMeta({
  middleware: 'auth'
})
</script>
```
