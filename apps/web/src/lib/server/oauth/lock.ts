import { randomUUID } from 'node:crypto'
import type { RuntimeLock } from '@atproto/oauth-client-node'
import { resolveStore, type TextKV } from './blob-store'

/**
 * Cross-instance mutex for @atproto/oauth-client-node's `requestLock`.
 *
 * Why this exists: OAuth refresh tokens are single-use. Every request restores
 * the session, and once the access token nears expiry each restore tries to
 * refresh it. A page navigation fans out into several server requests (layout
 * data, page data, prefetches) that land on different Netlify function
 * instances, so with no shared lock two instances send the same refresh token
 * at once. The PDS treats the second use as token theft and revokes the whole
 * session -> `invalid_grant` -> TokenRefreshError -> the hooks clear the cookie
 * and the user is logged out mid-browse.
 *
 * Built on Netlify Blobs' `onlyIfNew` conditional write, which is an atomic
 * create-if-absent. The lock value carries an expiry so a crashed holder can't
 * wedge the DID forever, and an owner token so we only ever delete our own.
 */

/** Longer than the library's own 30s refresh timeout, so we don't steal a live lock. */
const LOCK_TTL_MS = 35_000
/** Give up waiting after this long; the caller then proceeds unlocked. */
const MAX_WAIT_MS = 40_000
const POLL_MIN_MS = 100
const POLL_JITTER_MS = 100

interface LockValue {
	owner: string
	expiresAt: number
}

function sleep(ms: number): Promise<void> {
	return new Promise((r) => setTimeout(r, ms))
}

export interface BlobLockOptions {
	ttlMs?: number
	maxWaitMs?: number
	now?: () => number
	/** Injected in tests so polling doesn't wait wall-clock time. */
	sleep?: (ms: number) => Promise<void>
}

export function createBlobLock(store: () => TextKV, opts: BlobLockOptions = {}): RuntimeLock {
	const ttlMs = opts.ttlMs ?? LOCK_TTL_MS
	const maxWaitMs = opts.maxWaitMs ?? MAX_WAIT_MS
	const now = opts.now ?? Date.now
	const wait = opts.sleep ?? sleep

	// Polling a mutex is inherently sequential.
	/* oxlint-disable no-await-in-loop */
	async function acquire(key: string, owner: string): Promise<boolean> {
		const deadline = now() + maxWaitMs
		while (now() < deadline) {
			const value: LockValue = { owner, expiresAt: now() + ttlMs }
			const { modified } = await store().set(key, JSON.stringify(value), { onlyIfNew: true })
			if (modified) return true

			// Someone holds it. If their lease is over, clear it and try again
			// right away; otherwise back off briefly.
			const raw = await store().get(key, { type: 'text' })
			const held = parse(raw)
			if (!raw || (held && held.expiresAt <= now())) {
				await store().delete(key)
				continue
			}
			await wait(POLL_MIN_MS + Math.random() * POLL_JITTER_MS)
		}
		return false
	}
	/* oxlint-enable no-await-in-loop */

	async function release(key: string, owner: string): Promise<void> {
		// Only delete a lock we still own. If our lease expired and another
		// instance took over, deleting would hand a third instance the lock while
		// the second is mid-refresh — exactly the race this file exists to stop.
		const held = parse(await store().get(key, { type: 'text' }))
		if (held?.owner === owner) await store().delete(key)
	}

	return async function requestLock<T>(name: string, fn: () => T | PromiseLike<T>): Promise<T> {
		const key = `lock:${name}`
		const owner = randomUUID()
		let held = false
		try {
			held = await acquire(key, owner)
			if (!held) {
				console.warn(`[oauth] lock ${name} not acquired within ${maxWaitMs}ms, proceeding unlocked`)
			}
		} catch (err) {
			// A store outage must not take auth down with it; run unlocked and
			// rely on the library's best-effort concurrent-refresh recovery.
			console.error('[oauth] lock acquire failed, proceeding unlocked', err)
		}
		try {
			return await fn()
		} finally {
			if (held) {
				await release(key, owner).catch((err) =>
					console.error('[oauth] lock release failed (will expire)', err),
				)
			}
		}
	}
}

function parse(raw: string | null): LockValue | null {
	if (!raw) return null
	try {
		const v = JSON.parse(raw) as Partial<LockValue>
		return typeof v.owner === 'string' && typeof v.expiresAt === 'number' ? (v as LockValue) : null
	} catch {
		return null
	}
}

export const requestLock: RuntimeLock = createBlobLock(resolveStore)
