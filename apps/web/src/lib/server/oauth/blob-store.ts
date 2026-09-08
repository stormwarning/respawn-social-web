import { getStore } from '@netlify/blobs'
import type {
	NodeSavedSession,
	NodeSavedSessionStore,
	NodeSavedState,
	NodeSavedStateStore,
} from '@atproto/oauth-client-node'

/**
 * Netlify Blobs-backed key/value store. Netlify functions are stateless, so the
 * OAuth state + session stores need durable storage that survives across
 * invocations and token refreshes.
 *
 * Reads are pinned to strong consistency. Blobs defaults to eventual
 * consistency, and the OAuth session store is read-after-write on the hot path:
 * the callback writes the session, then the very next request restores it, and
 * every token refresh rewrites it. An eventually-consistent read that misses
 * makes @atproto/oauth-client throw TokenRefreshError ("The session was deleted
 * by another process"), which deletes the session and forces a fresh login. It
 * also breaks that library's concurrent-refresh recovery, which re-reads the
 * stored session to detect that another instance already rotated the tokens.
 *
 * Outside the Netlify runtime (e.g. plain `vite dev`), Blobs is unavailable and
 * `getStore` throws. We fall back to a process-local Map so local dev still
 * boots — this is NOT durable and must never be relied on in production.
 */
/** The slice of the Netlify Blobs Store API we use (text values only). */
export interface TextKV {
	get(key: string, opts: { type: 'text' }): Promise<string | null>
	/**
	 * With `onlyIfNew`, the write is a server-side compare-and-set: it succeeds
	 * (`modified: true`) only when the key does not exist yet. This is what the
	 * refresh lock in ./lock.ts is built on.
	 */
	set(key: string, value: string, opts?: { onlyIfNew?: boolean }): Promise<{ modified: boolean }>
	delete(key: string): Promise<unknown>
}

const memory = new Map<string, string>()
let warned = false
let cachedStore: TextKV | null = null

export function resolveStore(): TextKV {
	if (cachedStore) return cachedStore
	try {
		cachedStore = getStore({
			name: 'atproto-oauth',
			consistency: 'strong',
		}) as unknown as TextKV
		return cachedStore
	} catch {
		if (!warned) {
			console.warn(
				'[oauth] Netlify Blobs unavailable — using in-memory store (dev only, not durable).',
			)
			warned = true
		}
		cachedStore = {
			async get(key: string) {
				return memory.get(key) ?? null
			},
			async set(key: string, value: string, opts?: { onlyIfNew?: boolean }) {
				if (opts?.onlyIfNew && memory.has(key)) return { modified: false }
				memory.set(key, value)
				return { modified: true }
			},
			async delete(key: string) {
				memory.delete(key)
			},
		}
		return cachedStore
	}
}

/**
 * Retry a store write once. @atproto/oauth-client treats a failed session
 * write after a token refresh as fatal: it REVOKES the freshly minted tokens
 * and deletes the session (see SessionGetter's onStoreError), which logs the
 * user out. One transient Blobs error should not cost the user their session.
 */
async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
	try {
		return await fn()
	} catch (err) {
		console.warn('[oauth] blob write failed, retrying once', err)
		return fn()
	}
}

function prefixed<T>(prefix: string) {
	return {
		async get(key: string): Promise<T | undefined> {
			const raw = await resolveStore().get(`${prefix}:${key}`, { type: 'text' })
			return raw ? (JSON.parse(raw) as T) : undefined
		},
		async set(key: string, value: T): Promise<void> {
			await withRetry(() => resolveStore().set(`${prefix}:${key}`, JSON.stringify(value)))
		},
		async del(key: string): Promise<void> {
			await withRetry(() => resolveStore().delete(`${prefix}:${key}`))
		},
	}
}

export const stateStore: NodeSavedStateStore = prefixed<NodeSavedState>('state')
export const sessionStore: NodeSavedSessionStore = prefixed<NodeSavedSession>('session')
