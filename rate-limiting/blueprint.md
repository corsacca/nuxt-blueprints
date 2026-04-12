# Rate Limiting Block

Database-backed rate limiting for API endpoints. Queries the activity_logs table to count recent attempts.

## Dependencies

- `activity-log` (uses the activity_logs table and logEvent function)

## Files Provided

```
server/utils/rate-limit.ts
```

## Package Dependencies

None beyond what `core` provides.

## Wiring Notes

The `auth-jwt` block's login, register, and forgot-password endpoints use rate limiting. Rate limits are configured per-endpoint:

| Endpoint | Identifier | Window | Max Attempts |
|----------|------------|--------|--------------|
| `/api/auth/login` | email | 15 min | 5 |
| `/api/auth/register` | IP address | 15 min | 10 |
| `/api/auth/forgot-password` | email | 15 min | 3 |

You can add rate limiting to your own endpoints by calling `checkRateLimit()`.
