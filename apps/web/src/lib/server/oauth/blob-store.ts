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
interface TextKV {
	get(key: string, opts: { type: 'text' }): Promise<string | null>
	set(key: string, value: string): Promise<unknown>
	delete(key: string): Promise<unknown>
}

const memory = new Map<string, string>()
let warned = false
let cachedStore: TextKV | null = null

function resolveStore(): TextKV {
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
			async set(key: string, value: string) {
				memory.set(key, value)
			},
			async delete(key: string) {
				memory.delete(key)
			},
		}
		return cachedStore
	}
}

function prefixed<T>(prefix: string) {
	return {
		async get(key: string): Promise<T | undefined> {
			const raw = await resolveStore().get(`${prefix}:${key}`, { type: 'text' })
			return raw ? (JSON.parse(raw) as T) : undefined
		},
		async set(key: string, value: T): Promise<void> {
			await resolveStore().set(`${prefix}:${key}`, JSON.stringify(value))
		},
		async del(key: string): Promise<void> {
			await resolveStore().delete(`${prefix}:${key}`)
		},
	}
}

export const stateStore: NodeSavedStateStore = prefixed<NodeSavedState>('state')
export const sessionStore: NodeSavedSessionStore = prefixed<NodeSavedSession>('session')
