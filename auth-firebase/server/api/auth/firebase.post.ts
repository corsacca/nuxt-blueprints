import admin from 'firebase-admin'
import { randomUUID } from 'crypto'
import jwt from 'jsonwebtoken'
import { sql } from 'kysely'
import { db } from '../../utils/database'
import { logLogin, logLoginFailed } from '../../utils/activity-logger'
import { readBody, getHeader, setCookie } from 'h3'
import { useRuntimeConfig, createError } from '#imports'

function getFirebaseAdmin() {
  if (admin.apps.length) return admin

  const config = useRuntimeConfig()
  if (!config.firebaseServiceAccount) {
    throw createError({ statusCode: 400, statusMessage: 'Firebase authentication is not configured' })
  }

  let serviceAccount
  try {
    serviceAccount = JSON.parse(config.firebaseServiceAccount as string)
  } catch {
    throw createError({ statusCode: 500, statusMessage: 'Invalid Firebase service account configuration' })
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  })

  return admin
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const { idToken } = await readBody(event)

  if (!idToken) {
    throw createError({ statusCode: 400, statusMessage: 'Firebase ID token is required' })
  }

  const userAgent = getHeader(event, 'user-agent') || undefined

  // Verify the Firebase ID token
  let decodedToken
  try {
    const firebaseAdmin = getFirebaseAdmin()
    decodedToken = await firebaseAdmin.auth().verifyIdToken(idToken)
  } catch (err: any) {
    if (err.statusCode) throw err // Re-throw config errors
    logLoginFailed('firebase-auth', userAgent, { reason: 'invalid_firebase_token' })
    throw createError({ statusCode: 401, statusMessage: 'Invalid Firebase token' })
  }

  if (!decodedToken.email_verified) {
    throw createError({ statusCode: 401, statusMessage: 'Email is not verified' })
  }

  const { uid: firebaseUid, email, name, picture } = decodedToken

  // Look up existing user by firebase_uid first, then by email
  let user = await db
    .selectFrom('users')
    .selectAll()
    .where('firebase_uid', '=', firebaseUid)
    .executeTakeFirst()

  if (!user && email) {
    user = await db
      .selectFrom('users')
      .selectAll()
      .where('email', '=', email)
      .executeTakeFirst()

    if (user) {
      // Account linking: existing email/password user signing in with Firebase
      await db
        .updateTable('users')
        .set({
          firebase_uid: firebaseUid,
          verified: true,
          avatar: sql`CASE WHEN avatar = '' OR avatar IS NULL THEN ${picture || ''} ELSE avatar END`,
          updated: sql`now()`,
        })
        .where('id', '=', user.id)
        .execute()
      user.firebase_uid = firebaseUid
    }
  }

  if (!user) {
    // Create new Firebase-only user
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
        roles: [],
        display_name: displayName,
        avatar: picture || '',
        token_key: tokenKey,
        firebase_uid: firebaseUid,
      })
      .execute()

    user = {
      id: userId,
      email: email!,
      display_name: displayName,
      avatar: picture || '',
      verified: true,
      roles: [],
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
  logLogin(user!.id, userAgent, { method: 'firebase' })

  return {
    success: true,
    user: {
      id: user!.id,
      email: user!.email,
      display_name: user!.display_name,
      avatar: user!.avatar,
      verified: user!.verified,
      roles: user!.roles,
    }
  }
})
