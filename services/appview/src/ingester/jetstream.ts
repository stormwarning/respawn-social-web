import { eq } from 'drizzle-orm'
import { ALL_COLLECTIONS } from '@respawn-social/lexicons'
import type { Db } from '../db/client.ts'
import { ingestState } from '../db/schema.ts'
import { handleEvent, type JetstreamEvent } from './handler.ts'

const CURSOR_ID = 'jetstream'
/** Overlap replayed on reconnect (Jetstream recommendation). */
const REPLAY_WINDOW_US = 5_000_000
const CURSOR_PERSIST_EVERY = 50
const RECONNECT_DELAY_MS = 3_000

export async function loadCursor(db: Db): Promise<number | null> {
	const rows = await db.select().from(ingestState).where(eq(ingestState.id, CURSOR_ID))
	return rows[0]?.cursor ?? null
}

export async function saveCursor(db: Db, cursor: number): Promise<void> {
	await db
		.insert(ingestState)
		.values({ id: CURSOR_ID, cursor, updatedAt: new Date() })
		.onConflictDoUpdate({ target: ingestState.id, set: { cursor, updatedAt: new Date() } })
}

export function buildJetstreamUrl(base: string, cursor: number | null): string {
	const url = new URL(base)
	for (const collection of ALL_COLLECTIONS) {
		url.searchParams.append('wantedCollections', collection)
	}
	if (cursor != null) {
		url.searchParams.set('cursor', String(Math.max(0, cursor - REPLAY_WINDOW_US)))
	}
	return url.toString()
}

/**
 * Consume Jetstream forever: connect at the persisted cursor (minus a replay
 * window — handlers are idempotent upserts), process events sequentially, and
 * reconnect with backoff on close/error.
 */
export async function runIngester(db: Db, jetstreamUrl: string): Promise<never> {
	let cursor = await loadCursor(db)

	/* oxlint-disable no-await-in-loop -- one connection at a time, by design */
	while (true) {
		const url = buildJetstreamUrl(jetstreamUrl, cursor)
		console.log(`[ingester] connecting to ${url}`)

		try {
			cursor = await consumeSocket(db, url, cursor)
		} catch (err) {
			console.error('[ingester] socket error', err)
		}
		if (cursor != null) await saveCursor(db, cursor).catch(() => {})
		await new Promise((resolve) => setTimeout(resolve, RECONNECT_DELAY_MS))
	}
	/* oxlint-enable no-await-in-loop */
}

/**
 * Runs one WebSocket connection until it closes; resolves with the
 * latest cursor.
 */
function consumeSocket(db: Db, url: string, cursor: number | null): Promise<number | null> {
	return new Promise((resolve, reject) => {
		const ws = new WebSocket(url)
		let latest = cursor
		let sinceSave = 0
		// Serialize event handling; Jetstream ordering matters for upsert/delete pairs.
		let chain: Promise<void> = Promise.resolve()

		ws.addEventListener('message', (msg) => {
			chain = chain.then(async () => {
				try {
					const event = JSON.parse(String(msg.data)) as JetstreamEvent
					await handleEvent(db, event)
					latest = event.time_us
					if (++sinceSave >= CURSOR_PERSIST_EVERY) {
						sinceSave = 0
						await saveCursor(db, latest)
					}
				} catch (err) {
					console.error('[ingester] event failed', err)
				}
			})
		})
		ws.addEventListener('close', () => {
			chain.finally(() => resolve(latest))
		})
		ws.addEventListener('error', (err) => {
			ws.close()
			reject(err instanceof Error ? err : new Error('jetstream socket error'))
		})
	})
}
