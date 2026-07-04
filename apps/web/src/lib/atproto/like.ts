import type { Agent } from '@atproto/api'
import { Collections } from '@respawn-social/lexicons'
import { listAllRecords, type RecordEnvelope } from '$lib/atproto/records'

export const RESPAWN_LIKE_COLLECTION = Collections.like

/** com.atproto.repo.strongRef */
export interface StrongRef {
	uri: string
	cid: string
}

export interface RespawnLikeRecord {
	$type?: typeof RESPAWN_LIKE_COLLECTION
	subject: StrongRef
	createdAt: string
}

/** Like a log, list, or comment. Returns the like record's uri. */
export async function createLike(agent: Agent, did: string, subject: StrongRef): Promise<string> {
	const res = await agent.com.atproto.repo.createRecord({
		repo: did,
		collection: RESPAWN_LIKE_COLLECTION,
		record: {
			$type: RESPAWN_LIKE_COLLECTION,
			subject,
			createdAt: new Date().toISOString(),
		} satisfies RespawnLikeRecord,
	})
	return res.data.uri
}

export async function deleteLike(agent: Agent, did: string, rkey: string): Promise<void> {
	await agent.com.atproto.repo.deleteRecord({
		repo: did,
		collection: RESPAWN_LIKE_COLLECTION,
		rkey,
	})
}

/**
 * Find the viewer's own like of a subject, or null. Scans the viewer's like
 * collection — fine at own-repo scale until the appview lands.
 */
export async function findLike(
	agent: Agent,
	did: string,
	subjectUri: string,
): Promise<RecordEnvelope<RespawnLikeRecord> | null> {
	const likes = await listAllRecords<RespawnLikeRecord>(agent, did, RESPAWN_LIKE_COLLECTION)
	return likes.find((like) => like.value.subject?.uri === subjectUri) ?? null
}
