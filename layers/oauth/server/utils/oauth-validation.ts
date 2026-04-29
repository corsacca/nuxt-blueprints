import { isPermission, PERMISSIONS } from '~~/app/utils/permissions'
import type { Permission } from '~~/app/utils/permissions'
import { getRegisteredScopes } from './scopes-registry'

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])

export interface ParsedRedirectUri {
  valid: boolean
  serialized?: string
  error?: string
}

// Parses a redirect URI and enforces registration-time rules:
// absolute URL, https in production (http for loopback in dev), no fragment, no userinfo,
// no wildcards. Returns the serialized form (new URL(input).toString()) for exact-string match.
export function parseRedirectUri(input: string): ParsedRedirectUri {
  if (typeof input !== 'string' || input.length === 0) {
    return { valid: false, error: 'redirect_uri is required' }
  }
  if (input.length > 512) {
    return { valid: false, error: 'redirect_uri exceeds 512 characters' }
  }
  if (input.includes('*')) {
    return { valid: false, error: 'redirect_uri must not contain wildcards' }
  }
  if (input.includes('#')) {
    return { valid: false, error: 'redirect_uri must not contain a fragment' }
  }
  let url: URL
  try {
    url = new URL(input)
  } catch {
    return { valid: false, error: 'redirect_uri must be an absolute URL' }
  }
  if (!url.protocol || !url.host) {
    return { valid: false, error: 'redirect_uri must include a scheme and host' }
  }
  if (url.hash) {
    return { valid: false, error: 'redirect_uri must not contain a fragment' }
  }
  if (url.username || url.password) {
    return { valid: false, error: 'redirect_uri must not contain userinfo' }
  }
  const isHttps = url.protocol === 'https:'
  const isDevLoopback
    = url.protocol === 'http:'
      && process.env.NODE_ENV !== 'production'
      && LOOPBACK_HOSTS.has(url.hostname.toLowerCase())
  if (!isHttps && !isDevLoopback) {
    return { valid: false, error: 'redirect_uri must use https (http allowed only for loopback in dev)' }
  }
  return { valid: true, serialized: url.toString() }
}

export function buildRedirect(redirectUri: string, params: Record<string, string>): string {
  const url = new URL(redirectUri)
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.append(k, v)
  }
  return url.toString()
}

// Scope helpers — scopes in this layer are either permission strings from the
// consumer's PERMISSIONS list, or the literal `offline_access` (OAuth-protocol
// concept meaning "issue a refresh token"; not a permission).

export const OFFLINE_ACCESS_SCOPE = 'offline_access'

// The set of scopes the server advertises in /.well-known/* discovery and
// accepts at DCR time. Three sources contribute, in priority order:
//
//   1. The dynamic registry (`scopes-registry.ts`). Layers self-register
//      scopes their surface needs — e.g. the MCP layer's tool registry
//      calls `registerScope(tool.scope)` when each tool registers, so
//      a fresh deployment doesn't need to enumerate them in nuxt.config.
//   2. The consumer's `runtimeConfig.oauthAdvertisedScopes` runtime config.
//      Additive — for scopes outside any layer's auto-registered surface
//      (e.g. an admin REST surface using `admin.access` directly).
//   3. `offline_access` is always advertised when the dynamic-registry
//      path is active, since refresh-token semantics belong to OAuth itself
//      rather than any feature layer.
//
// Legacy fallback: if BOTH the registry and the consumer config are empty
// (an OAuth-only deployment with no MCP tools and no manual override),
// advertise the full PERMISSIONS catalog plus offline_access — the
// pre-registry default. Once any contribution arrives, the legacy path
// is replaced by the union above.
export function getAdvertisedScopes(): string[] {
  const dynamic = getRegisteredScopes()
  const fromConfig = (useRuntimeConfig().oauthAdvertisedScopes as string[] | undefined) ?? []

  if (dynamic.length === 0 && fromConfig.length === 0) {
    return [...PERMISSIONS, OFFLINE_ACCESS_SCOPE]
  }

  return Array.from(new Set([...dynamic, ...fromConfig, OFFLINE_ACCESS_SCOPE]))
}

export function parseScopeString(raw: string | undefined | null): string[] {
  if (!raw) return []
  return raw.split(/\s+/).filter(Boolean)
}

// True if the scope is a known permission OR the offline_access protocol scope.
export function isValidScope(scope: string): boolean {
  if (scope === OFFLINE_ACCESS_SCOPE) return true
  return isPermission(scope)
}

// Returns only scopes the user currently has the RBAC permission for.
// offline_access passes through unconditionally (it's not a permission).
export function filterScopesByPermissions(scopes: string[], userPermissions: Set<Permission>): string[] {
  const surviving: string[] = []
  for (const scope of scopes) {
    if (scope === OFFLINE_ACCESS_SCOPE) {
      surviving.push(scope)
      continue
    }
    if (isPermission(scope) && userPermissions.has(scope)) {
      surviving.push(scope)
    }
  }
  return surviving
}

// True if `subset` is fully covered by `superset`.
export function isScopeSubset(subset: string[], superset: string[]): boolean {
  const set = new Set(superset)
  return subset.every(s => set.has(s))
}

// True if at least one scope grants real access (i.e. there's a permission scope present,
// not just offline_access).
export function hasAnyPermissionScope(scopes: string[]): boolean {
  return scopes.some(s => s !== OFFLINE_ACCESS_SCOPE)
}
