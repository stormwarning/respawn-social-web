/**
 * "Sign in through Steam" — OpenID 2.0, used only to learn which Steam account
 * is the user's. Steam has no OAuth for third parties; this is the sanctioned
 * way to prove account ownership, and it yields nothing but a SteamID64.
 *
 * Everything in the callback's query string is attacker-controlled until Steam
 * itself confirms it (`check_authentication`). The local checks below run
 * first so a forged or replayed assertion never costs a request to Steam:
 *
 *   - `return_to` must be exactly the URL we sent, including the state that is
 *     also in the user's cookie. That ties the assertion to this browser, so
 *     someone cannot link their Steam account to a victim's Respawn account by
 *     getting them to open a callback URL.
 *   - The provider and claimed id must be Steam's.
 */

/** Cookie holding the state for one sign-in attempt, scoped to the callback. */
export const STEAM_STATE_COOKIE = 'rs_steam_state'
export const STEAM_CALLBACK_PATH = '/settings/connections/steam/callback/'

export const STEAM_OPENID_ENDPOINT = 'https://steamcommunity.com/openid/login'
const OPENID_NS = 'http://specs.openid.net/auth/2.0'
const IDENTIFIER_SELECT = 'http://specs.openid.net/auth/2.0/identifier_select'
const CLAIMED_ID = /^https:\/\/steamcommunity\.com\/openid\/id\/(7656119\d{10})$/

/** Where to send the user to sign in through Steam. */
export function steamLoginUrl(returnTo: string, realm: string): string {
	const params = new URLSearchParams({
		'openid.ns': OPENID_NS,
		'openid.mode': 'checkid_setup',
		'openid.return_to': returnTo,
		'openid.realm': realm,
		'openid.identity': IDENTIFIER_SELECT,
		'openid.claimed_id': IDENTIFIER_SELECT,
	})
	return `${STEAM_OPENID_ENDPOINT}?${params}`
}

/**
 * The SteamID64 an assertion claims, if it passes every local check. Not proof
 * on its own: Steam has to confirm the signature (`verifySteamAssertion`).
 */
export function claimedSteamId(params: URLSearchParams, expectedReturnTo: string): string | null {
	if (params.get('openid.ns') !== OPENID_NS) return null
	if (params.get('openid.mode') !== 'id_res') return null
	if (params.get('openid.op_endpoint') !== STEAM_OPENID_ENDPOINT) return null
	if (params.get('openid.return_to') !== expectedReturnTo) return null

	const claimed = params.get('openid.claimed_id') ?? ''
	if (params.get('openid.identity') !== claimed) return null
	// The signature has to cover the fields we rely on, or Steam's "valid"
	// would vouch for a message with those fields swapped out.
	const signed = new Set((params.get('openid.signed') ?? '').split(','))
	for (const field of ['op_endpoint', 'claimed_id', 'identity', 'return_to', 'response_nonce']) {
		if (!signed.has(field)) return null
	}

	return CLAIMED_ID.exec(claimed)?.[1] ?? null
}

/**
 * Check the assertion locally, then have Steam confirm its signature. Returns
 * the SteamID64 only when both pass.
 */
export async function verifySteamAssertion(
	params: URLSearchParams,
	expectedReturnTo: string,
	fetchFn: typeof fetch = fetch,
): Promise<string | null> {
	const steamId = claimedSteamId(params, expectedReturnTo)
	if (!steamId) return null

	// Echo every openid.* field back with the mode switched; Steam answers in
	// key:value lines and says `is_valid:true` only for its own signature.
	const body = new URLSearchParams()
	for (const [key, value] of params) {
		if (key.startsWith('openid.')) body.set(key, value)
	}
	body.set('openid.mode', 'check_authentication')

	const res = await fetchFn(STEAM_OPENID_ENDPOINT, {
		method: 'POST',
		headers: { 'content-type': 'application/x-www-form-urlencoded' },
		body,
	})
	if (!res.ok) return null

	const lines = (await res.text()).split('\n').map((line) => line.trim())
	return lines.includes('is_valid:true') ? steamId : null
}
