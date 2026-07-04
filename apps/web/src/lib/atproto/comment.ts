import type { Agent } from '@atproto/api'
import { Collections } from '@respawn-social/lexicons'
import type { StrongRef } from '$lib/atproto/like'

export const RESPAWN_COMMENT_COLLECTION = Collections.comment

export interface RespawnCommentRecord {
	$type?: typeof RESPAWN_COMMENT_COLLECTION
	text: string
	/** The root log or list being commented on. */
	subject: StrongRef
	/** Optional parent comment, for threaded replies. */
	parent?: StrongRef
	createdAt: string
}

/** Comment on a log or list. The record lives in the commenter's repo. */
export async function createComment(
	agent: Agent,
	did: string,
	{ text, subject, parent }: { text: string; subject: StrongRef; parent?: StrongRef },
): Promise<string> {
	const res = await agent.com.atproto.repo.createRecord({
		repo: did,
		collection: RESPAWN_COMMENT_COLLECTION,
		record: {
			$type: RESPAWN_COMMENT_COLLECTION,
			text,
			subject,
			parent,
			createdAt: new Date().toISOString(),
		} satisfies RespawnCommentRecord,
	})
	return res.data.uri
}

export async function deleteComment(agent: Agent, did: string, rkey: string): Promise<void> {
	await agent.com.atproto.repo.deleteRecord({
		repo: did,
		collection: RESPAWN_COMMENT_COLLECTION,
		rkey,
	})
}
