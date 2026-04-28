# OAuth 2.1 Layer

A Nuxt layer that adds an OAuth 2.1 authorization server to your app, suitable for issuing audience-bound access tokens to MCP clients (and any other OAuth client). All tokens are opaque random strings stored as SHA-256 hashes; scope strings are permissions from the consumer's RBAC vocabulary.

## What it provides

Routes:
- `GET /oauth/authorize` — start the authorization-code flow
- `POST /oauth/authorize` — consent submission
- `GET /oauth/consent` — server-rendered consent page
- `POST /oauth/token` — token endpoint (authorization_code, refresh_token grants)
- `POST /oauth/register` — Dynamic Client Registration (RFC 7591)
- `GET /.well-known/oauth-authorization-server` — RFC 8414
- `GET /.well-known/oauth-protected-resource` — RFC 9728

Server utilities (auto-imported as Nitro server utils):
- `requireBearerScope(event, scope)` — guard an MCP/API endpoint with a required scope
- `issueCode(...)` — internal use by routes; not typically called directly

Database:
- 7 tables (`oauth_clients`, `oauth_token_families`, `oauth_pending_requests`, `oauth_authorization_codes`, `oauth_access_tokens`, `oauth_refresh_tokens`, `oauth_consents`) created via the layer's migration `oauth_001_create_oauth_tables.ts`.

Plugins:
- `oauth-config-validate.ts` — validates required config + runs preflight against the consumer's `users` table and `getUserPermissions` function.
- `oauth-cleanup.ts` — periodic sweeps of expired pending requests, codes, and tokens.

## Adding to a project

In your consumer project's `nuxt.config.ts`:

```ts
export default defineNuxtConfig({
  extends: ['../base-code/layers/oauth']
})
```

(Path relative to your consumer project root.)

### One-time setup: symlink node_modules

The migration runner imports the layer's migration file dynamically at runtime, which makes Node resolve `kysely` from the layer's path rather than the consumer's. For local dev with sibling-path layer extension, symlink the consumer's `node_modules` into the layer:

```bash
ln -s ../../<your-project>/node_modules /Users/jd/code/base-code/layers/oauth/node_modules
```

Run this once per consumer. The `node_modules` symlink is gitignored, so each consumer maintains its own. (Layers consumed via npm or `github:` resolve naturally inside `node_modules/.c12/…` and don't need this step.)

## Consumer requirements

This layer is **standalone** — it does not extend a base layer. It assumes your project conforms to the following shape:

### 1. `users` table

Must exist with `id` of type `uuid` as primary key. The OAuth tables foreign-key to `users.id`.

### 2. Auth utilities at `~~/server/utils/auth.ts`

Must export:
```ts
export function getAuthUser(event: H3Event): { userId: string } | null
export function requireAuth(event: H3Event): { userId: string }
```

`getAuthUser` returns null if not authenticated; `requireAuth` throws a 401 if not authenticated.

### 3. RBAC utilities at `~~/server/utils/rbac.ts`

Must export:
```ts
export async function getUserPermissions(userId: string): Promise<Set<Permission>>
```

### 4. Permission registry at `~~/app/utils/permissions.ts`

Must export:
```ts
export const PERMISSIONS: readonly string[]
export type Permission = typeof PERMISSIONS[number]
export const PERMISSION_META: Record<string, { title: string; description: string }>
export function isPermission(value: string): value is Permission
```

### 5. Database client at `~~/server/utils/database.ts`

Must export `db: Kysely<Database>`. The layer adds its tables to the `Database` interface via TypeScript module augmentation against `~~/server/database/schema`.

### 6. Schema interface at `~~/server/database/schema.ts`

Must declare `Database` as an `interface` (not a `type` alias). Module augmentation only extends interfaces.

### 7. Activity logger at `~~/server/utils/activity-logger.ts`

Must export:
```ts
export function logEvent(opts: { eventType: string; userId?: string; userAgent?: string; metadata?: Record<string, unknown> }): void
```

### 8. Rate limiter at `~~/server/utils/rate-limit.ts`

Must export:
```ts
export function checkRateLimit(key: string, scope: string, identifier: string, windowMs: number, max: number): Promise<{ allowed: boolean; retryAfterSeconds?: number }>
export function logRateLimitExceeded(ip: string, route: string, userAgent?: string): void
```

### 9. Migration runner that walks layers

The consumer's migration runner must read migration files from `nuxt.options._layers` (each layer's `migrations/` folder), not just from `<cwd>/migrations`. See "Migration runner upgrade" below.

## Environment variables

Required:

```
OAUTH_CONSENT_COOKIE_SECRET=<openssl rand -base64 32>
OAUTH_ALLOW_DCR=true
NUXT_PUBLIC_SITE_URL=https://your-app.example.com
```

`NUXT_PUBLIC_SITE_URL` is also used as the OAuth `iss` (issuer) value. The MCP resource URI is computed as `${NUXT_PUBLIC_SITE_URL}/mcp`.

## Optional config overrides

In your consumer's `nuxt.config.ts`:

```ts
runtimeConfig: {
  oauth: {
    loginPath: '/sign-in'   // default '/login'
  }
}
```

## MCP endpoint

This layer ships the OAuth authorization server only. The MCP endpoint at `/mcp` is your responsibility — mount it as a Nitro server route in the consumer:

```ts
// server/routes/mcp.ts
export default defineEventHandler(async (event) => {
  const auth = await requireBearerScope(event, 'pages.read')
  // ... handle MCP request, auth.userId is the user, auth.scopes is granted
})
```

## Migration runner upgrade

The layer ships its migration in `<layer>/migrations/oauth_001_create_oauth_tables.ts`. For your migration runner to pick it up, you need a layer-aware setup. Add a Nuxt module:

```ts
// modules/migrations.ts
import { defineNuxtModule } from '@nuxt/kit'
import path from 'path'
import { existsSync } from 'fs'

export default defineNuxtModule({
  setup(_, nuxt) {
    nuxt.options.runtimeConfig.layerMigrationPaths = nuxt.options._layers
      .map(l => path.join(l.cwd, 'migrations'))
      .filter(p => existsSync(p))
  }
})
```

Reference it in `nuxt.config.ts`:

```ts
modules: ['./modules/migrations']
```

Update your `server/plugins/migrations.ts` to read from `runtimeConfig.layerMigrationPaths` and feed all paths to the migration provider.

## Naming convention for layer migrations

Layers prefix migration filenames with the layer name (`oauth_001_*`, `<nextlayer>_001_*`). Filenames are sorted globally → stable execution order across all layers and the consumer's own numeric-prefixed migrations.
