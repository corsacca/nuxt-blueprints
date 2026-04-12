import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { sql } from '../../utils/database'
import { logLoginFailed, logLogin } from '../../utils/activity-logger'
import { checkRateLimit, logRateLimitExceeded } from '../../utils/rate-limit'
import { readBody, getHeader, setResponseHeader, setCookie } from 'h3'
import { useRuntimeConfig, createError } from '#imports'

export default defineEventHandler(async (event) => {
  const { email, password } = await readBody(event)

  if (!email || !password) {
    throw createError({ statusCode: 400, statusMessage: 'Email and password are required' })
  }

  // Check rate limit before processing login
  const userAgent = getHeader(event, 'user-agent') || undefined
  const rateCheck = await checkRateLimit('LOGIN_FAILED', 'email', email, 15 * 60 * 1000, 5)

  if (!rateCheck.allowed) {
    logRateLimitExceeded(email, '/api/auth/login', userAgent)
    setResponseHeader(event, 'Retry-After', rateCheck.retryAfterSeconds!)
    throw createError({
      statusCode: 429,
      statusMessage: `Too many login attempts. Try again in ${Math.ceil(rateCheck.retryAfterSeconds! / 60)} minutes.`
    })
  }

  // Query existing user from database
  const users = await sql`
    SELECT * FROM users WHERE email = ${email}
  `

  const user = users[0]

  if (!user) {
    logLoginFailed(email, userAgent, { reason: 'user_not_found' })
    throw createError({ statusCode: 401, statusMessage: 'Invalid credentials' })
  }

  // Check if user is verified
  if (!user.verified) {
    logLoginFailed(email, userAgent, { reason: 'not_verified' })
    throw createError({ statusCode: 401, statusMessage: 'Please verify your email address before logging in' })
  }

  // Verify password
  const isValidPassword = await bcrypt.compare(password, user.password)
  if (!isValidPassword) {
    logLoginFailed(email, userAgent, { reason: 'invalid_password' })
    throw createError({ statusCode: 401, statusMessage: 'Invalid credentials' })
  }

  // Generate new JWT token
  const token = jwt.sign(
    { userId: user.id, email: user.email, display_name: user.display_name },
    useRuntimeConfig().jwtSecret,
    { expiresIn: '120d' }
  )

  // Set secure cookie
  setCookie(event, 'auth-token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 60 * 60 * 24 * 120 // 120 days
  })

  // Log successful login
  logLogin(user.id, userAgent)

  return {
    success: true,
    user: {
      id: user.id,
      email: user.email,
      display_name: user.display_name,
      avatar: user.avatar,
      verified: user.verified,
      superadmin: user.superadmin
    }
  }
})
