// OAuth 2.1 server layer for MCP-compatible token issuance.
// See README.md for consumer requirements.
export default defineNuxtConfig({
  runtimeConfig: {
    oauthConsentCookieSecret: process.env.OAUTH_CONSENT_COOKIE_SECRET || '',
    oauthAccessTokenTtlSeconds: 3600,
    oauthRefreshTokenTtlSeconds: 2592000,
    oauthAuthorizationCodeTtlSeconds: 60,
    oauthPendingRequestTtlSeconds: 300,
    oauthAllowDynamicClientRegistration: process.env.OAUTH_ALLOW_DCR === 'true',
    oauth: {
      loginPath: '/login'
    }
  }
})
