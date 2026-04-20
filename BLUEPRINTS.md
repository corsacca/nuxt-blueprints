# Nuxt Blueprints

A collection of self-contained building blocks for assembling Nuxt applications. Each blueprint is a block of code — pages, server routes, utilities, migrations — that gets copied into a new project at creation time. The project owns the code from that point forward.

## Why Blueprints

### The problem with shared layers

Nuxt layers let you share code across projects as a runtime dependency. This works until:

- **AI tooling can't see the code** — layer files live in `.c12` cache or `node_modules`, invisible to code assistants
- **Dev cache goes stale** — HMR and auto-imports break, requiring server restarts
- **All or nothing** — every project gets the entire layer whether it needs S3 storage or not
- **Customization fights the framework** — overriding a layer page or layout means working around merge behavior rather than just editing a file

### What blueprints do differently

- **Code ownership** — blueprint files are copied into your project. Edit anything directly.
- **Composable** — pick only the blocks you need. JWT auth but no S3? Just don't include it.
- **AI-friendly** — all code is visible in the project tree. No cache indirection.
- **No runtime coupling** — changing the blueprint repo never affects existing projects.
- **Consistent patterns** — projects built from the same blocks share design, conventions, and structure.

### The tradeoff

With layers, updates propagate automatically on `npm install`. With blueprints, each project owns its code and must be updated separately. Phase 2 of this project addresses this with AI-assisted propagation — scanning existing projects and creating pull requests when a blueprint is updated.

## How It Works

### Starting a new project

1. Run `nuxt init` to get a vanilla Nuxt app
2. Open Claude Code and run `/blueprint` to start the scaffolding skill, or just describe what you need:

   > Build a Nuxt app from the Nuxt blueprints. I want JWT auth, Mailgun, the profile page, the activity log, S3 storage.

3. Claude parses your request, maps it to blocks, then walks you through anything you didn't mention:

   ```
   Based on your description, here's what I'll include:

   ✅ core              (always included)
   ✅ auth-jwt           (you asked for JWT auth)
   ✅ core-email-mailgun (you asked for Mailgun)
   ✅ profile            (you asked for profile page)
   ✅ activity-log       (you asked for activity log)
   ✅ s3-storage         (you asked for S3 storage)

   A few questions:

   - Rate limiting: adds per-endpoint rate limits for auth routes
     (login, register, forgot-password). Include it? [y/n]

   - Kitchen sink: a demo page showing all UI components.
     Useful for development reference. Include it? [y/n]
   ```

4. Once confirmed, Claude reads each block's `blueprint.md` for assembly instructions and copies the files into your project — merging `nuxt.config.ts`, `package.json`, and `.env.example` from each block.

5. Run `npm install && npm run dev` — working app with auth, email, storage, and everything wired together.

6. Customize from there. The code is yours.

### Updating existing projects (Phase 2)

When a blueprint block is improved, AI reads the diff, looks at each project that uses that block, and creates a pull request that applies the change while respecting project-specific customizations. Projects track which blocks they were built from and at which commit in a `.blueprints.json` file.

## Block Types

### Always included
Blocks that every project gets. These provide the foundation.

### Default
Blocks included unless specifically excluded. These cover the common case — most projects want auth and email.

### Optional
Blocks that must be explicitly requested. These add capabilities not every project needs.

### Choices
Some blocks are one-of-many — you pick which variant you want:

- **Email provider:** SMTP (default), Mailgun, or SES
- **Auth strategy:** JWT (default), Google OAuth (future)

## Blocks

### `core` — Always

The foundation layer on top of `nuxt init`. Every project gets this.

**Provides:**
- PostgreSQL database connection and query utilities (`server/utils/database.ts`)
- Migration infrastructure (Nitro plugin runs migrations on server startup)
- Users table migration (id, email, display_name, created, updated)
- Theming system — Nuxt UI integration, custom color config, dark mode
- `useTheme` composable and `ThemeToggle` component
- Layouts: `default` (authenticated app shell) and `auth` (centered card)
- Base CSS (`app/assets/css/default.css`)
- Landing page (`index.vue`) and dashboard page (`dashboard.vue`)
- Base `nuxt.config.ts` additions (modules, UI theme, runtime config structure)
- `.env.example` with DATABASE_URL, APP_TITLE, NUXT_PUBLIC_SITE_URL

**Depends on:** `nuxt init`

---

### `core-email-smtp` — Default choice (email provider)

SMTP email transport. The default email provider.

**Provides:**
- Email sending utility (`server/utils/email.ts`) with SMTP transport
- Email template system (`server/utils/email-templates.ts`)
- `sendEmail()`, `sendTemplateEmail()`, `sendBulkTemplateEmails()` functions
- `.env.example` entries for SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, etc.

**Depends on:** `core`

---

### `core-email-mailgun` — Alt choice (email provider)

Mailgun API email transport. Alternative to SMTP.

**Provides:**
- Email sending utility with Mailgun transport
- Same email template system and function signatures as SMTP
- `.env.example` entries for MAILGUN_API_KEY, MAILGUN_DOMAIN, MAILGUN_HOST

**Depends on:** `core`

---

### `core-email-ses` — Alt choice (email provider)

AWS SES email transport. Alternative to SMTP.

**Provides:**
- Email sending utility with SES transport
- Same email template system and function signatures as SMTP
- `.env.example` entries for AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY

**Depends on:** `core`

---

### `auth-jwt` — Default

JWT-based authentication with email verification, password reset, and user profile management.

**Provides:**
- `useAuth` composable (login, register, logout, checkAuth)
- `usePermissions` composable (`hasRole`, `hasPermission`, `isAdmin`)
- Auth middleware (`app/middleware/auth.ts`)
- Auth client plugin (`app/plugins/auth.client.ts`)
- Pages: login, register, reset-password, profile
- Server API routes: login, register, logout, me, verify, forgot-password, reset-password, verify-email-change (login + me return the user's resolved `permissions` alongside `roles`)
- Profile API routes: update display name, request email change, change password, delete account
- JWT token utilities (`server/utils/auth.ts`)
- **Baseline roles-and-permissions**: `app/utils/permissions.ts` registry, `app/utils/role-definitions.ts` with `admin` / `member` defaults, `server/utils/rbac.ts` with `requireRole`, `requirePermission`, and the resolver. First registered user auto-gets `roles: ['admin']`; everyone else gets `roles: ['member']`.
- Migration adding password, verified, token_key, roles columns to users table
- Migration creating password_reset_requests table

**Depends on:** `core`, an email provider block

---

### `admin` — Default

Minimal admin-area shell: gated `/admin/*` layout, middleware, empty dashboard. Other admin blocks hang routes and nav entries off this.

**Provides:**
- `app/layouts/admin.vue` with a single "Dashboard" nav item (other blocks extend via wiring notes)
- `app/middleware/admin.ts` — redirects users without the `admin` role to `/`
- `app/pages/admin/index.vue` — empty dashboard shell

**Depends on:** `core`, `auth-jwt`

---

### `user-management` — Default

Admin UI for managing users.

**Provides:**
- `/admin/users` — paginated users list with search, sort, slideover for editing display name, assigning roles, and deleting
- `/admin/roles` — accordion view of every role with per-permission granted/not-granted indicators
- Admin API routes: `GET /api/admin/users` (`users.view`), `PATCH /api/admin/users/[id]` + `DELETE /api/admin/users/[id]` (`users.manage`), `PUT /api/admin/users/[id]/roles` (`users.manage` + **subset delegation** — you can only assign roles whose permissions are a subset of your own). Refuses to delete the caller or the last admin. All audit-logged.
- UI rules: row clicks on `/admin/users` are disabled for users without `users.manage`; unassignable roles in the role editor show a disabled checkbox with a tooltip listing the missing permissions
- Wiring note: adds "Users" + "Roles" nav entries to the admin layout (each hidden if the viewer lacks the corresponding `view` permission)

**Depends on:** `core`, `auth-jwt`, `activity-log`, `admin`

---

### `custom-roles` — Optional

DB-backed custom roles extending the baseline RBAC.

**Provides:**
- `custom_roles` table (`id`, `name UNIQUE`, `description`, `permissions TEXT[]`) via migration
- Admin API: `GET / POST /api/admin/custom-roles` (`roles.view` / `roles.manage`), `PUT / DELETE /api/admin/custom-roles/[id]` (`roles.manage`). All audit-logged.
- Replacement `app/utils/rbac.ts` with `getRolePermissions` / `validateRoleNames` falling back to the `custom_roles` table
- Replacement `/admin/roles` page — accordion split into Built-in and Custom sections, with a "Create role" button and inline edit/delete modals (permission toggles grouped by resource)
- Replacement `/admin/users` page — role editor now lists custom roles alongside static with a "Custom" badge
- Name-collision guard: custom role names cannot match any static role (`admin`, `member`)

**Depends on:** `core`, `auth-jwt`, `activity-log`, `admin`, `user-management`

---

### `auth-google` — Alt (future)

Google OAuth authentication. Not yet implemented.

**Depends on:** `core`

---

### `rate-limiting` — Optional

Database-backed rate limiting for API endpoints.

**Provides:**
- Rate limit utility (`server/utils/rate-limit.ts`)
- `checkRateLimit()` and `logRateLimitExceeded()` functions
- Pre-configured limits for auth endpoints (login, register, forgot-password)

**Depends on:** `core`

---

### `activity-log` — Optional

Audit trail for user actions.

**Provides:**
- Activity logger utility (`server/utils/activity-logger.ts`)
- `logEvent()`, `logCreate()`, `logUpdate()`, `logDelete()` functions
- Uses the `activity_logs` table (migration included)

**Depends on:** `core`

---

### `s3-storage` — Optional

S3-compatible file storage with presigned URLs.

**Provides:**
- Storage utilities (`server/utils/storage.ts`)
- `uploadToS3()`, `deleteFromS3()`, `generateSignedUrl()` functions
- Image type and file size validation helpers
- `.env.example` entries for S3_ENDPOINT, S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_BUCKET_NAME

**Depends on:** none (standalone utilities, no database tables)

---

### `kitchen-sink` — Optional

UI component showcase page for development reference.

**Provides:**
- Kitchen sink page (`app/pages/kitchen.vue`) demonstrating Nuxt UI components, theming, and layout patterns

**Depends on:** `core`

## Repository Structure

```
nuxt-blueprints/
├── BLUEPRINTS.md              # This file
├── manifest.json              # Block metadata, dependencies, defaults, choices
│
├── core/
│   ├── blueprint.md           # Assembly instructions for this block
│   ├── app/
│   │   ├── assets/css/
│   │   ├── components/
│   │   ├── composables/
│   │   ├── layouts/
│   │   └── pages/
│   ├── server/utils/
│   ├── server/plugins/
│   └── migrations/
│
├── core-email-smtp/
│   ├── blueprint.md
│   └── server/utils/
│
├── core-email-mailgun/
│   ├── blueprint.md
│   └── server/utils/
│
├── core-email-ses/
│   ├── blueprint.md
│   └── server/utils/
│
├── auth-jwt/
│   ├── blueprint.md
│   ├── app/
│   │   ├── composables/
│   │   ├── middleware/
│   │   ├── pages/
│   │   └── plugins/
│   ├── server/
│   │   ├── api/auth/
│   │   └── utils/
│   └── migrations/
│
├── profile/
│   ├── blueprint.md
│   ├── app/pages/
│   └── server/api/profile/
│
├── rate-limiting/
│   ├── blueprint.md
│   └── server/utils/
│
├── activity-log/
│   ├── blueprint.md
│   ├── server/utils/
│   └── migrations/
│
├── s3-storage/
│   ├── blueprint.md
│   └── server/utils/
│
└── kitchen-sink/
    ├── blueprint.md
    └── app/pages/
```

## Blueprint File Format

Each block contains a `blueprint.md` that Claude reads during assembly. It includes:

- **Description** — what this block does and when to use it
- **Dependencies** — which other blocks must be included
- **Files** — complete list of files this block provides
- **Package dependencies** — npm packages to add to `package.json`
- **Config** — additions to `nuxt.config.ts`
- **Environment variables** — entries for `.env.example`
- **Migrations** — database migrations and their run order
- **Wiring instructions** — how this block connects to other blocks (e.g., "adds columns to the users table created by core")

## Project Tracking (Phase 2)

Each generated project includes a `.blueprints.json` that records which blocks were used and at which commit:

```json
{
  "source": "github:corsacca/nuxt-blueprints",
  "generated": "2026-04-12",
  "blocks": {
    "core": { "commit": "abc123" },
    "core-email-mailgun": { "commit": "abc123" },
    "auth-jwt": { "commit": "abc123" },
    "profile": { "commit": "abc123" },
    "s3-storage": { "commit": "abc123" }
  }
}
```

When a blueprint is updated, AI compares the block at the recorded commit vs. the current version, reads the project's current files, and generates a pull request that applies the update while respecting any project-specific customizations.
