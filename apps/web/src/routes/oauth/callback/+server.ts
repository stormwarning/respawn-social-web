import { redirect } from '@sveltejs/kit'
import { getOAuthClient } from '$lib/server/oauth/client'
import { setSessionCookie } from '$lib/server/session'
import type { RequestHandler } from './$types'

export const GET: RequestHandler = async ({ url, cookies }) => {
	const client = await getOAuthClient()

	let did: string
	try {
		// Exchanges the auth code, validates state, and persists the session in
		// the session store. Returns the authenticated OAuth session.
		const { session } = await client.callback(url.searchParams)
		did = session.did
	} catch (err) {
		console.error('[oauth/callback] failed', err)
		redirect(303, '/login?error=callback')
	}

	setSessionCookie(cookies, did)
	redirect(303, '/')
}
