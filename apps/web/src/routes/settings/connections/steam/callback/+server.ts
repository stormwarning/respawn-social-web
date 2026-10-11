import { redirect } from '@sveltejs/kit'
import { BackendError, linkAccount } from '$lib/server/backend'
import {
	STEAM_CALLBACK_PATH,
	STEAM_STATE_COOKIE,
	verifySteamAssertion,
} from '$lib/server/steam-openid'
import type { RequestHandler } from './$types'

/**
 * Steam sends the user back here. Verify the assertion, link the account, and
 * land on the connections page with the outcome in `?steam=`.
 */
export const GET: RequestHandler = async ({ locals, url, cookies, fetch }) => {
	if (!locals.user) redirect(303, '/login')

	const state = cookies.get(STEAM_STATE_COOKIE)
	cookies.delete(STEAM_STATE_COOKIE, { path: STEAM_CALLBACK_PATH })
	redirect(303, `/settings/connections/?steam=${await link(locals.user.did, state, url, fetch)}`)
}

async function link(
	did: string,
	state: string | undefined,
	url: URL,
	fetchFn: typeof fetch,
): Promise<'linked' | 'private' | 'conflict' | 'cancelled' | 'failed' | 'error'> {
	if (url.searchParams.get('openid.mode') === 'cancel') return 'cancelled'
	if (!state) return 'failed'

	// Steam's endpoint, so plain fetch: nothing from this request to forward.
	const steamId = await verifySteamAssertion(
		url.searchParams,
		`${url.origin}${STEAM_CALLBACK_PATH}?state=${state}`,
	)
	if (!steamId) return 'failed'

	try {
		const account = await linkAccount(did, 'steam', steamId, fetchFn)
		return account.status === 'private' ? 'private' : 'linked'
	} catch (err) {
		if (err instanceof BackendError && err.status === 409) return 'conflict'
		console.error('[settings/connections/steam] link failed', err)
		return 'error'
	}
}
