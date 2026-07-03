import { Agent } from '@atproto/api'
import type { OAuthSession } from '@atproto/oauth-client-node'

/**
 * Build an authenticated atproto Agent bound to an OAuth session. The agent
 * issues DPoP-signed XRPC calls to the user's PDS; token refresh is handled
 * transparently by the underlying OAuth session.
 */
export function agentFromSession(session: OAuthSession): Agent {
	return new Agent(session)
}
