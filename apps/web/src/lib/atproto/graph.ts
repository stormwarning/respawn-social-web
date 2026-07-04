import type { Agent } from '@atproto/api'
import { Collections } from '@respawn-social/lexicons'
import { listAllRecords, type RecordEnvelope } from '$lib/atproto/records'

export const RESPAWN_FOLLOW_COLLECTION = Collections.follow
export const RESPAWN_BLOCK_COLLECTION = Collections.block

export interface RespawnGraphRecord {
	$type?: string
	/** DID of the followed/blocked account. */
	subject: string
	createdAt: string
}

async function createGraphRecord(
	agent: Agent,
	did: string,
	collection: string,
	subjectDid: string,
): Promise<string> {
	const res = await agent.com.atproto.repo.createRecord({
		repo: did,
		collection,
		record: {
			$type: collection,
			subject: subjectDid,
			createdAt: new Date().toISOString(),
		} satisfies RespawnGraphRecord,
	})
	return res.data.uri
}

async function findGraphRecord(
	agent: Agent,
	did: string,
	collection: string,
	subjectDid: string,
): Promise<RecordEnvelope<RespawnGraphRecord> | null> {
	const records = await listAllRecords<RespawnGraphRecord>(agent, did, collection)
	return records.find((rec) => rec.value.subject === subjectDid) ?? null
}

export const follow = (agent: Agent, did: string, subjectDid: string) =>
	createGraphRecord(agent, did, RESPAWN_FOLLOW_COLLECTION, subjectDid)

export const block = (agent: Agent, did: string, subjectDid: string) =>
	createGraphRecord(agent, did, RESPAWN_BLOCK_COLLECTION, subjectDid)

/** The viewer's follow record for a subject, or null. Scans own repo. */
export const findFollow = (agent: Agent, did: string, subjectDid: string) =>
	findGraphRecord(agent, did, RESPAWN_FOLLOW_COLLECTION, subjectDid)

export const findBlock = (agent: Agent, did: string, subjectDid: string) =>
	findGraphRecord(agent, did, RESPAWN_BLOCK_COLLECTION, subjectDid)

export async function unfollow(agent: Agent, did: string, rkey: string): Promise<void> {
	await agent.com.atproto.repo.deleteRecord({
		repo: did,
		collection: RESPAWN_FOLLOW_COLLECTION,
		rkey,
	})
}

export async function unblock(agent: Agent, did: string, rkey: string): Promise<void> {
	await agent.com.atproto.repo.deleteRecord({
		repo: did,
		collection: RESPAWN_BLOCK_COLLECTION,
		rkey,
	})
}
