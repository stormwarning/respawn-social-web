import type { Agent } from '@atproto/api'
import { Collections } from '@respawn-social/lexicons'
import type { BacklogItem } from '$lib/atproto/backlog'
import type { PlayedState, RespawnGameRecord } from '$lib/atproto/game'
import { listAllRecords } from '$lib/atproto/records'
import { createMemo } from './memo'

export interface ViewerGameState {
	/** `null` means not played. */
	played: PlayedState | null
	playing: boolean
	liked: boolean
	/** 0–10 in half-star steps; 0 means unrated. */
	rating: number
}

export interface ViewerState {
	/** Keyed by IGDB id — the game record's rkey — as a string. */
	games: Record<string, ViewerGameState>
	backlog: number[]
}

/**
 * The signed-in viewer's own state across every game they have touched.
 *
 * A list page shows dozens of games, and asking the PDS about each one costs two
 * `getRecord`s per item. Two `listRecords` calls cover the whole repo instead,
 * and the client store hydrates from them once per session.
 *
 * Records still sitting under an id that has since folded into another title are
 * returned under their own id, unmerged. Folding is a write-path concern
 * (`loadConsolidatedGameRecord`) because it writes; a read must not.
 *
 * As with `profile-cache`, the `$lib/atproto` write helpers stay cache-unaware —
 * route handlers call `forgetViewerState` after a successful write.
 */
const byDid = createMemo<ViewerState>({ ttlMs: 15_000 })

export function loadViewerState(agent: Agent, did: string): Promise<ViewerState> {
	return byDid.get(did, async () => {
		const [gameRecords, backlogRecords] = await Promise.all([
			listAllRecords<RespawnGameRecord>(agent, did, Collections.game),
			listAllRecords<BacklogItem>(agent, did, Collections.backlogItem),
		])

		const games: Record<string, ViewerGameState> = {}
		for (const { rkey, value } of gameRecords) {
			const state: ViewerGameState = {
				played: value.played ?? null,
				playing: value.playing === true,
				liked: value.liked === true,
				rating: value.rating ?? 0,
			}
			// A record can carry nothing but a cover — a log wrote it, or an undo
			// emptied it. There is no button state to restore from that.
			if (state.played || state.playing || state.liked || state.rating) games[rkey] = state
		}

		return {
			games,
			backlog: backlogRecords.map((rec) => Number(rec.rkey)).filter(Number.isInteger),
		}
	})
}

/** Drop a DID's cached state. Call after writing their game or backlog records. */
export function forgetViewerState(did: string): void {
	byDid.delete(did)
}
