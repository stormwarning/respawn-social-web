import { describe, expect, it, vi } from 'vitest'
import {
	STEAM_OPENID_ENDPOINT,
	claimedSteamId,
	steamLoginUrl,
	verifySteamAssertion,
} from './steam-openid'

const RETURN_TO = 'https://respawn.social/settings/connections/steam/callback/?state=abc123'
const STEAM_ID = '76561197960287930'

function assertion(overrides: Record<string, string> = {}): URLSearchParams {
	return new URLSearchParams({
		'openid.ns': 'http://specs.openid.net/auth/2.0',
		'openid.mode': 'id_res',
		'openid.op_endpoint': STEAM_OPENID_ENDPOINT,
		'openid.claimed_id': `https://steamcommunity.com/openid/id/${STEAM_ID}`,
		'openid.identity': `https://steamcommunity.com/openid/id/${STEAM_ID}`,
		'openid.return_to': RETURN_TO,
		'openid.response_nonce': '2026-10-11T12:00:00Zabcdef',
		'openid.assoc_handle': '1234567890',
		'openid.signed': 'signed,op_endpoint,claimed_id,identity,return_to,response_nonce,assoc_handle',
		'openid.sig': 'c2lnbmF0dXJl',
		...overrides,
	})
}

describe('steamLoginUrl', () => {
	it('asks Steam to pick the identity and come back to us', () => {
		const url = new URL(steamLoginUrl(RETURN_TO, 'https://respawn.social'))
		expect(url.origin + url.pathname).toBe(STEAM_OPENID_ENDPOINT)
		expect(url.searchParams.get('openid.mode')).toBe('checkid_setup')
		expect(url.searchParams.get('openid.return_to')).toBe(RETURN_TO)
		expect(url.searchParams.get('openid.realm')).toBe('https://respawn.social')
	})
})

describe('claimedSteamId', () => {
	it('accepts a well-formed Steam assertion', () => {
		expect(claimedSteamId(assertion(), RETURN_TO)).toBe(STEAM_ID)
	})

	it('rejects an assertion meant for another browser', () => {
		// The state in return_to comes from the user's own cookie.
		const other = RETURN_TO.replace('abc123', 'someone-elses-state')
		expect(claimedSteamId(assertion(), other)).toBeNull()
	})

	it('rejects another OpenID provider', () => {
		const forged = assertion({ 'openid.op_endpoint': 'https://evil.example/openid/login' })
		expect(claimedSteamId(forged, RETURN_TO)).toBeNull()
	})

	it('rejects a claimed id that is not a Steam profile', () => {
		const id = 'https://evil.example/openid/id/76561197960287930'
		expect(
			claimedSteamId(assertion({ 'openid.claimed_id': id, 'openid.identity': id }), RETURN_TO),
		).toBeNull()
	})

	it('rejects an assertion whose signature leaves out the claimed id', () => {
		const unsigned = assertion({ 'openid.signed': 'signed,op_endpoint,return_to,response_nonce' })
		expect(claimedSteamId(unsigned, RETURN_TO)).toBeNull()
	})

	it('rejects a cancelled sign-in', () => {
		expect(claimedSteamId(assertion({ 'openid.mode': 'cancel' }), RETURN_TO)).toBeNull()
	})
})

describe('verifySteamAssertion', () => {
	it('trusts the id only once Steam confirms the signature', async () => {
		const fetchFn = vi.fn<typeof fetch>(
			async () => new Response('ns:http://specs.openid.net/auth/2.0\nis_valid:true\n'),
		)
		expect(await verifySteamAssertion(assertion(), RETURN_TO, fetchFn)).toBe(STEAM_ID)

		const [, init] = fetchFn.mock.calls[0]!
		const body = new URLSearchParams(String(init?.body))
		expect(body.get('openid.mode')).toBe('check_authentication')
		expect(body.get('openid.sig')).toBe('c2lnbmF0dXJl')
	})

	it('rejects what Steam says is invalid', async () => {
		const fetchFn = vi.fn<typeof fetch>(
			async () => new Response('ns:http://specs.openid.net/auth/2.0\nis_valid:false\n'),
		)
		expect(await verifySteamAssertion(assertion(), RETURN_TO, fetchFn)).toBeNull()
	})

	it('never asks Steam about an assertion that fails the local checks', async () => {
		const fetchFn = vi.fn<typeof fetch>()
		expect(await verifySteamAssertion(assertion(), `${RETURN_TO}x`, fetchFn)).toBeNull()
		expect(fetchFn).not.toHaveBeenCalled()
	})
})
