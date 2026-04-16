# Blocks

## core (always)

Database, theming, Nuxt UI customizations, layouts, and base user model.

```
app/components/ThemeToggle.vue
app/composables/useTheme.ts
app/layouts/auth.vue
app/layouts/default.vue
app/pages/dashboard.vue
app/pages/index.vue
migrations/001_create_users_table.js
scripts/migrate.mjs
server/utils/database.ts
```

Also modifies: `app.vue`, `main.css`, `nuxt.config.ts`, `package.json`

---

## auth-jwt (default)

JWT authentication with email verification, password reset, login/register pages, and user profile.

```
app/composables/useAuth.ts
app/middleware/auth.ts
app/pages/login.vue
app/pages/profile.vue
app/pages/register.vue
app/pages/reset-password.vue
app/plugins/auth.client.ts
migrations/002_add_auth_fields.js
migrations/003_create_password_reset_table.js
server/api/auth/forgot-password.post.ts
server/api/auth/login.post.ts
server/api/auth/logout.post.ts
server/api/auth/me.get.ts
server/api/auth/register.post.ts
server/api/auth/reset-password.post.ts
server/api/auth/verify-email-change.get.ts
server/api/auth/verify.get.ts
server/api/profile/account.delete.ts
server/api/profile/email.post.ts
server/api/profile/name.patch.ts
server/api/profile/password.patch.ts
server/utils/auth.ts
```

Also modifies: `default.vue` (adds user info to header), `index.vue` (adds auth-aware landing), `dashboard.vue` (adds auth middleware)

---

## email/ (choose one provider)

Shared files (included with any provider):

```
email/shared/server/utils/email-templates.ts
```

### email/smtp (default)

SMTP email transport. Uses MailHog in development.

```
email/smtp/server/utils/email.ts
```

### email/mailgun

Mailgun HTTP API email transport.

```
email/mailgun/server/utils/email.ts
```

### email/ses

AWS SES email transport.

```
email/ses/server/utils/email.ts
```

---

## activity-log (default)

Database-backed audit trail for user actions.

```
migrations/004_create_activity_logs_table.js
server/utils/activity-logger.ts
```

---

## rate-limiting/ (choose one strategy)

### rate-limiting/db (default)

Database-backed rate limiting. Queries activity_logs table. Persists across restarts.

```
rate-limiting/db/server/utils/rate-limit.ts
```

### rate-limiting/memory

In-memory rate limiting. No DB dependency. Resets on server restart.

```
rate-limiting/memory/server/utils/rate-limit.ts
```

---

## auth-google (optional)

Google OAuth sign-in via Google Identity Services. Adds "Sign in with Google" to login and register pages.

```
app/composables/useGoogleAuth.ts
server/api/auth/google.post.ts
migrations/005_add_google_auth.js
```

Also modifies: `login.vue` (adds Google button), `register.vue` (adds Google button), `profile.vue` (conditional password UI), `useAuth.ts` (adds `loginWithGoogle`), `me.get.ts` (adds `has_password`/`has_google`), `login.post.ts` (null password guard), `password.patch.ts` (set initial password), `account.delete.ts` (passwordless deletion), `email.post.ts` (passwordless email change)

---

## auth-firebase (optional)

Firebase Authentication as an identity layer. Multiple OAuth providers (Google, Apple, GitHub, Microsoft) via Firebase client SDK.

```
app/composables/useFirebaseAuth.ts
server/api/auth/firebase.post.ts
migrations/005_add_firebase_auth.js
```

Also modifies: `login.vue` (adds Firebase provider buttons), `register.vue` (adds Firebase provider buttons), `profile.vue` (conditional password UI), `useAuth.ts` (adds `loginWithFirebase`), `me.get.ts` (adds `has_password`/`has_firebase`), `login.post.ts` (null password guard), `password.patch.ts` (set initial password), `account.delete.ts` (passwordless deletion), `email.post.ts` (passwordless email change)

---

## s3-storage (optional)

S3-compatible file storage with presigned URLs.

```
server/utils/storage.ts
```

---

## kitchen-sink (optional)

UI component showcase page.

```
app/pages/kitchen.vue
```
