import { OAuth2Client } from 'google-auth-library'
import { randomUUID } from 'crypto'
import jwt from 'jsonwebtoken'
import { sql } from 'kysely'
import { db } from '../../utils/database'
import { logLogin, logLoginFailed } from '../../utils/activity-logger'
import { readBody, getHeader, setCookie } from 'h3'
import { useRuntimeConfig, createError } from '#imports'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()

  if (!config.googleClientId) {
    throw createError({ statusCode: 400, statusMessage: 'Google authentication is not configured' })
  }

  const { credential } = await readBody(event)

  if (!credential) {
    throw createError({ statusCode: 400, statusMessage: 'Google credential is required' })
  }

  const userAgent = getHeader(event, 'user-agent') || undefined

  // Verify the Google ID token
  let payload
  try {
    const client = new OAuth2Client(config.googleClientId)
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: config.googleClientId,
    })
    payload = ticket.getPayload()
  } catch {
    logLoginFailed('google-auth', userAgent, { reason: 'invalid_google_token' })
    throw createError({ statusCode: 401, statusMessage: 'Invalid Google token' })
  }

  if (!payload || !payload.email_verified) {
    throw createError({ statusCode: 401, statusMessage: 'Google email is not verified' })
  }

  const { sub: googleId, email, name, picture } = payload

  // Look up existing user by google_id first, then by email
  let user = await db
    .selectFrom('users')
    .selectAll()
    .where('google_id', '=', googleId)
    .executeTakeFirst()

  if (!user && email) {
    user = await db
      .selectFrom('users')
      .selectAll()
      .where('email', '=', email)
      .executeTakeFirst()

    if (user) {
      // Account linking: existing email/password user signing in with Google
      await db
        .updateTable('users')
        .set({
          google_id: googleId,
          verified: true,
          avatar: sql`CASE WHEN avatar = '' OR avatar IS NULL THEN ${picture || ''} ELSE avatar END`,
          updated: sql`now()`,
        })
        .where('id', '=', user.id)
        .execute()
      user.google_id = googleId
    }
  }

  if (!user) {
    // Create new Google-only user
    const userId = randomUUID()
    const tokenKey = randomUUID()
    const now = new Date().toISOString()
    const displayName = name || email!.split('@')[0]

    await db
      .insertInto('users')
      .values({
        id: userId,
        created: now,
        updated: now,
        email: email!,
        password: null,
        verified: true,
        superadmin: false,
        display_name: displayName,
        avatar: picture || '',
        token_key: tokenKey,
        google_id: googleId,
      })
      .execute()

    user = {
      id: userId,
      email: email!,
      display_name: displayName,
      avatar: picture || '',
      verified: true,
      superadmin: false,
    } as any
  }

  // Generate JWT token
  const token = jwt.sign(
    { userId: user!.id, email: user!.email, display_name: user!.display_name },
    config.jwtSecret,
    { expiresIn: '120d' }
  )

  // Set secure cookie
  setCookie(event, 'auth-token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 60 * 60 * 24 * 120
  })

  // Log successful login
  logLogin(user!.id, userAgent, { method: 'google' })

  return {
    success: true,
    user: {
      id: user!.id,
      email: user!.email,
      display_name: user!.display_name,
      avatar: user!.avatar,
      verified: user!.verified,
      superadmin: user!.superadmin,
    }
  }
})
