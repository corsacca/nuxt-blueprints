import { db } from '../../../utils/database'
import { requirePermission } from '../../../utils/rbac'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'roles.view')

  const rows = await db
    .selectFrom('custom_roles')
    .select(['id', 'name', 'description', 'permissions', 'created', 'updated'])
    .orderBy('name', 'asc')
    .execute()

  return { roles: rows }
})
