import { getQuery } from 'h3'
import { db } from '../../utils/database'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const token = typeof query.token === 'string' ? query.token : ''

  if (!token) {
    throw createError({ statusCode: 400, statusMessage: 'Token is required' })
  }

  const user = await db
    .selectFrom('users')
    .select(['email', 'display_name', 'token_expires_at', 'password', 'verified'])
    .where('token_key', '=', token)
    .executeTakeFirst()

  if (!user || user.verified || user.password !== null) {
    throw createError({ statusCode: 404, statusMessage: 'Invitation not found' })
  }

  const expires = user.token_expires_at ? new Date(user.token_expires_at) : null
  if (!expires || expires.getTime() <= Date.now()) {
    throw createError({ statusCode: 410, statusMessage: 'Invitation has expired' })
  }

  return {
    email: user.email,
    display_name: user.display_name
  }
})
