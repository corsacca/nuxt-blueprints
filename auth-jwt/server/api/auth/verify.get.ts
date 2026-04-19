export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const token = query.token as string

  if (!token) {
    throw createError({ statusCode: 400, statusMessage: 'Verification token is required' })
  }

  try {
    // Find user with this token
    const user = await db
      .selectFrom('users')
      .select(['id', 'verified'])
      .where('token_key', '=', token)
      .executeTakeFirst()

    if (!user) {
      throw createError({ statusCode: 404, statusMessage: 'Invalid verification token' })
    }

    if (user.verified) {
      // Already verified, redirect to login with message
      return sendRedirect(event, '/login?verified=already')
    }

    // Mark user as verified
    await db
      .updateTable('users')
      .set({ verified: true, updated: new Date().toISOString() })
      .where('id', '=', user.id)
      .execute()

    // Redirect to login with success message
    return sendRedirect(event, '/login?verified=success')
  } catch (error) {
    console.error('Email verification error:', error)
    throw createError({ statusCode: 500, statusMessage: 'Email verification failed' })
  }
})
