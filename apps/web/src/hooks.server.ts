import type { Handle } from '@sveltejs/kit'
import { TokenRefreshError } from '@atproto/oauth-client-node'
import { getOAuthClient } from '$lib/server/oauth/client'
import { agentFromSession } from '$lib/atproto/agent'
import { clearSessionCookie, readSessionCookie } from '$lib/server/session'

/**
 * On every request, restore the OAuth session from the signed cookie and expose
 * an authed Agent on `event.locals` so all server loads / actions render
 * authenticated data via SSR — no client-side auth flash.
 */
export const handle: Handle = async ({ event, resolve }) => {
	event.locals.atSession = null
	event.locals.agent = null
	event.locals.user = null

	const did = readSessionCookie(event.cookies)
	if (did) {
		try {
			const client = await getOAuthClient()
			const session = await client.restore(did)
			event.locals.atSession = session
			event.locals.agent = agentFromSession(session)
			event.locals.user = { did: session.did }
		} catch (err) {
			// Session expired or refresh failed — drop the cookie, treat as logged out.
			if (err instanceof TokenRefreshError) {
				clearSessionCookie(event.cookies)
			} else {
				console.error('[hooks] session restore failed', err)
				clearSessionCookie(event.cookies)
			}
		}
	}

	return resolve(event)
}
