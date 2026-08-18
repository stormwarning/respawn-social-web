import type { Agent } from '@atproto/api'
import { Collections } from '@respawn-social/lexicons'
import type { CoverRef } from '$lib/atproto/game'
import type { GameRef } from '$lib/atproto/log'
import { getRecordOrNull, isRecordNotFound, listAllRecords } from '$lib/atproto/records'

export const RESPAWN_BACKLOG_ITEM_COLLECTION = Collections.backlogItem

/** One game in the actor's backlog, at `social.respawn.backlog.item/<igdbId>`. */
export interface BacklogItem {
	$type?: typeof RESPAWN_BACKLOG_ITEM_COLLECTION
	game: GameRef
	cover?: CoverRef
	releaseDate?: string
	createdAt: string
}

/** Records are keyed by IGDB id, so adds are idempotent and lookups are a getRecord. */
const rkeyFor = (igdbId: number) => String(igdbId)

/** The actor's whole backlog, most recently added first. */
export async function loadBacklog(agent: Agent, did: string): Promise<BacklogItem[]> {
	const records = await listAllRecords<BacklogItem>(agent, did, RESPAWN_BACKLOG_ITEM_COLLECTION)
	return records.map((rec) => rec.value).toSorted((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function isInBacklog(agent: Agent, did: string, igdbId: number): Promise<boolean> {
	const rec = await getRecordOrNull<BacklogItem>(
		agent,
		did,
		RESPAWN_BACKLOG_ITEM_COLLECTION,
		rkeyFor(igdbId),
	)
	return rec !== null
}

/** Add a game. Keyed by IGDB id, so re-adding refreshes the item rather than duplicating it. */
export async function addToBacklog(
	agent: Agent,
	did: string,
	item: Omit<BacklogItem, 'createdAt' | '$type'>,
): Promise<void> {
	await agent.com.atproto.repo.putRecord({
		repo: did,
		collection: RESPAWN_BACKLOG_ITEM_COLLECTION,
		rkey: rkeyFor(item.game.igdbId),
		record: {
			$type: RESPAWN_BACKLOG_ITEM_COLLECTION,
			...item,
			createdAt: new Date().toISOString(),
		},
	})
}

export async function removeFromBacklog(agent: Agent, did: string, igdbId: number): Promise<void> {
	try {
		await agent.com.atproto.repo.deleteRecord({
			repo: did,
			collection: RESPAWN_BACKLOG_ITEM_COLLECTION,
			rkey: rkeyFor(igdbId),
		})
	} catch (err) {
		if (!isRecordNotFound(err)) throw err
	}
}

/**
 * Backlogs used to be a single `social.respawn.actor.backlog/self` record holding
 * every game. Split any leftover one into per-item records on the owner's next
 * visit, then drop it. Disposable: remove once no dev repo has a `self` record.
 */
const LEGACY_BACKLOG_COLLECTION = 'social.respawn.actor.backlog'

interface LegacyBacklogRecord {
	games: { game: GameRef; cover?: CoverRef; releaseDate?: string; dateAdded: string }[]
	createdAt: string
}

export async function migrateLegacyBacklog(agent: Agent, did: string): Promise<void> {
	const legacy = await getRecordOrNull<LegacyBacklogRecord>(
		agent,
		did,
		LEGACY_BACKLOG_COLLECTION,
		'self',
	)
	if (!legacy) return

	// putRecord rather than applyWrites so a half-finished run can be retried.
	for (const entry of legacy.value.games) {
		await agent.com.atproto.repo.putRecord({
			repo: did,
			collection: RESPAWN_BACKLOG_ITEM_COLLECTION,
			rkey: rkeyFor(entry.game.igdbId),
			record: {
				$type: RESPAWN_BACKLOG_ITEM_COLLECTION,
				game: entry.game,
				cover: entry.cover,
				releaseDate: entry.releaseDate,
				createdAt: entry.dateAdded,
			},
		})
	}

	await agent.com.atproto.repo.deleteRecord({
		repo: did,
		collection: LEGACY_BACKLOG_COLLECTION,
		rkey: 'self',
	})
}
