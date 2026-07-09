import { and, eq, notInArray } from 'drizzle-orm'
import {
	CompositeDidDocumentResolver,
	PlcDidDocumentResolver,
	WebDidDocumentResolver,
} from '@atcute/identity-resolver'
import { getPdsEndpoint } from '@atcute/identity'
import type { AtprotoDid } from '@atcute/lexicons/syntax'
import { ALL_COLLECTIONS, Collections } from '@respawn-social/lexicons'
import { db, type Db } from '../db/client.ts'
import { env } from '../env.ts'
import {
	backlogs,
	blocks,
	comments,
	follows,
	gameEntries,
	gates,
	likes,
	lists,
	logs,
} from '../db/schema.ts'
import { indexRecord } from '../ingester/handler.ts'

const docResolver = new CompositeDidDocumentResolver({
	methods: { plc: new PlcDidDocumentResolver(), web: new WebDidDocumentResolver() },
})

interface ListedRecord {
	uri: string
	cid: string
	value: Record<string, unknown>
}

/** All DIDs the relay knows to hold records in `collection`. */
async function listReposByCollection(collection: string): Promise<string[]> {
	const dids: string[] = []
	let cursor: string | undefined

	do {
		const url = new URL('/xrpc/com.atproto.sync.listReposByCollection', env.relayUrl)

		url.searchParams.set('collection', collection)
		url.searchParams.set('limit', '500')

		if (cursor) url.searchParams.set('cursor', cursor)

		// oxlint-disable-next-line no-await-in-loop -- pages are sequential by cursor
		const res = await fetch(url)
		if (!res.ok) throw new Error(`listReposByCollection ${collection}: ${res.status}`)
		// oxlint-disable-next-line no-await-in-loop

		const data = (await res.json()) as { repos: Array<{ did: string }>; cursor?: string }

		dids.push(...data.repos.map((repo) => repo.did))
		cursor = data.cursor
	} while (cursor)

	return dids
}

async function listRecords(pds: string, did: string, collection: string): Promise<ListedRecord[]> {
	const out: ListedRecord[] = []
	let cursor: string | undefined

	do {
		const url = new URL('/xrpc/com.atproto.repo.listRecords', pds)

		url.searchParams.set('repo', did)
		url.searchParams.set('collection', collection)
		url.searchParams.set('limit', '100')

		if (cursor) url.searchParams.set('cursor', cursor)

		// oxlint-disable-next-line no-await-in-loop -- pages are sequential by cursor
		const res = await fetch(url)
		if (!res.ok) throw new Error(`listRecords ${did} ${collection}: ${res.status}`)
		// oxlint-disable-next-line no-await-in-loop

		const data = (await res.json()) as { records: ListedRecord[]; cursor?: string }

		out.push(...data.records)
		cursor = data.cursor
	} while (cursor)

	return out
}

const rkeyFromUri = (uri: string) => uri.slice(uri.lastIndexOf('/') + 1)

/** Delete indexed rows for a did+collection whose uri/key vanished upstream. */
async function pruneMissing(
	database: Db,
	did: string,
	collection: string,
	keepUris: string[],
): Promise<void> {
	switch (collection) {
		case Collections.game: {
			const keepIds = keepUris.map((uri) => Number(rkeyFromUri(uri))).filter(Number.isInteger)
			await database
				.delete(gameEntries)
				.where(
					and(
						eq(gameEntries.did, did),
						keepIds.length > 0 ? notInArray(gameEntries.igdbId, keepIds) : undefined,
					),
				)
			return
		}
		case Collections.backlog:
			if (keepUris.length === 0) await database.delete(backlogs).where(eq(backlogs.did, did))
			return
		case Collections.profile:
			return
		default: {
			const table = {
				[Collections.log]: logs,
				[Collections.like]: likes,
				[Collections.comment]: comments,
				[Collections.gate]: gates,
				[Collections.follow]: follows,
				[Collections.block]: blocks,
				[Collections.list]: lists,
			}[collection]
			if (!table) return
			await database
				.delete(table)
				.where(
					and(
						eq(table.did, did),
						keepUris.length > 0 ? notInArray(table.uri, keepUris) : undefined,
					),
				)
		}
	}
}

async function syncRepo(did: string, collections: string[]): Promise<void> {
	const doc = await docResolver.resolve(did as AtprotoDid)
	const pds = getPdsEndpoint(doc)

	if (!pds) {
		console.warn(`[sync] no PDS for ${did}, skipping`)
		return
	}

	for (const collection of collections) {
		// oxlint-disable-next-line no-await-in-loop -- one repo at a time keeps PDS load polite
		const records = await listRecords(pds, did, collection)

		for (const record of records) {
			// oxlint-disable-next-line no-await-in-loop
			await indexRecord(db, did, collection, rkeyFromUri(record.uri), record.cid, record.value)
		}

		// oxlint-disable-next-line no-await-in-loop
		await pruneMissing(
			db,
			did,
			collection,
			records.map((record) => record.uri),
		)
	}
}

async function main() {
	console.log(`[sync] enumerating repos via ${env.relayUrl}`)
	const didCollections = new Map<string, Set<string>>()

	for (const collection of ALL_COLLECTIONS) {
		// oxlint-disable-next-line no-await-in-loop -- serial keeps relay load polite
		const dids = await listReposByCollection(collection)
		console.log(`[sync] ${collection}: ${dids.length} repos`)

		for (const did of dids) {
			let set = didCollections.get(did)
			if (!set) didCollections.set(did, (set = new Set()))
			set.add(collection)
		}
	}

	let done = 0

	for (const [did, collections] of didCollections) {
		try {
			// oxlint-disable-next-line no-await-in-loop -- one repo at a time keeps PDS load polite
			await syncRepo(did, [...collections])
		} catch (err) {
			console.error(`[sync] ${did} failed`, err)
		}
		if (++done % 25 === 0) console.log(`[sync] ${done}/${didCollections.size} repos`)
	}

	console.log(`[sync] done: ${done} repos`)
	process.exit(0)
}

main().catch((err) => {
	console.error('[sync] fatal', err)
	process.exit(1)
})
