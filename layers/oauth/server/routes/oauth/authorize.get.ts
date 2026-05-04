import { sql } from 'kysely'
import { db } from '~~/server/utils/database'
import { getAuthUser } from '~~/server/utils/auth'
import { getUserPermissions } from '~~/server/utils/rbac'
import { checkRateLimit, logRateLimitExceeded } from '~~/server/utils/rate-limit'
import { getOauthConfig } from '../../utils/oauth-config'
import {
  isValidS256Challenge,
  newCsrfToken,
  sha256Hex,
  signCookiePayload
} from '../../utils/oauth-crypto'
import {
  buildRedirect,
  parseRedirectUri,
  matchesRegisteredRedirect,
  filterScopesByPermissions,
  hasAnyPermissionScope,
  isScopeSubset,
  parseScopeString
} from '../../utils/oauth-validation'
import { logOauthEvent, OAUTH_EVENTS } from '../../utils/oauth-audit'
import type { H3Event } from 'h3'

function sendHtmlError(event: H3Event, status: number, title: string, message: string): string {
  setResponseStatus(event, status)
  setResponseHeader(event, 'content-type', 'text/html; charset=utf-8')
  return `<!doctype html><html><head><title>${title}</title></head><body style="font-family:system-ui;max-width:560px;margin:4rem auto;padding:0 1rem"><h1>${title}</h1><p>${message}</p></body></html>`
}

export default defineEventHandler(async (event) => {
  const cfg = getOauthConfig()
  const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
  const userAgent = getHeader(event, 'user-agent') || undefined

  const rate = await checkRateLimit('oauth.authorize_attempt', 'ip', ip, 60 * 1000, 60)
  if (!rate.allowed) {
    logRateLimitExceeded(ip, '/oauth/authorize', userAgent)
    setResponseStatus(event, 429)
    if (rate.retryAfterSeconds) setResponseHeader(event, 'Retry-After', rate.retryAfterSeconds)
    return 'Rate limit exceeded'
  }

  const q = getQuery(event) as Record<string, string | string[] | undefined>
  const pick = (k: string): string | undefined => {
    const v = q[k]
    if (Array.isArray(v)) return v[0]
    return v
  }

  const responseType = pick('response_type')
  const responseMode = pick('response_mode')
  const clientIdParam = pick('client_id')
  const redirectUriRaw = pick('redirect_uri')
  const scopeParam = pick('scope') ?? ''
  const state = pick('state') ?? null
  const codeChallenge = pick('code_challenge')
  const codeChallengeMethod = pick('code_challenge_method')
  const resourceParam = pick('resource')

  // Tier 1: untrusted-redirect-target errors → server HTML 400.
  if (!clientIdParam) {
    return sendHtmlError(event, 400, 'Invalid authorization request', 'Missing <code>client_id</code>.')
  }
  const client = await db
    .selectFrom('oauth_clients')
    .selectAll()
    .where('client_id', '=', clientIdParam)
    .executeTakeFirst()
  if (!client || !client.enabled) {
    return sendHtmlError(event, 400, 'Invalid authorization request', 'The requested client is not registered or has been disabled.')
  }

  if (!redirectUriRaw) {
    return sendHtmlError(event, 400, 'Invalid authorization request', 'Missing <code>redirect_uri</code>.')
  }
  const parsedRedirect = parseRedirectUri(redirectUriRaw)
  if (!parsedRedirect.valid || !parsedRedirect.serialized) {
    return sendHtmlError(event, 400, 'Invalid authorization request', `<code>redirect_uri</code> is invalid: ${parsedRedirect.error}`)
  }
  const normalizedRedirect = parsedRedirect.serialized
  // RFC 8252 §7.3: loopback URIs match across ports — see
  // matchesRegisteredRedirect for the fuzzy semantics. Non-loopback
  // URIs still require exact-string match against the registered set.
  if (!matchesRegisteredRedirect(normalizedRedirect, client.redirect_uris)) {
    return sendHtmlError(event, 400, 'Invalid authorization request', 'The provided <code>redirect_uri</code> is not registered for this client.')
  }

  if (responseType !== 'code') {
    return sendHtmlError(event, 400, 'Invalid authorization request', 'Only <code>response_type=code</code> is supported.')
  }
  if (responseMode && responseMode !== 'query') {
    return sendHtmlError(event, 400, 'Invalid authorization request', 'Only <code>response_mode=query</code> is supported.')
  }

  // From here, errors can safely redirect back to the validated redirect URI.
  const errRedirect = (err: string, desc?: string): string => {
    const params: Record<string, string> = { error: err, iss: cfg.issuer }
    if (desc) params.error_description = desc
    if (state) params.state = state
    return buildRedirect(normalizedRedirect, params)
  }

  // RFC 6749 doesn't bound `state`, but we store it in oauth_pending_requests
  // and echo it on the redirect — uncapped strings are a free DoS / DB-bloat
  // vector. 2 KB is well above any sane client (most use 16-32 byte nonces).
  if (state !== null && state.length > 2048) {
    await sendRedirect(event, errRedirect('invalid_request', 'state exceeds 2048 characters'))
    return
  }

  // PKCE
  if (codeChallengeMethod !== 'S256') {
    await sendRedirect(event, errRedirect('invalid_request', 'code_challenge_method must be S256'))
    return
  }
  if (!codeChallenge || !isValidS256Challenge(codeChallenge)) {
    await sendRedirect(event, errRedirect('invalid_request', 'code_challenge missing or malformed'))
    return
  }

  // Resource
  if (!resourceParam || resourceParam !== cfg.mcpResource) {
    await sendRedirect(event, errRedirect('invalid_target', 'resource parameter missing or does not match'))
    return
  }

  // Must be logged in — if not, redirect to login page with resume URL.
  const authUser = getAuthUser(event)
  if (!authUser) {
    const url = getRequestURL(event)
    const self = url.pathname + url.search
    const resumeUrl = `${cfg.loginPath}?redirect=${encodeURIComponent(self)}`
    await sendRedirect(event, resumeUrl)
    return
  }

  // Scope: requested must be subset of client cap, then intersect with user RBAC.
  // RFC 6749 §3.3 — when the client omits `scope`, fall back to the client's
  // registered cap. Native MCP clients (e.g. Cursor) routinely omit it on the
  // authorize call since they already pinned the scope set at DCR time.
  const clientCap = parseScopeString(client.scope)
  const requestedScopes = scopeParam.trim().length === 0
    ? clientCap
    : parseScopeString(scopeParam)
  if (requestedScopes.length === 0 || !isScopeSubset(requestedScopes, clientCap)) {
    await sendRedirect(event, errRedirect('invalid_scope', 'Requested scope is empty or not permitted for this client'))
    return
  }

  const userPerms = await getUserPermissions(authUser.userId)
  const grantedScopes = filterScopesByPermissions(requestedScopes, userPerms)
  if (grantedScopes.length !== requestedScopes.length) {
    logOauthEvent({
      event: OAUTH_EVENTS.SCOPE_REDUCED,
      userId: authUser.userId,
      event3: event,
      metadata: {
        client_id: client.client_id,
        requested: requestedScopes.join(' '),
        granted: grantedScopes.join(' ')
      }
    })
  }

  if (!hasAnyPermissionScope(grantedScopes)) {
    await sendRedirect(event, errRedirect('invalid_scope', 'No permission scope can be granted for this user'))
    return
  }

  // Existing consent short-circuit.
  const existingConsent = await db
    .selectFrom('oauth_consents')
    .selectAll()
    .where('client_id', '=', client.client_id)
    .where('user_id', '=', authUser.userId)
    .where('resource', '=', cfg.mcpResource)
    .where('revoked', '=', false)
    .executeTakeFirst()

  const consentCoversScope = existingConsent
    && isScopeSubset(grantedScopes, parseScopeString(existingConsent.scope))

  if (consentCoversScope) {
    // Skip consent UI — issue a code directly.
    const { issueCode } = await import('../../utils/oauth-issue-code')
    const { code } = await issueCode({
      clientId: client.client_id,
      userId: authUser.userId,
      redirectUri: normalizedRedirect,
      scope: grantedScopes.join(' '),
      resource: cfg.mcpResource,
      codeChallenge,
      event
    })
    const params: Record<string, string> = { code, iss: cfg.issuer }
    if (state) params.state = state
    await sendRedirect(event, buildRedirect(normalizedRedirect, params))
    return
  }

  // Build pending request + CSRF synchronizer token.
  const csrfPlaintext = newCsrfToken()
  const csrfHash = sha256Hex(csrfPlaintext)
  const pendingRow = await db
    .insertInto('oauth_pending_requests')
    .values({
      expires: sql<Date>`now() + interval '${sql.raw(String(cfg.pendingRequestTtl))} seconds'`,
      client_id: client.client_id,
      user_id: authUser.userId,
      redirect_uri: normalizedRedirect,
      scope: grantedScopes.join(' '),
      resource: cfg.mcpResource,
      state,
      code_challenge: codeChallenge,
      csrf_token_hash: csrfHash
    })
    .returning('id')
    .executeTakeFirstOrThrow()

  // Signed HttpOnly cookie carries the CSRF plaintext to the consent SSR.
  const cookieValue = signCookiePayload(
    { rid: pendingRow.id, csrf: csrfPlaintext, exp: Date.now() + cfg.pendingRequestTtl * 1000 },
    cfg.consentCookieSecret
  )
  setCookie(event, `oauth_consent_token_${pendingRow.id}`, cookieValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/oauth/',
    maxAge: cfg.pendingRequestTtl
  })

  await sendRedirect(event, `/oauth/consent?request_id=${pendingRow.id}`)
})
