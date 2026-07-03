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

function resolveStore(): TextKV {
	try {
		return getStore('atproto-oauth') as unknown as TextKV
	} catch {
		if (!warned) {
			console.warn(
				'[oauth] Netlify Blobs unavailable — using in-memory store (dev only, not durable).',
			)
			warned = true
		}
		return {
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
