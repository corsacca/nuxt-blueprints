# JWT Auth Block

JWT-based authentication with email verification, password reset, login/register pages, and user profile management.

## Dependencies

- `core` (users table, database, layouts)
- An email provider block (`core-email-smtp`, `core-email-mailgun`, or `core-email-ses`)
- `activity-log` (audit trail for auth events)
- `rate-limiting` (protects login, register, and forgot-password endpoints)

## Files Provided

```
app/composables/useAuth.ts
app/middleware/auth.ts
app/plugins/auth.client.ts
app/pages/login.vue
app/pages/register.vue
app/pages/reset-password.vue
app/pages/profile.vue
server/utils/auth.ts
server/api/auth/login.post.ts
server/api/auth/register.post.ts
server/api/auth/logout.post.ts
server/api/auth/me.get.ts
server/api/auth/verify.get.ts
server/api/auth/forgot-password.post.ts
server/api/auth/reset-password.post.ts
server/api/auth/verify-email-change.get.ts
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

- `002_add_auth_fields.ts` — Adds password, verified, superadmin, token_key, email_visibility, pending_email, email_change_token columns to the users table
- `003_create_password_reset_table.ts` — Creates the password_reset_requests table

## Database & Types

- `server/database/schema.ts` — Extends core's `UsersTable` with the auth columns and adds `PasswordResetRequestsTable`. Merge into the project's consolidated `server/database/schema.ts` during assembly.

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
