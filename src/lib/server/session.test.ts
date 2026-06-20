import { describe, expect, it, vi } from 'vitest'

// Force a known secret before importing the module under test.
vi.mock('$env/dynamic/private', () => ({ env: { COOKIE_SECRET: 'test-secret', APP_URL: '' } }))

const { setSessionCookie, readSessionCookie, clearSessionCookie } = await import('./session')

function fakeCookies() {
	const jar = new Map<string, string>()
	return {
		get: (k: string) => jar.get(k),
		set: (k: string, v: string) => jar.set(k, v),
		delete: (k: string) => jar.delete(k),
		_jar: jar,
	} as any
}

describe('session cookie', () => {
	it('round-trips a signed DID', () => {
		const cookies = fakeCookies()
		setSessionCookie(cookies, 'did:plc:abc123')
		expect(readSessionCookie(cookies)).toBe('did:plc:abc123')
	})

	it('rejects a tampered cookie', () => {
		const cookies = fakeCookies()
		setSessionCookie(cookies, 'did:plc:abc123')
		cookies.set('rs_session', 'did:plc:evil.deadbeef')
		expect(readSessionCookie(cookies)).toBeNull()
	})

	it('clears the cookie', () => {
		const cookies = fakeCookies()
		setSessionCookie(cookies, 'did:plc:abc123')
		clearSessionCookie(cookies)
		expect(readSessionCookie(cookies)).toBeNull()
	})
})
