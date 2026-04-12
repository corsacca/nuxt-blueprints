# Nuxt Blueprints — Assembly Instructions

When a user asks to "build from blueprints" or "use the blueprints", follow this process.

## Step 1: Understand the request

Read `manifest.json` to understand all available blocks, their types, and dependencies.

Parse the user's request to determine which blocks they want. Map casual language to block names:
- "JWT auth" / "authentication" → `auth-jwt`
- "Google auth" → `auth-google`
- "Mailgun" / "mailgun email" → `core-email-mailgun`
- "SES" / "AWS email" → `core-email-ses`
- "SMTP" / "SMTP email" → `core-email-smtp`
- "profile" / "profile page" → `profile`
- "activity log" / "logging" / "audit" → `activity-log`
- "rate limiting" / "rate limit" → `rate-limiting`
- "profile" / "profile page" → included in `auth-jwt` (not a separate block)
- "S3" / "storage" / "file upload" → `s3-storage`
- "kitchen sink" / "component showcase" → `kitchen-sink`

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
   mkdir -p <project>/app/layouts <project>/app/composables <project>/server/utils
   cp <blueprints>/core/app/layouts/default.vue <project>/app/layouts/
   cp <blueprints>/core/app/layouts/auth.vue <project>/app/layouts/
   cp <blueprints>/core/server/utils/database.ts <project>/server/utils/
   ```
2. **"Existing Files to Modify"** — These files already exist from the ui template or a prior block. Apply the modifications described in the blueprint.md. Do NOT replace the whole file — merge the changes.
3. **"Wiring Notes"** — Follow these when combining blocks. E.g., auth-jwt's notes explain how to modify core's `default.vue` to add user info in the header.

Process blocks in dependency order: `core` first, then email provider, then auth, then the rest.

## Step 7: Merge configuration

Build a single `nuxt.config.ts` by combining config from all selected blocks' blueprint.md files.

Build a single `package.json` by merging all dependencies from all selected blocks.

Build a single `.env.example` by combining all environment variables from all selected blocks.

## Step 8: Number migrations

Collect all migration files from selected blocks. They already have sequential numbers (001, 002, 003, 004) that work together. Copy them all into the project's `migrations/` directory.

If there are gaps in numbering (e.g., block was skipped), renumber them sequentially.

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
