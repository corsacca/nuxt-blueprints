# Activity Log Block

Database-backed audit trail for user actions.

## Dependencies

- `core` (database utilities)

## Files Provided

```
server/utils/activity-logger.ts
server/database/schema.ts
migrations/004_create_activity_logs_table.ts
```

## Migrations

- `004_create_activity_logs_table.ts` — Creates the `activity_logs` table with indexes on timestamp (DESC), user_id, and event_type.

## Database & Types

- `server/database/schema.ts` — Adds `ActivityLogsTable` to the `Database` interface. Merge into the project's consolidated `server/database/schema.ts` during assembly.

## Package Dependencies

None beyond what `core` provides.

## Wiring Notes

The activity logger provides `logEvent()`, `logCreate()`, `logUpdate()`, `logDelete()` and auth-specific helpers like `logLogin()`, `logLoginFailed()`, `logLogout()`, `logPasswordReset()`, etc.

The `auth-jwt` block uses these functions in its API routes. If using activity-log without auth-jwt, the auth-specific helpers (logLogin, logLoginFailed, etc.) won't be needed — they're included for convenience.
