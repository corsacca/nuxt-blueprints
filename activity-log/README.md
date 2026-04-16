# Activity Log Block

Database-backed audit trail for user actions. Records who did what, when, and from where.

## What You Get

- `logEvent()` -- log any custom event
- `logCreate()`, `logUpdate()`, `logDelete()` -- CRUD operation logging
- Auth-specific helpers: `logLogin()`, `logLoginFailed()`, `logLogout()`, `logPasswordReset()`, etc.
- All events stored in the `activity_logs` table with user ID, event type, IP, user agent, and metadata

## Files

```
server/utils/activity-logger.ts
migrations/004_create_activity_logs_table.js
```

## Environment Variables

None. Uses the `DATABASE_URL` from the core block.

## Dependencies

- `core` (database utilities)

## npm Packages

None beyond what `core` provides.

## Usage

The `auth-jwt` block calls these functions automatically in its API routes. If you're adding your own routes, use them like:

```typescript
import { logEvent, logCreate } from '~/server/utils/activity-logger'

// Log a custom event
logEvent({
  eventType: 'REPORT_GENERATED',
  userId: user.id,
  metadata: { reportType: 'monthly' }
})

// Log a CRUD operation
logCreate({
  tableName: 'orders',
  recordId: order.id,
  userId: user.id
})
```
