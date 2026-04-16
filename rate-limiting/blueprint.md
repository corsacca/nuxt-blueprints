# Rate Limiting Block

Rate limiting for API endpoints. Choose one strategy below.

## Options

- `db` — Database-backed, queries activity_logs table (default). Persists across restarts, works across instances.
- `memory` — In-memory Map with TTL (planned). Faster, no DB dependency, resets on restart.

Both options export the same `checkRateLimit()` and `logRateLimitExceeded()` function signatures so auth-jwt routes work with either.

## Shared Files

None — each option provides its own `server/utils/rate-limit.ts`.
