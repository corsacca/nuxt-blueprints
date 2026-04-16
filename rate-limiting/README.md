# Rate Limiting Block

Rate limiting for API endpoints. Choose one strategy.

## Options

### Database (default)

Queries the `activity_logs` table to count recent attempts. Persists across server restarts and works across multiple instances.

**Files:** `rate-limiting/db/server/utils/rate-limit.ts`

**Dependencies:** `activity-log` (uses the activity_logs table)

### Memory

In-memory Map with sliding window expiry. Faster, no database dependency.

**Files:** `rate-limiting/memory/server/utils/rate-limit.ts`

**Dependencies:** None

**Tradeoffs:**
- Faster -- no DB query per request
- Resets on server restart
- Does not share state across multiple server instances
- Logs rate limit events to console.warn instead of the database

## Environment Variables

None. Both strategies are configured in code.

## Default Rate Limits

Used by `auth-jwt` routes:

| Endpoint | Identifier | Window | Max Attempts |
|----------|------------|--------|--------------|
| `/api/auth/login` | email | 15 min | 5 |
| `/api/auth/register` | IP address | 15 min | 10 |
| `/api/auth/forgot-password` | email | 15 min | 3 |

## npm Packages

None beyond what `core` provides.

## Usage

Both strategies export the same interface:

```typescript
import { checkRateLimit } from '~/server/utils/rate-limit'

// In an API route
const rateLimitResult = await checkRateLimit({
  identifier: email,
  action: 'login',
  windowMinutes: 15,
  maxAttempts: 5
})

if (!rateLimitResult.allowed) {
  throw createError({ statusCode: 429, statusMessage: 'Too many attempts' })
}
```
