import type { Agent } from '@atproto/api'
import type { OAuthSession } from '@atproto/oauth-client-node'

declare global {
	namespace App {
		interface Locals {
			/** Restored OAuth session, present when the user is logged in. */
			atSession: OAuthSession | null
			/** Authed atproto Agent bound to the session, for PDS XRPC calls. */
			agent: Agent | null
			/** Lightweight current-user descriptor for SSR rendering. */
			user: { did: string; handle?: string } | null
		}
		// interface Error {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {}
