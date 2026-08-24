import type { Handle } from '@sveltejs/kit'
import { isExpectedSessionError } from '@atproto/oauth-client-node'
import { getOAuthClient } from '$lib/server/oauth/client'
import { agentFromSession } from '$lib/atproto/agent'
import { clearSessionCookie, readSessionCookie } from '$lib/server/session'
import { createTimings } from '$lib/server/timing'

/** Requests slower than this get their stage breakdown logged for triage. */
const SLOW_REQUEST_MS = 1000

/**
 * On every request, restore the OAuth session from the signed cookie and expose
 * an authed Agent on `event.locals` so all server loads / actions render
 * authenticated data via SSR — no client-side auth flash.
 */
export const handle: Handle = async ({ event, resolve }) => {
	const requestStart = performance.now()
	const timings = createTimings()
	event.locals.timings = timings
	event.locals.atSession = null
	event.locals.agent = null
	event.locals.user = null

	const did = readSessionCookie(event.cookies)
	if (did) {
		const stopSession = timings.start('session')
		try {
			const client = await getOAuthClient()
			const session = await client.restore(did)
			event.locals.atSession = session
			event.locals.agent = agentFromSession(session)
			event.locals.user = { did: session.did }
		} catch (err) {
			// Only drop the cookie when the session is genuinely unusable (revoked,
			// refresh rejected, malformed). A transient failure — Blobs hiccup, DNS,
			// PDS 5xx — must not log the user out: it renders this one request as
			// signed out and the next request restores normally.
			if (isExpectedSessionError(err)) {
				clearSessionCookie(event.cookies)
			} else {
				console.error('[hooks] session restore failed (keeping cookie)', err)
			}
		} finally {
			stopSession()
		}
	}

	const stopRender = timings.start('render')
	const response = await resolve(event)
	stopRender()

	const header = timings.header()
	response.headers.set('Server-Timing', header)
	if (performance.now() - requestStart > SLOW_REQUEST_MS) {
		console.warn(`[hooks] slow request ${event.request.method} ${event.url.pathname} — ${header}`)
	}

	return response
}
