export default defineEventHandler(async (event) => {
  const authUser = getAuthUser(event)

  if (!authUser) {
    throw createError({ statusCode: 401, statusMessage: 'Not authenticated' })
  }

  // Get fresh user data from database
  const users = await sql`
    SELECT id, email, display_name, avatar, verified, superadmin, created, updated
    FROM users
    WHERE id = ${authUser.userId}
  `

  const user = users[0]

  if (!user) {
    throw createError({ statusCode: 404, statusMessage: 'User not found' })
  }

  return {
    user: {
      ...user,
      avatar: user.avatar || null
    }
  }
})
