# Auth JWT Block

JWT-based authentication with email verification, password reset, and user profile management.

## What You Get

- Login, register, reset-password, and profile pages
- `useAuth` composable (login, register, logout, checkAuth)
- Auth middleware for protecting pages
- Server API routes for all auth flows
- Profile management (display name, email change, password change, account deletion)
- JWT token utilities with bcrypt password hashing

## Files

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
migrations/002_add_auth_fields.js
migrations/003_create_password_reset_table.js
```

## Environment Variables

```env
JWT_SECRET=your-super-secret-jwt-key-change-this
```

### Where to get `JWT_SECRET`

Generate a random secret. This is used to sign and verify JWT tokens. Run:

```bash
openssl rand -base64 32
```

Copy the output and use it as your `JWT_SECRET`. Use a different value for each environment (dev, staging, production).

### Where to put it

Add to `.env` in your project root:

```env
JWT_SECRET=<paste your generated secret>
```

## Dependencies

- `core` (users table, database, layouts)
- An email provider block (for verification and password reset emails)
- `activity-log` (audit trail for auth events)
- `rate-limiting` (protects login, register, and forgot-password endpoints)

## npm Packages

```
bcrypt ^6.0.0
jsonwebtoken ^9.0.2
```

Dev dependencies:
```
@types/bcrypt ^6.0.0
@types/jsonwebtoken ^9.0.10
```
