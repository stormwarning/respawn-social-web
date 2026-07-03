import { createHmac, timingSafeEqual } from 'node:crypto'
import type { Cookies } from '@sveltejs/kit'
import { env } from '$env/dynamic/private'

const COOKIE_NAME = 'rs_session'
const MAX_AGE = 60 * 60 * 24 * 30 // 30 days

function secret(): string {
	const s = env.COOKIE_SECRET
	if (!s) throw new Error('COOKIE_SECRET is not set')
	return s
}

function sign(value: string): string {
	return createHmac('sha256', secret()).update(value).digest('base64url')
}

/** Store the user's DID in a tamper-evident (HMAC-signed) cookie. */
export function setSessionCookie(cookies: Cookies, did: string): void {
	const payload = `${did}.${sign(did)}`
	cookies.set(COOKIE_NAME, payload, {
		path: '/',
		httpOnly: true,
		secure: !!env.APP_URL, // dev over http; prod over https
		sameSite: 'lax',
		maxAge: MAX_AGE,
	})
}

export function clearSessionCookie(cookies: Cookies): void {
	cookies.delete(COOKIE_NAME, { path: '/' })
}

/** Return the verified DID from the cookie, or null if absent/invalid. */
export function readSessionCookie(cookies: Cookies): string | null {
	const raw = cookies.get(COOKIE_NAME)
	if (!raw) return null

	const idx = raw.lastIndexOf('.')
	if (idx <= 0) return null

	const did = raw.slice(0, idx)
	const mac = raw.slice(idx + 1)
	const expected = sign(did)

	const a = Buffer.from(mac)
	const b = Buffer.from(expected)
	if (a.length !== b.length || !timingSafeEqual(a, b)) return null

	return did
}
