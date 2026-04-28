import { db } from '~~/server/utils/database'
import { requireAuth } from '~~/server/utils/auth'
import { getOauthConfig } from '../../utils/oauth-config'
import { sha256Hex, constantTimeEqual } from '../../utils/oauth-crypto'
import { buildRedirect } from '../../utils/oauth-validation'
import { issueCode } from '../../utils/oauth-issue-code'
import { logOauthEvent, OAUTH_EVENTS } from '../../utils/oauth-audit'

function abort(status: number, message: string): never {
  throw createError({ statusCode: status, statusMessage: message })
}

export default defineEventHandler(async (event) => {
  const user = requireAuth(event)
  const cfg = getOauthConfig()

  const body = await readBody<Record<string, unknown>>(event).catch(() => null)
  const requestId = body?.request_id ? String(body.request_id) : ''
  const action = body?.action ? String(body.action) : ''
  const submittedCsrf = body?.csrf_token ? String(body.csrf_token) : ''

  if (!requestId || !action) {
    abort(400, 'Missing required fields')
  }
  if (action !== 'approve' && action !== 'deny') {
    abort(400, 'action must be approve or deny')
  }

  const pending = await db
    .selectFrom('oauth_pending_requests')
    .selectAll()
    .where('id', '=', requestId)
    .executeTakeFirst()

  if (!pending) abort(400, 'Request not found')
  if (pending.consumed) abort(410, 'Already completed')
  if (new Date(pending.expires) < new Date()) abort(410, 'Expired')
  if (pending.user_id !== user.userId) abort(400, 'User mismatch')

  // Validate CSRF (constant-time hash compare)
  const submittedHash = sha256Hex(submittedCsrf)
  if (!constantTimeEqual(submittedHash, pending.csrf_token_hash)) {
    abort(400, 'Invalid CSRF token')
  }

  // Atomically consume
  const consumed = await db
    .updateTable('oauth_pending_requests')
    .set({ consumed: true })
    .where('id', '=', requestId)
    .where('consumed', '=', false)
    .returning('id')
    .executeTakeFirst()

  if (!consumed) abort(410, 'Already consumed')

  // Clear consent cookie
  deleteCookie(event, `oauth_consent_token_${requestId}`, { path: '/oauth/' })

  if (action === 'deny') {
    logOauthEvent({
      event: OAUTH_EVENTS.CONSENT_DENIED,
      userId: user.userId,
      event3: event,
      metadata: {
        client_id: pending.client_id,
        resource: pending.resource,
        scope: pending.scope
      }
    })
    const params: Record<string, string> = {
      error: 'access_denied',
      iss: cfg.issuer
    }
    if (pending.state) params.state = pending.state
    await sendRedirect(event, buildRedirect(pending.redirect_uri, params))
    return
  }

  // Approve: upsert consent, issue code
  await db.executeQuery(db
    .insertInto('oauth_consents')
    .values({
      client_id: pending.client_id,
      user_id: pending.user_id,
      resource: pending.resource,
      scope: pending.scope,
      revoked: false
    })
    .onConflict(oc => oc
      .columns(['client_id', 'user_id', 'resource'])
      .doUpdateSet({
        scope: pending.scope,
        revoked: false,
        updated: new Date()
      })
    )
    .compile()
  )

  logOauthEvent({
    event: OAUTH_EVENTS.CONSENT_GRANTED,
    userId: user.userId,
    event3: event,
    metadata: {
      client_id: pending.client_id,
      resource: pending.resource,
      scope: pending.scope
    }
  })

  const { code } = await issueCode({
    clientId: pending.client_id,
    userId: pending.user_id,
    redirectUri: pending.redirect_uri,
    scope: pending.scope,
    resource: pending.resource,
    codeChallenge: pending.code_challenge,
    event
  })

  const params: Record<string, string> = {
    code,
    iss: cfg.issuer
  }
  if (pending.state) params.state = pending.state
  await sendRedirect(event, buildRedirect(pending.redirect_uri, params))
})
