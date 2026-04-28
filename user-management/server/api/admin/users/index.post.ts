import { randomUUID } from 'crypto'
import { readBody, getHeader, getRequestURL } from 'h3'
import { db } from '../../../utils/database'
import {
  requirePermission,
  validateRoleNames,
  getRolePermissions,
  getUserPermissions
} from '../../../utils/rbac'
import { logEvent } from '../../../utils/activity-logger'
import { sendTemplateEmail } from '../../../utils/email'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default defineEventHandler(async (event) => {
  const admin = await requirePermission(event, 'users.invite')

  const body = await readBody(event)
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  const display_name = typeof body?.display_name === 'string' ? body.display_name.trim() : ''
  const inputRoles = Array.isArray(body?.roles) ? body.roles : null

  if (!EMAIL_RE.test(email)) {
    throw createError({ statusCode: 400, statusMessage: 'A valid email is required' })
  }

  if (display_name.length < 2) {
    throw createError({ statusCode: 400, statusMessage: 'Display name must be at least 2 characters' })
  }

  if (!inputRoles || inputRoles.some((r: unknown) => typeof r !== 'string')) {
    throw createError({ statusCode: 400, statusMessage: 'roles must be an array of strings' })
  }

  const roles = Array.from(new Set(inputRoles as string[]))

  const { valid, unknown } = await validateRoleNames(roles)
  if (!valid) {
    throw createError({ statusCode: 400, statusMessage: `Unknown role(s): ${unknown.join(', ')}` })
  }

  // Subset delegation: inviter can only assign roles whose permissions they hold.
  const [assignerPerms, assigningPerms] = await Promise.all([
    getUserPermissions(admin.userId),
    getRolePermissions(roles)
  ])
  const missing = [...assigningPerms].filter(p => !assignerPerms.has(p))
  if (missing.length > 0) {
    throw createError({
      statusCode: 403,
      statusMessage: `Cannot assign roles granting permissions you don't hold: ${missing.join(', ')}`
    })
  }

  const existing = await db
    .selectFrom('users')
    .select('id')
    .where('email', '=', email)
    .executeTakeFirst()

  if (existing) {
    throw createError({ statusCode: 409, statusMessage: 'A user with this email already exists' })
  }

  const userId = randomUUID()
  const tokenKey = randomUUID()
  const now = new Date()
  const expires = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

  await db
    .insertInto('users')
    .values({
      id: userId,
      created: now.toISOString(),
      updated: now.toISOString(),
      email,
      display_name,
      avatar: '',
      password: null,
      verified: false,
      roles,
      token_key: tokenKey,
      token_expires_at: expires.toISOString(),
    })
    .execute()

  const baseUrl = getRequestURL(event).origin
  const inviteUrl = `${baseUrl}/accept-invite?token=${tokenKey}`

  try {
    await sendTemplateEmail({
      to: email,
      template: 'invite',
      data: {
        userName: display_name,
        inviterName: admin.display_name,
        inviteUrl
      }
    })
  } catch (err) {
    console.error('Error sending invite email:', err)
  }

  await logEvent({
    eventType: 'invite_sent',
    tableName: 'users',
    recordId: userId,
    userId: admin.userId,
    userAgent: getHeader(event, 'user-agent') || undefined,
    metadata: { email, roles }
  })

  return {
    user: {
      id: userId,
      email,
      display_name,
      verified: false,
      roles,
      created: now.toISOString(),
      status: 'pending_invite'
    }
  }
})
