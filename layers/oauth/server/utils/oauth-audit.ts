import type { H3Event } from 'h3'
import { logEvent } from '~~/server/utils/activity-logger'

export const OAUTH_EVENTS = {
  CLIENT_REGISTERED: 'oauth.client_registered',
  CONSENT_GRANTED: 'oauth.consent_granted',
  CONSENT_DENIED: 'oauth.consent_denied',
  CONSENT_REVOKED: 'oauth.consent_revoked',
  SCOPE_REDUCED: 'oauth.scope_reduced',
  AUTHORIZATION_CODE_ISSUED: 'oauth.authorization_code_issued',
  AUTHORIZATION_CODE_REUSED: 'oauth.authorization_code_reused',
  TOKEN_ISSUED: 'oauth.token_issued',
  TOKEN_DENIED: 'oauth.token_denied',
  REFRESH_ROTATED: 'oauth.refresh_rotated',
  REFRESH_REUSED: 'oauth.refresh_reused',
  TOKEN_REVOKED: 'oauth.token_revoked',
  TOKEN_ISSUANCE_ABORTED_FAMILY_REVOKED: 'oauth.token_issuance_aborted_family_revoked'
} as const

interface OauthLogOptions {
  event: string
  userId?: string
  event3?: H3Event | null
  metadata?: Record<string, unknown>
}

// Never include token material (plaintext or hash) in metadata.
// Safe to include: client_id, user_id, resource, scope, family_id, reasons, ids (non-secret UUID).
export function logOauthEvent(options: OauthLogOptions): void {
  const userAgent = options.event3 ? (getHeader(options.event3, 'user-agent') || undefined) : undefined
  logEvent({
    eventType: options.event,
    userId: options.userId,
    userAgent,
    metadata: options.metadata ?? {}
  })
}
