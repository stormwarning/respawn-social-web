/**
 * Single-flight TTL cache for read-through lookups.
 *
 * Netlify reuses a warm Lambda container across requests, so a module-scope map
 * turns a per-request round trip (identity resolution, own-profile fetch) into a
 * process-lifetime lookup. The promise itself is cached rather than its result,
 * so a burst of concurrent misses on the same key makes one upstream call.
 */
export interface Memo<T> {
	/** Return the cached value, or run `load` and cache it. */
	get(key: string, load: () => Promise<T>): Promise<T>
	/** Drop a key, so the next `get` refetches. Used after writes. */
	delete(key: string): void
}

export function createMemo<T>({ ttlMs, max = 500 }: { ttlMs: number; max?: number }): Memo<T> {
	const entries = new Map<string, { value: Promise<T>; expires: number }>()

	return {
		get(key, load) {
			const hit = entries.get(key)
			if (hit && hit.expires > Date.now()) return hit.value

			const value = load().catch((err: unknown) => {
				// Never hold a failure for the full TTL — the next caller should retry.
				entries.delete(key)
				throw err
			})
			entries.set(key, { value, expires: Date.now() + ttlMs })

			// Bound memory on a long-lived container. Map iterates in insertion
			// order, so the first key is the oldest written.
			if (entries.size > max) {
				const oldest = entries.keys().next().value
				if (oldest !== undefined) entries.delete(oldest)
			}
			return value
		},
		delete(key) {
			entries.delete(key)
		},
	}
}
