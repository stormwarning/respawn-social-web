import { describe, expect, it } from 'vitest'
import { createBlobLock } from './lock'
import type { TextKV } from './blob-store'

/** In-memory stand-in for Netlify Blobs with atomic `onlyIfNew`. */
function fakeStore(): TextKV & { map: Map<string, string> } {
	const map = new Map<string, string>()
	return {
		map,
		async get(key) {
			return map.get(key) ?? null
		},
		async set(key, value, opts) {
			if (opts?.onlyIfNew && map.has(key)) return { modified: false }
			map.set(key, value)
			return { modified: true }
		},
		async delete(key) {
			map.delete(key)
		},
	}
}

const tick = () => new Promise<void>((r) => setTimeout(r, 0))

describe('createBlobLock', () => {
	it('serialises concurrent holders of the same name', async () => {
		const store = fakeStore()
		const lock = createBlobLock(() => store, { sleep: tick })
		const order: string[] = []
		let inside = 0
		let maxInside = 0

		const task = (id: string) =>
			lock(`did:plc:x`, async () => {
				inside++
				maxInside = Math.max(maxInside, inside)
				order.push(`${id}:start`)
				await tick()
				await tick()
				order.push(`${id}:end`)
				inside--
				return id
			})

		const results = await Promise.all([task('a'), task('b'), task('c')])
		expect(results.toSorted()).toEqual(['a', 'b', 'c'])
		expect(maxInside).toBe(1)
		// Each start is followed by its own end before the next start.
		for (let i = 0; i < order.length; i += 2) {
			expect(order[i]).toMatch(/:start$/)
			expect(order[i + 1]).toBe(order[i].replace(':start', ':end'))
		}
		expect(store.map.size).toBe(0)
	})

	it('does not block distinct names', async () => {
		const store = fakeStore()
		const lock = createBlobLock(() => store, { sleep: tick })
		let inside = 0
		let maxInside = 0
		const task = (name: string) =>
			lock(name, async () => {
				inside++
				maxInside = Math.max(maxInside, inside)
				await tick()
				inside--
			})
		await Promise.all([task('did:plc:a'), task('did:plc:b')])
		expect(maxInside).toBe(2)
	})

	it('steals a lock whose lease expired', async () => {
		const store = fakeStore()
		let t = 1_000_000
		const lock = createBlobLock(() => store, { sleep: tick, now: () => t, ttlMs: 500 })
		// A crashed holder left this behind.
		store.map.set('lock:did:plc:x', JSON.stringify({ owner: 'dead', expiresAt: t - 1 }))
		const ran = await lock('did:plc:x', async () => true)
		expect(ran).toBe(true)
		expect(store.map.size).toBe(0)
	})

	it("releases even when fn throws, and never deletes another owner's lock", async () => {
		const store = fakeStore()
		const lock = createBlobLock(() => store, { sleep: tick })
		await expect(
			lock('did:plc:x', async () => {
				throw new Error('boom')
			}),
		).rejects.toThrow('boom')
		expect(store.map.size).toBe(0)

		// Simulate lease expiry + takeover mid-fn: our release must leave the
		// new owner's lock alone.
		let t = 0
		const short = createBlobLock(() => store, { sleep: tick, now: () => t, ttlMs: 10 })
		await short('did:plc:y', async () => {
			t += 100 // our lease is now expired
			store.map.set('lock:did:plc:y', JSON.stringify({ owner: 'other', expiresAt: t + 1000 }))
		})
		expect(store.map.has('lock:did:plc:y')).toBe(true)
	})

	it('proceeds unlocked when the store is unavailable', async () => {
		const broken: TextKV = {
			async get() {
				throw new Error('blobs down')
			},
			async set() {
				throw new Error('blobs down')
			},
			async delete() {
				throw new Error('blobs down')
			},
		}
		const lock = createBlobLock(() => broken, { sleep: tick })
		await expect(lock('did:plc:x', async () => 42)).resolves.toBe(42)
	})
})
