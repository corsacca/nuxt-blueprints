import { getUserPermissions } from '../../utils/rbac'

export default defineEventHandler(async (event) => {
  const authUser = getAuthUser(event)

  if (!authUser) {
    throw createError({ statusCode: 401, statusMessage: 'Not authenticated' })
  }

  // Get fresh user data from database
  const user = await db
    .selectFrom('users')
    .select(['id', 'email', 'display_name', 'avatar', 'verified', 'roles', 'created', 'updated'])
    .where('id', '=', authUser.userId)
    .executeTakeFirst()

  if (!user) {
    throw createError({ statusCode: 404, statusMessage: 'User not found' })
  }

  const permissions = await getUserPermissions(user.id)

  return {
    user: {
      ...user,
      avatar: user.avatar || null,
      permissions: [...permissions]
    }
  }
})
