import type { Agent } from '@atproto/api'
import { Collections } from '@respawn-social/lexicons'
import type { CoverRef } from '$lib/atproto/game'
import type { GameRef } from '$lib/atproto/log'
import { getRecordOrNull } from '$lib/atproto/records'

export const RESPAWN_BACKLOG_COLLECTION = Collections.backlog
const RKEY = 'self'

export interface BacklogItem {
	game: GameRef
	cover?: CoverRef
	releaseDate?: string
	dateAdded: string
}

/** The actor's backlog, a single record at `social.respawn.actor.backlog/self`. */
export interface RespawnBacklogRecord {
	$type?: typeof RESPAWN_BACKLOG_COLLECTION
	games: BacklogItem[]
	createdAt: string
}

export async function loadBacklog(agent: Agent, did: string): Promise<RespawnBacklogRecord | null> {
	const rec = await getRecordOrNull<RespawnBacklogRecord>(
		agent,
		did,
		RESPAWN_BACKLOG_COLLECTION,
		RKEY,
	)
	return rec?.value ?? null
}

export async function saveBacklog(
	agent: Agent,
	did: string,
	record: RespawnBacklogRecord,
): Promise<void> {
	await agent.com.atproto.repo.putRecord({
		repo: did,
		collection: RESPAWN_BACKLOG_COLLECTION,
		rkey: RKEY,
		record: { $type: RESPAWN_BACKLOG_COLLECTION, ...record },
	})
}

/** Read-modify-write: add a game (no-op when already present). */
export async function addToBacklog(
	agent: Agent,
	did: string,
	item: Omit<BacklogItem, 'dateAdded'>,
): Promise<void> {
	const existing = (await loadBacklog(agent, did)) ?? {
		games: [],
		createdAt: new Date().toISOString(),
	}
	if (existing.games.some((entry) => entry.game.igdbId === item.game.igdbId)) return
	existing.games.push({ ...item, dateAdded: new Date().toISOString() })
	await saveBacklog(agent, did, existing)
}

/** Read-modify-write: remove a game by IGDB id. */
export async function removeFromBacklog(agent: Agent, did: string, igdbId: number): Promise<void> {
	const existing = await loadBacklog(agent, did)
	if (!existing) return
	const games = existing.games.filter((entry) => entry.game.igdbId !== igdbId)
	if (games.length === existing.games.length) return
	await saveBacklog(agent, did, { ...existing, games })
}
