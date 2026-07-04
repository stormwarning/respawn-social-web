import type { Agent } from '@atproto/api'

/** A record with its repo location, as returned by `com.atproto.repo.listRecords`. */
export interface RecordEnvelope<T> {
	uri: string
	cid: string
	rkey: string
	value: T
}

export function isRecordNotFound(err: unknown): boolean {
	const msg = err instanceof Error ? err.message : String(err)
	return /Could not locate record|RecordNotFound/i.test(msg)
}

const rkeyFromUri = (uri: string) => uri.slice(uri.lastIndexOf('/') + 1)

/**
 * Page through `com.atproto.repo.listRecords` for a collection. `agent` can be
 * an authed agent or a plain one pointed at a public PDS endpoint.
 */
export async function listAllRecords<T>(
	agent: Agent,
	did: string,
	collection: string,
	{ max = 1000 }: { max?: number } = {},
): Promise<RecordEnvelope<T>[]> {
	const out: RecordEnvelope<T>[] = []
	let cursor: string | undefined
	while (out.length < max) {
		// oxlint-disable-next-line no-await-in-loop -- pages are sequential by cursor
		const res = await agent.com.atproto.repo.listRecords({
			repo: did,
			collection,
			limit: Math.min(100, max - out.length),
			cursor,
		})
		for (const rec of res.data.records) {
			out.push({
				uri: rec.uri,
				cid: rec.cid,
				rkey: rkeyFromUri(rec.uri),
				value: rec.value as T,
			})
		}
		cursor = res.data.cursor
		if (!cursor || res.data.records.length === 0) break
	}
	return out
}

/** Fetch a single record, or null when it doesn't exist. */
export async function getRecordOrNull<T>(
	agent: Agent,
	did: string,
	collection: string,
	rkey: string,
): Promise<RecordEnvelope<T> | null> {
	try {
		const res = await agent.com.atproto.repo.getRecord({ repo: did, collection, rkey })
		return {
			uri: res.data.uri,
			cid: res.data.cid ?? '',
			rkey,
			value: res.data.value as T,
		}
	} catch (err) {
		if (isRecordNotFound(err)) return null
		throw err
	}
}
