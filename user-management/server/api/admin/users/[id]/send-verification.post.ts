import { getRouterParam, getHeader, getRequestURL } from 'h3'
import { db } from '../../../../utils/database'
import { requirePermission } from '../../../../utils/rbac'
import { logEvent } from '../../../../utils/activity-logger'
import { sendTemplateEmail } from '../../../../utils/email'

export default defineEventHandler(async (event) => {
  const admin = await requirePermission(event, 'users.verify')

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'User id is required' })
  }

  const target = await db
    .selectFrom('users')
    .select(['id', 'email', 'display_name', 'verified', 'token_key'])
    .where('id', '=', id)
    .executeTakeFirst()

  if (!target) {
    throw createError({ statusCode: 404, statusMessage: 'User not found' })
  }

  if (target.verified) {
    throw createError({ statusCode: 400, statusMessage: 'User is already verified' })
  }

  const baseUrl = getRequestURL(event).origin
  const verificationUrl = `${baseUrl}/api/auth/verify?token=${target.token_key}`

  const sent = await sendTemplateEmail({
    to: target.email,
    template: 'verification',
    data: {
      userName: target.display_name,
      verificationUrl
    }
  })

  if (!sent) {
    throw createError({ statusCode: 502, statusMessage: 'Failed to send verification email' })
  }

  await logEvent({
    eventType: 'admin_send_verification',
    tableName: 'users',
    recordId: id,
    userId: admin.userId,
    userAgent: getHeader(event, 'user-agent') || undefined,
    metadata: { email: target.email }
  })

  return { success: true }
})
