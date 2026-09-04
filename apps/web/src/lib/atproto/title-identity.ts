import type { Agent } from '@atproto/api'
import { getMembers, resolveIds } from '$lib/server/backend'
import {
	loadGameRecord,
	putGameRecord,
	RESPAWN_GAME_COLLECTION,
	type RespawnGameRecord,
} from './game'

/**
 * Reconciling saved records with IGDB's current shape — §7.4 of
 * docs/PLAN-igdb-mirror.md in the API repo.
 *
 * Records live in the user's PDS, keyed by whatever IGDB id was current when
 * they saved them. IGDB reorganises underneath us: a game folds into another,
 * a duplicate entry is deleted in favour of its twin. So one title can end up
 * with several records — someone rated the DLC in 2023 and the base game in
 * 2025, and both are theirs.
 *
 * Two halves, and the split matters:
 *
 *   READ  — resolve, group by title, merge. Never writes. Everyone's history
 *           renders correctly the moment the fold lands, with no migration.
 *   WRITE — when the user next acts on a title, consolidate its records into
 *           one at the root id and delete the strays. Lazy, one user at a time,
 *           triggered by an action they already took. No bulk job over other
 *           people's repos.
 */

/**
 * Merge several records for one title into the record we would keep.
 *
 * The rules are chosen so merging can never lose something the user did:
 *
 *   - `liked` and `playing` are OR-ed. Marking either on any record means the
 *     user meant it; nothing in the UI distinguishes "unset" from "false".
 *   - `rating` and `played` come from the newest record that has one. These
 *     are opinions that can change, and the later one is the current one — but
 *     an older rating still beats no rating at all.
 *   - `cover` comes from whichever record has one, because rebuilding it means
 *     re-uploading a blob to the PDS.
 *   - `createdAt` is the earliest, since that is when this user first recorded
 *     an interest in the title.
 */
export function mergeGameRecords(records: RespawnGameRecord[]): RespawnGameRecord | null {
	if (records.length === 0) return null
	if (records.length === 1) return records[0] ?? null

	// Newest first. `createdAt` is all a record carries — there is no updatedAt
	// in the lexicon — so it stands in for recency.
	const byNewest = [...records].toSorted((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
	const oldest = records.reduce((a, b) => (a.createdAt < b.createdAt ? a : b))

	return {
		game: byNewest.find((r) => r.game)?.game,
		rating: byNewest.find((r) => r.rating != null)?.rating,
		played: byNewest.find((r) => r.played != null)?.played,
		liked: records.some((r) => r.liked) || undefined,
		playing: records.some((r) => r.playing) || undefined,
		cover: byNewest.find((r) => r.cover)?.cover,
		createdAt: oldest.createdAt,
	}
}

/** Group anything keyed by an IGDB id under the title it now belongs to. */
export async function groupByTitle<T>(
	items: T[],
	getId: (item: T) => number,
	fetchFn?: typeof fetch,
): Promise<Map<number, T[]>> {
	const grouped = new Map<number, T[]>()
	if (items.length === 0) return grouped

	const resolved = await resolveIds(items.map(getId), fetchFn)

	for (const item of items) {
		const id = getId(item)
		// An id that resolves to nothing keeps its own bucket: the record is still
		// the user's, and dropping it would silently delete their history from the
		// page. It renders from whatever the record itself denormalized.
		const titleId = resolved[String(id)]?.titleId ?? id
		const bucket = grouped.get(titleId)
		if (bucket) bucket.push(item)
		else grouped.set(titleId, [item])
	}

	return grouped
}

/**
 * Fold a title's stray records into one at the root id.
 *
 * Called before a write, on a title the user is already acting on. Returns the
 * merged record so the caller can apply its change on top, or null when there
 * was nothing to merge.
 *
 * Deliberately best-effort: if consolidation fails the caller's own write must
 * still go through. A duplicate record is untidy; a failed action is a bug the
 * user sees.
 */
export async function consolidateGameRecords(
	agent: Agent,
	did: string,
	titleId: number,
	memberIds: number[],
): Promise<RespawnGameRecord | null> {
	const strays = memberIds.filter((id) => id !== titleId)

	const rootRecord = await loadGameRecord(agent, did, titleId)
	if (strays.length === 0) return rootRecord

	const found: Array<{ id: number; record: RespawnGameRecord }> = []
	if (rootRecord) found.push({ id: titleId, record: rootRecord })
	for (const id of strays) {
		const record = await loadGameRecord(agent, did, id)
		if (record) found.push({ id, record })
	}

	// Nothing under a stray id: the common case, and no write at all.
	if (!found.some((f) => f.id !== titleId)) return rootRecord

	const merged = mergeGameRecords(found.map((f) => f.record))
	if (!merged) return rootRecord

	await putGameRecord(agent, did, titleId, merged)

	// Delete only after the merged record is safely written, so an interruption
	// leaves a duplicate rather than losing the user's data.
	for (const { id } of found) {
		if (id === titleId) continue
		try {
			await agent.com.atproto.repo.deleteRecord({
				repo: did,
				collection: RESPAWN_GAME_COLLECTION,
				rkey: String(id),
			})
		} catch (err) {
			console.error('[title-identity] could not delete merged record', id, err)
		}
	}

	return merged
}

/**
 * The record for a title, with any strays folded in first.
 *
 * A drop-in for `loadGameRecord` on the write path. Best-effort by design: if
 * consolidation fails the caller still gets whatever is at the root id, because
 * a duplicate record is untidy while a failed action is a bug the user sees.
 */
export async function loadConsolidatedGameRecord(
	agent: Agent,
	did: string,
	titleId: number,
	memberIds?: number[],
	fetchFn?: typeof fetch,
): Promise<RespawnGameRecord | null> {
	try {
		const members = memberIds ?? (await memberIdsFor(titleId, fetchFn))
		return await consolidateGameRecords(agent, did, titleId, members)
	} catch (err) {
		console.error('[title-identity] consolidation failed; using the root record', err)
		return loadGameRecord(agent, did, titleId)
	}
}

/**
 * Every IGDB id that belongs to a title, the current one included.
 *
 * Used to gather a user's records for a title whose parts they may have saved
 * separately before the fold. Falls back to the id alone if the backend cannot
 * answer — a page that shows slightly less is better than one that errors.
 */
export async function memberIdsFor(titleId: number, fetchFn?: typeof fetch): Promise<number[]> {
	try {
		const { memberIds } = await getMembers(titleId, fetchFn)
		return memberIds.length > 0 ? memberIds : [titleId]
	} catch (err) {
		console.error('[identity] member lookup failed', err)
		return [titleId]
	}
}
