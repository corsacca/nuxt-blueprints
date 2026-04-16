# Rate Limiting (Memory) Block

In-memory rate limiting for API endpoints. Uses a Map with sliding window expiry. No database dependency.

**Tradeoffs vs database rate limiting:**
- Faster — no DB query per request
- No dependency on activity-log block
- Resets on server restart
- Does not share state across multiple server instances

## Dependencies

None.

## Files Provided

```
server/utils/rate-limit.ts
```

## Wiring Notes

Exports the same `checkRateLimit()` and `logRateLimitExceeded()` function signatures as the database version. Auth-jwt routes work without changes regardless of which rate limiting block is used.

`logRateLimitExceeded()` logs to console.warn instead of the activity_logs table.
