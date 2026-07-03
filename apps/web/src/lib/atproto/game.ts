import type { Agent } from '@atproto/api'
import type { BlobRef } from '@atproto/api'

export const RESPAWN_GAME_COLLECTION = 'social.respawn.game'

const rkeyFor = (igdbId: number) => String(igdbId)

/** The cover image blob plus its extracted colors. */
export interface CoverRef {
	image: BlobRef
	colors?: { dominant?: string }
}

export type PlayedState = 'played' | 'completed' | 'abandoned' | 'retired' | 'shelved'

/**
 * A game in the user's collection, stored at `social.respawn.game/<igdbId>`.
 * Mirrors the lexicon in `lexicons/social/respawn/game.json`. Hand-declared (rather
 * than imported from the @atcute codegen) so the `cover.image` blob lines up with the
 * @atproto/api `BlobRef` the Agent returns from uploadBlob.
 */
export interface RespawnGameRecord {
	$type?: typeof RESPAWN_GAME_COLLECTION
	rating?: number
	liked?: boolean
	playing?: boolean
	/** Absent means not played. */
	played?: PlayedState
	cover?: CoverRef
	createdAt: string
}

/**
 * Load the Respawn game record from the user's repo, or null if they haven't
 * created one for this game yet.
 */
export async function loadGameRecord(
	agent: Agent,
	did: string,
	igdbId: number,
): Promise<RespawnGameRecord | null> {
	try {
		const res = await agent.com.atproto.repo.getRecord({
			repo: did,
			collection: RESPAWN_GAME_COLLECTION,
			rkey: rkeyFor(igdbId),
		})
		return res.data.value as unknown as RespawnGameRecord
	} catch (err) {
		if (isRecordNotFound(err)) return null
		throw err
	}
}

/** Write (create or overwrite) the game record, keyed by IGDB id. */
export async function putGameRecord(
	agent: Agent,
	did: string,
	igdbId: number,
	record: RespawnGameRecord,
): Promise<void> {
	await agent.com.atproto.repo.putRecord({
		repo: did,
		collection: RESPAWN_GAME_COLLECTION,
		rkey: rkeyFor(igdbId),
		record: { $type: RESPAWN_GAME_COLLECTION, ...record },
	})
}

function isRecordNotFound(err: unknown): boolean {
	const msg = err instanceof Error ? err.message : String(err)
	return /Could not locate record|RecordNotFound/i.test(msg)
}
