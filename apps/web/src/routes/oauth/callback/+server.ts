import { redirect } from '@sveltejs/kit'
import type { OAuthSession } from '@atproto/oauth-client-node'
import { agentFromSession } from '$lib/atproto/agent'
import { ensureRespawnProfile } from '$lib/atproto/profile'
import { getOAuthClient } from '$lib/server/oauth/client'
import { forgetProfile } from '$lib/server/profile-cache'
import { setSessionCookie } from '$lib/server/session'
import type { RequestHandler } from './$types'

export const GET: RequestHandler = async ({ url, cookies }) => {
	const client = await getOAuthClient()

	let session: OAuthSession
	try {
		// Exchanges the auth code, validates state, and persists the session in
		// the session store. Returns the authenticated OAuth session.
		;({ session } = await client.callback(url.searchParams))
	} catch (err) {
		console.error('[oauth/callback] failed', err)
		redirect(303, '/login?error=callback')
	}

	setSessionCookie(cookies, session.did)

	// Seed the Respawn profile from Bluesky. Kept out of the redirect's try so a
	// mirror failure never blocks sign-in.
	try {
		await ensureRespawnProfile(agentFromSession(session), session.did)
		// A container that served this actor before sign-in may hold a pre-seed
		// read; the redirect below lands on a page that renders the header.
		forgetProfile(session.did)
	} catch (err) {
		console.error('[oauth/callback] profile bootstrap failed', err)
	}

	redirect(303, '/')
}
