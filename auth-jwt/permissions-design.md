# Permission design: granular over coarse

## The rule

Prefer granular permissions over coarse ones. Compose breadth via roles in `app/utils/role-definitions.ts`.

- Granular ✓: `pages.read`, `pages.write`, `pages.publish`
- Coarse ✗: `pages.manage`

## Why

OAuth / delegation use cases need to grant a *subset* of a user's authority to a third-party client. If permissions are granular from the start, the OAuth layer is a thin pass-through: tokens carry permission strings, endpoints declare one permission, cookie auth and bearer auth share a vocabulary. If permissions are coarse, a user holding `pages.manage` can only grant a client all page operations or none — there's no read-only handoff. The escape hatch is a parallel "OAuth scope" namespace with its own scope→permission map, which means every protected endpoint declares two things forever and every project that adopts the OAuth block carries that overhead. Putting subset granularity directly in RBAC keeps endpoints in one vocabulary.

## Sizing rule

The right grain is the smallest meaningful capability a user might want to delegate. Don't over-split — splitting later is mechanical, merging later is painful.

## Migration playbook (coarse → granular)

For projects that have already shipped a coarse permission and need to break it apart without breaking deployed code. Each step leaves the system in a working state.

1. **Add the granular permissions alongside the broad one** in `PERMISSIONS` (and `PERMISSION_META`). Keep both temporarily.
2. **Update static roles** in `role-definitions.ts` to list the granular set instead of the broad one. Roles that previously granted `pages.manage` now grant `pages.read`, `pages.write`, `pages.publish` — plus `pages.manage` until step 5.
3. **Write a Kysely migration** that appends the granular permissions to any `custom_roles` rows holding the broad one (only relevant if the `custom-roles` block is in use).
4. **Update endpoints one at a time** to call `requirePermission(event, 'pages.write')` etc. Mixed state is safe during the transition because every role carries both old and new permissions.
5. **Drop the broad permission** from `PERMISSIONS` once no endpoint references it, and run a final migration to strip it from custom roles.
