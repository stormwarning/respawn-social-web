import { randomBytes } from 'node:crypto'
import { redirect } from '@sveltejs/kit'
import { env } from '$env/dynamic/private'
import { STEAM_CALLBACK_PATH, STEAM_STATE_COOKIE, steamLoginUrl } from '$lib/server/steam-openid'
import type { RequestHandler } from './$types'

/** Start "Sign in through Steam". The callback links whatever account comes back. */
export const GET: RequestHandler = ({ locals, url, cookies }) => {
	if (!locals.user) redirect(303, '/login')

	// Bound into return_to, which Steam signs, and kept in a cookie only this
	// browser has. The callback requires both to match.
	const state = randomBytes(16).toString('base64url')
	cookies.set(STEAM_STATE_COOKIE, state, {
		path: STEAM_CALLBACK_PATH,
		httpOnly: true,
		secure: !!env.APP_URL,
		// Lax, not strict: Steam sends the user back with a top-level GET from
		// its own origin, and strict would drop the cookie on exactly that.
		sameSite: 'lax',
		maxAge: 60 * 10,
	})

	const returnTo = `${url.origin}${STEAM_CALLBACK_PATH}?state=${state}`
	redirect(303, steamLoginUrl(returnTo, url.origin))
}
