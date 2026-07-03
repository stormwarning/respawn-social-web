import { redirect } from '@sveltejs/kit'
import { getOAuthClient } from '$lib/server/oauth/client'
import { clearSessionCookie, readSessionCookie } from '$lib/server/session'
import type { RequestHandler } from './$types'

export const POST: RequestHandler = async ({ cookies }) => {
	const did = readSessionCookie(cookies)
	if (did) {
		try {
			const client = await getOAuthClient()
			const session = await client.restore(did)
			await session.signOut() // revoke tokens + remove from session store
		} catch (err) {
			console.error('[logout] revoke failed', err)
		}
	}
	clearSessionCookie(cookies)
	redirect(303, '/')
}
