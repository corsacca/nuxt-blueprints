# Nuxt Blueprints — Assembly Instructions

When a user asks to "build from blueprints" or "use the blueprints", follow this process.

## Step 1: Understand the request

Read `manifest.json` to understand all available blocks, their types, and dependencies.

Parse the user's request to determine which blocks they want. Map casual language to block names:
- "JWT auth" / "authentication" → `auth-jwt` (includes profile)
- "Google auth" → `auth-google`
- "Mailgun" / "mailgun email" → `email/mailgun`
- "SES" / "AWS email" → `email/ses`
- "SMTP" / "SMTP email" → `email/smtp`
- "activity log" / "logging" / "audit" → `activity-log`
- "rate limiting" / "rate limit" → `rate-limiting/db` (default) or `rate-limiting/memory`
- "S3" / "storage" / "file upload" → `s3-storage`
- "admin section" / "admin dashboard" / "admin area" → `admin`
- "user management" / "admin users" / "manage users" → `user-management`
- "roles" / "permissions" / "RBAC" → already baked into `auth-jwt`. For the assignment UI, include `user-management` (which pulls in `admin`)
- "custom roles" / "runtime roles" / "DB-backed roles" / "editable roles" → `custom-roles`
- "kitchen sink" / "component showcase" → `kitchen-sink`

When copying files from a choice group block, also copy files from the group's `shared` directory (declared in manifest.json). For example, `email/mailgun` also needs files from `email/shared/`.

## Step 2: Resolve blocks

1. Always include `core`.
2. Add all blocks the user requested.
3. Resolve dependencies — if a block depends on another, include it automatically.
4. For choice groups (email provider, auth strategy), use the default if the user didn't specify one.
5. Include all `default` type blocks unless the user specifically excluded them.

## Step 3: Confirm with the user

Present the resolved block list and ask about any optional blocks they didn't mention:

```
Based on your description, here's what I'll include:

✅ core              (always included)
✅ auth-jwt          (you asked for JWT auth)
✅ core-email-mailgun (you asked for Mailgun)
✅ profile           (default — included automatically)
✅ activity-log      (required by auth-jwt)
✅ rate-limiting     (required by auth-jwt)
✅ s3-storage        (you asked for S3)

A few questions:
- Kitchen sink: a demo page showing all UI components. Include it? [y/n]
```

Wait for confirmation before proceeding.

## Step 4: Scaffold the project

1. Check if a `nuxt.config.ts` already exists — the user may have already set up the project.
2. If not, scaffold with the Nuxt UI template (fully non-interactive):
   ```bash
   npx nuxi@latest init <project-dir> --template ui --packageManager bun --gitInit --force --no-modules
   ```
   Adjust `--packageManager` if the user prefers something other than bun.

The `ui` template provides the base: `app.vue`, `nuxt.config.ts`, `package.json`, `main.css`, Nuxt UI, Tailwind, and icons. The blueprints build on top of this — they add files and modify existing ones rather than replacing them wholesale.

3. Clean up pnpm artifacts left by the template — the UI template ships with pnpm config files that are unnecessary when using bun:
   ```bash
   rm -f pnpm-lock.yaml pnpm-workspace.yaml renovate.json README.md LICENSE
   rm -rf .github
   ```
   Also remove the `"packageManager"` field from `package.json` if present.

## Step 5: Read all selected blueprint.md files

For each selected block, read its `blueprint.md` to understand:
- What files to copy
- What package dependencies to add
- What config to merge into `nuxt.config.ts`
- What env vars to add to `.env.example`
- What wiring notes to follow

## Step 6: Apply block files

For each selected block, follow its `blueprint.md` instructions:

1. **"New Files to Copy"** — Use `cp` via the Bash tool to copy source files from the block directory into the project. Do NOT use the Write tool to recreate file contents — that is slow and error-prone. Use `mkdir -p` to create directories, then `cp` to copy files. Copy multiple files in a single command where possible. E.g.:
   ```bash
   mkdir -p <project>/app/layouts <project>/app/composables <project>/server/utils <project>/server/database <project>/migrations
   cp <blueprints>/core/app/layouts/default.vue <project>/app/layouts/
   cp <blueprints>/core/app/layouts/auth.vue <project>/app/layouts/
   cp <blueprints>/core/server/utils/database.ts <project>/server/utils/
   cp <blueprints>/core/migrations/001_create_users_table.ts <project>/migrations/
   ```
2. **"Existing Files to Modify"** — These files already exist from the ui template or a prior block. Apply the modifications described in the blueprint.md. Do NOT replace the whole file — merge the changes.
3. **"Wiring Notes"** — Follow these when combining blocks. E.g., auth-jwt's notes explain how to modify core's `default.vue` to add user info in the header.

Process blocks in dependency order: `core` first, then email provider, then auth, then the rest.

## Step 7: Merge configuration

Build a single `nuxt.config.ts` by combining config from all selected blocks' blueprint.md files.

Build a single `package.json` by merging all dependencies from all selected blocks.

Build a single `.env.example` by combining all environment variables from all selected blocks.

## Step 8: Number migrations

Collect all migration files from selected blocks. They are `.ts` files with sequential numeric prefixes (001, 002, 003, 004, 005) that work together. Copy them all into the project's `migrations/` directory.

Choice groups share a number (e.g., `auth-google` and `auth-firebase` both ship `005_*.ts`). Only one of each group is selected, so there's no collision.

If there are gaps in numbering (e.g., block was skipped), renumber them sequentially.

## Step 8.5: Merge database schema fragments

Each blueprint that touches the database ships a `server/database/schema.ts` fragment that extends the `Database` interface consumed by Kysely.

1. Copy `core/server/database/schema.ts` into `<project>/server/database/schema.ts` as the starting point. It defines the base `UsersTable` and a `Database` interface with just `{ users }`.
2. For each additional blueprint with a `server/database/schema.ts`, merge its extensions into the project's schema file, in dependency order:
   - `auth-jwt` adds auth columns (including `roles: Generated<string[]>`) to `UsersTable` and appends `password_reset_requests`
   - `activity-log` appends `activity_logs`
   - `auth-google` adds `google_id` to `UsersTable` and relaxes `password` to nullable
   - `auth-firebase` adds `firebase_uid` to `UsersTable` and relaxes `password` to nullable
   - `admin` and `user-management` ship no schema fragments — they layer logic on top of the `roles` column already provided by `auth-jwt`
   - `custom-roles` appends `custom_roles` table to the `Database` interface. Also replaces `auth-jwt`'s `server/utils/rbac.ts` with a version that falls back to `custom_roles` lookups, replaces `user-management`'s `app/pages/admin/roles.vue` with an extended version that includes custom-role CRUD UI, and replaces `user-management`'s `app/composables/useAssignableRoles.ts` with a version that fetches DB-backed roles for the role-editor / invite UI. File overwrites happen automatically via `cp` — just make sure `custom-roles` is processed after `auth-jwt` and `user-management` in dependency order.

The result is a single `server/database/schema.ts` file in the project with one consolidated `Database` interface covering every selected blueprint's tables and columns. The Kysely query builder uses this type for autocomplete and compile-time type checking across all query sites.

Do NOT copy each blueprint's `schema.ts` as a separate file — they're fragments meant to be merged, not kept as separate files.

## Step 8.6: Merge permission fragments

`auth-jwt`'s `app/utils/permissions.ts` is the single source of truth for permissions. If any other selected block ships its own `app/utils/permissions.ts` fragment, merge it into `auth-jwt`'s version at assembly time:

- Concatenate each fragment's `PERMISSIONS` array into a single union
- Merge each fragment's `PERMISSION_META` object entries into a single object

Do NOT copy each blueprint's `permissions.ts` as a separate file. Like schema fragments, they're meant to be merged into one file. Today most blocks don't ship a `permissions.ts` fragment — only merge the ones that do.

## Step 9: Write .blueprints.json

Create a tracking file in the project root:

```json
{
  "source": "<path-to-blueprints-repo>",
  "generated": "<today's date>",
  "blocks": {
    "core": {},
    "core-email-mailgun": {},
    "auth-jwt": {},
    ...
  }
}
```

## Step 10: Install and verify

Run `npm install` and `npm run dev` to verify the project starts correctly.

## Step 11: Brief the user on next steps

After the server boots successfully, tell the user what to do next:

- Copy `.env.example` to `.env` and fill in real values before relying on any provider (database, email, S3, etc.)
- **If `auth-jwt` is included**, include this verbatim:

  > When you register your first account, you'll be promoted to admin automatically and logged straight in — no email verification required. Subsequent registrations follow the normal email-verification flow.

  This reflects the first-user bootstrap behavior in `auth-jwt/server/api/auth/register.post.ts`: the very first user on an empty `users` table is inserted with `verified: true` and `roles: ['admin']`. Subsequent registrations receive `roles: ['member']`. `auth-jwt` ships the roles + permissions definitions, guards (`requireRole`, `requirePermission`), and the `usePermissions()` composable — so even without any admin UI you can gate your own handlers by role.

- **If `user-management` is included**, also include this verbatim:

  > Visit `/admin/users` to assign roles to other users, or `/admin/roles` to see what each role grants. Roles and permissions live in `app/utils/role-definitions.ts` and `app/utils/permissions.ts` — edit those files to customize. The `admin.access` permission is required to reach `/admin`; specific pages and actions require their own permissions (e.g. `users.view`, `users.edit`, `users.delete`, `users.assign-roles`, `users.verify`, `roles.view`, `roles.write`, `roles.delete`). Assigning a role requires you to already hold every permission that role grants (subset delegation).

- **If `custom-roles` is included**, also include this verbatim:

  > You can also create custom roles at runtime via the "Create role" button on `/admin/roles`. Custom roles live in the `custom_roles` database table and resolve the same way as static ones — any user's `roles` array can contain either. Custom role names cannot collide with static role names (`admin`, `member`). Deleting a custom role leaves users with that role name in their array; they'll silently resolve to no permissions until reassigned.
