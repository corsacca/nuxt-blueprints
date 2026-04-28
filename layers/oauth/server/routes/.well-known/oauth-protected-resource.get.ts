import { PERMISSIONS } from '~~/app/utils/permissions'
import { getOauthConfig } from '../../utils/oauth-config'
import { OFFLINE_ACCESS_SCOPE } from '../../utils/oauth-validation'

export default defineEventHandler(() => {
  const cfg = getOauthConfig()
  return {
    resource: cfg.mcpResource,
    authorization_servers: [cfg.issuer],
    scopes_supported: [...PERMISSIONS, OFFLINE_ACCESS_SCOPE],
    bearer_methods_supported: ['header']
  }
})
